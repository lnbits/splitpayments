import asyncio
import json
from math import floor
from typing import Optional

import bech32
import websockets
import json

import httpx
from loguru import logger

from lnbits import bolt11
from lnbits.core.crud import get_standalone_payment
from lnbits.core.models import Payment
from lnbits.core.services import create_invoice, fee_reserve, pay_invoice
from lnbits.helpers import get_current_extension_name
from lnbits.tasks import register_invoice_listener

from .crud import get_targets


async def wait_for_paid_invoices():    
    invoice_queue = asyncio.Queue()
    register_invoice_listener(invoice_queue, get_current_extension_name())

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
                f"Split payment: {target.percent}% for {target.alias or target.wallet}"
            )

            npubWallet = ''
            if target.wallet.find("npub") >= 0:
                npubWallet = await get_npub_address(target.wallet)                        
            
            # if npubWallet is not empty, use it as the target wallet
            if npubWallet != '':
                targetWallet = npubWallet
            else:
                targetWallet = target.wallet
    
            print(targetWallet  + " " + str(amount_msat) + " " + memo)

            if targetWallet.find("@") >= 0 or targetWallet.find("LNURL") >= 0:                
                safe_amount_msat = amount_msat - fee_reserve(amount_msat)
                payment_request = await get_lnurl_invoice(
                    targetWallet, payment.wallet_id, safe_amount_msat, memo
                )
            else:                
                _, payment_request = await create_invoice(
                    wallet_id=target.wallet,
                    amount=int(amount_msat / 1000),
                    internal=True,
                    memo=memo,
                )

            extra = {**payment.extra, "tag": "splitpayments", "splitted": True}

            if payment_request:
                await pay_invoice(
                    payment_request=payment_request,
                    wallet_id=payment.wallet_id,
                    description=memo,
                    extra=extra,
                )

async def get_npub_address(    
    npub: str
) -> Optional[str]: 
    
    hrp, data = bech32.bech32_decode(npub)
    raw_secret = bech32.convertbits(data, 5, 8)
    if raw_secret[-1] != 0x0:
        pubkey = str(bytes(raw_secret).hex())        
    else:
        pubkey = str(bytes(raw_secret[:-1]).hex()) 
    
    print("trying to get npub: ", pubkey)
    uri = "wss://nostr-pub.wellorder.net"
    jsonOb = ''
                
    # TODO utilize a try except and find out why websocket is not connecting
    async with websockets.connect(uri) as websocket:
    #websocket = websockets.connect(uri)
        req = '["REQ", "a",  {"kinds": [0], "limit": 10, "authors": ["'+ pubkey +'"]} ]'
        ''' send req to websocket and print response'''
        await websocket.send(req)                    
        greeting = await websocket.recv()
        output = json.loads(greeting)
        jsonOb = json.loads(output[2]['content'])

    #npubWallet06 = ''
    #npubWallet16 = ''
    npubWallet = ''                    
    if "lud16" in jsonOb and npubWallet == '':
        logger.info("we got a lud16: ", jsonOb["lud16"])
        if len(jsonOb["lud16"]) > 1:
            npubWallet = jsonOb["lud16"]
    #if "lud06" in jsonOb:
    #    logger.info("we got a lud06: ", jsonOb["lud06"])
    #    if len(jsonOb["lud06"]) > 1:
    #        npubWallet = jsonOb["lud06"]

    if npubWallet == '':
        print("Failed to get npub wallet")

    return npubWallet

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
                timeout=40,
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
            logger.error(f"splitting LNURL failed: {str(exc)}.")
            return None

    params = json.loads(r.text)
    if params.get("status") == "ERROR":
        logger.error(f"{data['callback']} said: '{params.get('reason', '')}'")
        return None

    invoice = bolt11.decode(params["pr"])

    lnurlp_payment = await get_standalone_payment(invoice.payment_hash)

    if lnurlp_payment and lnurlp_payment.wallet_id == wallet_id:
        logger.error(f"split failed. cannot split payments to yourself via LNURL.")
        return None

    if invoice.amount_msat != rounded_amount:
        logger.error(
            f"{data['callback']} returned an invalid invoice. Expected {amount_msat} msat, got {invoice.amount_msat}."
        )
        return None

    return params["pr"]
