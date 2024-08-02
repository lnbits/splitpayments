import asyncio

from fastapi import APIRouter
from loguru import logger

from .crud import db
from .tasks import wait_for_paid_invoices
from .views import splitpayments_generic_router
from .views_api import splitpayments_api_router

splitpayments_static_files = [
    {
        "path": "/splitpayments/static",
        "name": "splitpayments_static",
    }
]
splitpayments_ext: APIRouter = APIRouter(
    prefix="/splitpayments", tags=["splitpayments"]
)
splitpayments_ext.include_router(splitpayments_generic_router)
splitpayments_ext.include_router(splitpayments_api_router)

scheduled_tasks: list[asyncio.Task] = []


def splitpayments_stop():
    for task in scheduled_tasks:
        try:
            task.cancel()
        except Exception as ex:
            logger.warning(ex)


def splitpayments_start():
    from lnbits.tasks import create_permanent_unique_task

    task = create_permanent_unique_task("ext_splitpayments", wait_for_paid_invoices)
    scheduled_tasks.append(task)


__all__ = [
    "db",
    "splitpayments_ext",
    "splitpayments_static_files",
    "splitpayments_start",
    "splitpayments_stop",
]
