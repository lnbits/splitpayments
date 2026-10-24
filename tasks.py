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
from .models import Target


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

    total_percent = sum(target.percent for target in targets)
    if total_percent > 100:
        logger.error("splitpayments: total percent adds up to more than 100%")
        return

    logger.trace(f"splitpayments: performing split payments to {len(targets)} targets")

    # Pay targets sequentially: concurrent pay_invoice calls debiting the same
    # source wallet race each other and only the first one succeeds (issue #41).
    for target in targets:
        if target.percent <= 0:
            continue
        try:
            await pay_target(payment, target)
        except Exception as exc:
            logger.error(
                f"splitpayments: failed to pay target "
                f"{target.alias or target.wallet}: {exc!s}"
            )


async def pay_target(payment: Payment, target: Target) -> None:
    amount_msat = int(payment.amount * target.percent / 100)
    label = target.alias or target.wallet

    if amount_msat < 1000:
        logger.warning(f"splitpayments: split for {label} is below 1 sat, skipping")
        return

    memo = (
        f"Split payment: {target.percent}% for {label}"
        f";{payment.memo};{payment.payment_hash}"
    )

    if "@" in target.wallet or target.wallet.lower().startswith("lnurl"):
        safe_amount_msat = amount_msat - fee_reserve(amount_msat)
        if safe_amount_msat < 1000:
            logger.warning(
                f"splitpayments: split for {label} is below 1 sat after fee reserve, skipping"
            )
            return
        payment_request = await get_lnurl_invoice(
            target.wallet, payment.wallet_id, safe_amount_msat, memo
        )
    else:
        wallet = await get_wallet_for_key(target.wallet)
        wallet_id = wallet.id if wallet else target.wallet
        new_payment = await create_invoice(
            wallet_id=wallet_id,
            amount=int(amount_msat / 1000),
            internal=True,
            memo=memo,
        )
        payment_request = new_payment.bolt11

    if not payment_request:
        return

    await pay_invoice(
        payment_request=payment_request,
        wallet_id=payment.wallet_id,
        description=memo,
        extra={**payment.extra, "splitted": True},
    )
    logger.success(f"splitpayments: paid invoice for {memo}")


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
