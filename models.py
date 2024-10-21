from typing import Optional

from fastapi import Query
from pydantic import BaseModel


class Target(BaseModel):
    id: str
    wallet: str
    source: str
    percent: float
    alias: Optional[str] = None


class TargetPut(BaseModel):
    wallet: str = Query(...)
    alias: str = Query("")
    percent: float = Query(..., ge=0, le=100)


class TargetPutList(BaseModel):
    targets: list[TargetPut]
