import asyncio
from math import floor

import bolt11
from lnbits.core.crud import get_standalone_payment
from lnbits.core.crud.wallets import get_wallet_for_key
from lnbits.core.models import Payment
from lnbits.core.services import (
    create_invoice,
    fee_reserve,
    get_pr_from_lnurl,
    pay_invoice,
)
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
    payoraddress: str, wallet_id: str, amount_msat: int, memo: str
) -> str | None:

    rounded_amount = floor(amount_msat / 1000) * 1000

    try:
        payment_request = await get_pr_from_lnurl(payoraddress, rounded_amount, memo)
    except Exception as e:
        logger.error(f"Error getting LNURL invoice: {e!s}")
        return None

    invoice = bolt11.decode(payment_request)

    lnurlp_payment = await get_standalone_payment(invoice.payment_hash)

    if lnurlp_payment and lnurlp_payment.wallet_id == wallet_id:
        logger.error("split failed. cannot split payments to yourself via LNURL.")
        return None

    return payment_request
