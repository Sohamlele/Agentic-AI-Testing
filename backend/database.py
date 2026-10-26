from pathlib import Path

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

BASE_DIR = Path(__file__).resolve().parent
sqlite_url = f"sqlite:///{BASE_DIR / 'testagent.db'}"

engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)
    _migrate_columns()


def _migrate_columns() -> None:
    """Add columns introduced after earlier schemas (SQLite-safe)."""
    alterations = [
        ("prevent", "source", "TEXT DEFAULT 'webhook'"),
        ("prevent", "error_message", "TEXT DEFAULT ''"),
        ("prevent", "comments_posted", "BOOLEAN DEFAULT 0"),
        ("prevent", "user_id", "INTEGER"),
    ]
    with engine.begin() as conn:
        for table, column, col_type in alterations:
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            existing = {row[1] for row in rows}
            if column not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))


def get_session():
    with Session(engine) as session:
        yield session
