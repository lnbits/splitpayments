from typing import List

from lnbits.db import Database
from lnbits.helpers import urlsafe_short_hash

from .models import Target

db = Database("ext_splitpayments")


async def get_targets(source_wallet: str) -> List[Target]:
    rows = await db.fetchall(
        "SELECT * FROM splitpayments.targets WHERE source = ?", (source_wallet,)
    )
    return [Target(**row) for row in rows]


async def set_targets(source_wallet: str, targets: List[Target]):
    async with db.connect() as conn:
        await conn.execute(
            "DELETE FROM splitpayments.targets WHERE source = ?", (source_wallet,)
        )
        for target in targets:
            await conn.execute(
                """
                INSERT INTO splitpayments.targets
                  (id, source, wallet, percent, alias)
                VALUES (?, ?, ?, ?, ?)
            """,
                (
                    urlsafe_short_hash(),
                    source_wallet,
                    target.wallet,
                    target.percent,
                    target.alias,
                ),
            )
