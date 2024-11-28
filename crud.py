from lnbits.db import Database

from .models import Target

db = Database("ext_splitpayments")


async def get_targets(source_wallet: str) -> list[Target]:
    return await db.fetchall(
        "SELECT * FROM splitpayments.targets WHERE source = :source_wallet",
        {"source_wallet": source_wallet},
        Target,
    )


async def set_targets(source_wallet: str, targets: list[Target]):
    async with db.connect() as conn:
        await conn.execute(
            "DELETE FROM splitpayments.targets WHERE source = :source_wallet",
            {"source_wallet": source_wallet},
        )
        for target in targets:
            await conn.insert("splitpayments.targets", target)
