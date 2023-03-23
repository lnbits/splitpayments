from sqlite3 import Row
from typing import List, Optional

from fastapi import Query
from pydantic import BaseModel


class Target(BaseModel):
    wallet: str
    source: str
    percent: float
    alias: Optional[str]

    @classmethod
    def from_row(cls, row: Row):
        return cls(**dict(row))


class TargetPut(BaseModel):
    wallet: str = Query(...)
    alias: str = Query("")
    percent: float = Query(..., ge=0, le=100)


class TargetPutList(BaseModel):
    targets: List[TargetPut]
