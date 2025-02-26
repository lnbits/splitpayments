import asyncio
import json
from math import floor
from typing import Optional

import bolt11
import httpx
from lnbits.core.crud import get_standalone_payment
from lnbits.core.crud.wallets import get_wallet_for_key
from lnbits.core.models import Payment
from lnbits.core.services import create_invoice, fee_reserve, pay_invoice
from lnbits.tasks import register_invoice_listener
from loguru import logger

from .crud import get_targets


async def wait_for_paid_invoices():
    invoice_queue = asyncio.Queue()
    register_invoice_listener(invoice_queue, "ext_splitpayments_invoice_listener")
    while True:
        payment = await invoice_queue.get()
        await on_invoice_paid(payment)


async def on_invoice_paid(payment: Payment) -> None:

    if payment.extra.get("tag") == "splitpayments" or payment.extra.get("splitted"):
        # already a splitted payment, ignore
        return

    targets = await get_targets(payment.wallet_id)

    if not targets:
        return

    total_percent = sum([target.percent for target in targets])

    if total_percent > 100:
        logger.error("splitpayment: total percent adds up to more than 100%")
        return

    logger.trace(f"splitpayments: performing split payments to {len(targets)} targets")

    for target in targets:
        if target.percent > 0:
            amount_msat = int(payment.amount * target.percent / 100)
            memo = (
                f"Split payment: {target.percent}% "
                f"for {target.alias or target.wallet}"
                f";{payment.memo};{payment.payment_hash}"
            )

            if "@" in target.wallet or "LNURL" in target.wallet:
                safe_amount_msat = amount_msat - fee_reserve(amount_msat)
                payment_request = await get_lnurl_invoice(
                    target.wallet, payment.wallet_id, safe_amount_msat, memo
                )
            else:
                wallet = await get_wallet_for_key(target.wallet)
                if wallet is not None:
                    target.wallet = wallet.id
                new_payment = await create_invoice(
                    wallet_id=target.wallet,
                    amount=int(amount_msat / 1000),
                    internal=True,
                    memo=memo,
                )
                payment_request = new_payment.bolt11

            extra = {**payment.extra, "splitted": True}

            if payment_request:
                task = asyncio.create_task(
                    pay_invoice_in_background(
                        payment_request=payment_request,
                        wallet_id=payment.wallet_id,
                        description=memo,
                        extra=extra,
                    )
                )
                task.add_done_callback(lambda fut: logger.success(fut.result()))


async def pay_invoice_in_background(payment_request, wallet_id, description, extra):
    try:
        await pay_invoice(
            payment_request=payment_request,
            wallet_id=wallet_id,
            description=description,
            extra=extra,
        )
        return f"Splitpayments: paid invoice for {description}"
    except Exception as e:
        logger.error(f"Failed to pay invoice: {e}")


async def get_lnurl_invoice(
    payoraddress, wallet_id, amount_msat, memo
) -> Optional[str]:

    from lnbits.core.views.api import api_lnurlscan

    data = await api_lnurlscan(payoraddress)
    rounded_amount = floor(amount_msat / 1000) * 1000

    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(
                data["callback"],
                params={"amount": rounded_amount, "comment": memo},
                timeout=5,
            )
            if r.is_error:
                raise httpx.ConnectError("issue with scrub callback")
            r.raise_for_status()
        except (httpx.ConnectError, httpx.RequestError):
            logger.error(
                f"splitting LNURL failed: Failed to connect to {data['callback']}."
            )
            return None
        except Exception as exc:
            logger.error(f"splitting LNURL failed: {exc!s}.")
            return None

    params = json.loads(r.text)
    if params.get("status") == "ERROR":
        logger.error(f"{data['callback']} said: '{params.get('reason', '')}'")
        return None

    invoice = bolt11.decode(params["pr"])

    lnurlp_payment = await get_standalone_payment(invoice.payment_hash)

    if lnurlp_payment and lnurlp_payment.wallet_id == wallet_id:
        logger.error("split failed. cannot split payments to yourself via LNURL.")
        return None

    if invoice.amount_msat != rounded_amount:
        logger.error(
            f"""
        {data['callback']} returned an invalid invoice.
        Expected {amount_msat} msat, got {invoice.amount_msat}.
        """
        )
        return None

    return params["pr"]
