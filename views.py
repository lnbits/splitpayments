from fastapi import APIRouter, Depends, Request
from fastapi.templating import Jinja2Templates
from lnbits.core.models import User
from lnbits.decorators import check_user_exists
from lnbits.helpers import template_renderer
from starlette.responses import HTMLResponse

templates = Jinja2Templates(directory="templates")
splitpayments_generic_router = APIRouter()


def splitpayments_renderer():
    return template_renderer(["splitpayments/templates"])


@splitpayments_generic_router.get("/", response_class=HTMLResponse)
async def index(request: Request, user: User = Depends(check_user_exists)):
    return splitpayments_renderer().TemplateResponse(
        "splitpayments/index.html", {"request": request, "user": user.dict()}
    )
