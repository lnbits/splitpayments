from lnbits.db import Connection
from lnbits.helpers import urlsafe_short_hash


async def m001_initial(db: Connection):
    """
    Initial split payment table.
    """
    await db.execute(
        """
        CREATE TABLE splitpayments.targets (
            wallet TEXT NOT NULL,
            source TEXT NOT NULL,
            percent INTEGER NOT NULL CHECK (percent >= 0 AND percent <= 100),
            alias TEXT,

            UNIQUE (source, wallet)
        );
        """
    )


async def m002_float_percent(db: Connection):
    """
    alter percent to be float.
    """
    await db.execute("ALTER TABLE splitpayments.targets RENAME TO splitpayments_m001")

    await db.execute(
        """
        CREATE TABLE splitpayments.targets (
            wallet TEXT NOT NULL,
            source TEXT NOT NULL,
            percent REAL NOT NULL CHECK (percent >= 0 AND percent <= 100),
            alias TEXT,

            UNIQUE (source, wallet)
        );
    """
    )
    result = await db.execute("SELECT * FROM splitpayments.splitpayments_m001")
    rows = result.mappings().all()
    for row in rows:
        await db.execute(
            """
            INSERT INTO splitpayments.targets (
                wallet,
                source,
                percent,
                alias
            )
            VALUES (:wallet, :source, :percent, :alias)
            """,
            {
                "wallet": row["wallet"],
                "source": row["source"],
                "percent": row["percent"],
                "alias": row["alias"],
            },
        )

    await db.execute("DROP TABLE splitpayments.splitpayments_m001")


async def m003_add_id_and_tag(db: Connection):
    """
    Add id, tag and migrates the existing data.
    """
    await db.execute("ALTER TABLE splitpayments.targets RENAME TO splitpayments_m002")

    await db.execute(
        """
        CREATE TABLE splitpayments.targets (
            id TEXT PRIMARY KEY,
            wallet TEXT NOT NULL,
            source TEXT NOT NULL,
            percent REAL NOT NULL CHECK (percent >= 0 AND percent <= 100),
            tag TEXT NOT NULL,
            alias TEXT,

            UNIQUE (source, wallet)
        );
    """
    )
    result = await db.execute("SELECT * FROM splitpayments.splitpayments_m002")
    rows = result.mappings().all()
    for row in rows:
        await db.execute(
            """
            INSERT INTO splitpayments.targets (
                id,
                wallet,
                source,
                percent,
                tag,
                alias
            )
            VALUES (:id, :wallet, :source, :percent, :tag, :alias)
            """,
            {
                "id": urlsafe_short_hash(),
                "wallet": row["wallet"],
                "source": row["source"],
                "percent": row["percent"],
                "tag": row["tag"],
                "alias": row["alias"],
            },
        )

    await db.execute("DROP TABLE splitpayments.splitpayments_m002")


async def m004_remove_tag(db: Connection):
    """
    This removes tag
    """
    keys = "id,wallet,source,percent,alias"
    new_db = "splitpayments.targets"
    old_db = "splitpayments.targets_m003"

    await db.execute(f"ALTER TABLE {new_db} RENAME TO targets_m003")

    await db.execute(
        f"""
        CREATE TABLE {new_db} (
            id TEXT PRIMARY KEY,
            wallet TEXT NOT NULL,
            source TEXT NOT NULL,
            percent REAL NOT NULL CHECK (percent >= 0 AND percent <= 100),
            alias TEXT,
            UNIQUE (source, wallet)
        );
    """
    )
    await db.execute(f"INSERT INTO {new_db} ({keys}) SELECT {keys} FROM {old_db}")
    await db.execute(f"DROP TABLE {old_db}")
