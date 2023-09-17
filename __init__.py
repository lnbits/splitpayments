import asyncio
from typing import List

from fastapi import APIRouter

from lnbits.db import Database
from lnbits.helpers import template_renderer
from lnbits.tasks import catch_everything_and_restart

db = Database("ext_splitpayments")

scheduled_tasks: List[asyncio.Task] = []

splitpayments_static_files = [
    {
        "path": "/splitpayments/static",
        "name": "splitpayments_static",
    }
]
splitpayments_ext: APIRouter = APIRouter(
    prefix="/splitpayments", tags=["splitpayments"]
)


def splitpayments_renderer():
    return template_renderer(["splitpayments/templates"])


from .tasks import wait_for_paid_invoices
from .views import *  # noqa: F401,F403
from .views_api import *  # noqa: F401,F403


def splitpayments_start():
    loop = asyncio.get_event_loop()
    task = loop.create_task(catch_everything_and_restart(wait_for_paid_invoices))
    scheduled_tasks.append(task)
