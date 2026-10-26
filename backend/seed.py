#!/usr/bin/env python3
"""Seed the database with finished sample PRs for resume demos."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
from sqlmodel import Session, select

from database import create_db_and_tables, engine
from models import PREvent, TestCase
from services.claude import generate_test_cases
from services.samples import SAMPLES

load_dotenv(ROOT / ".env")


def seed(use_ai: bool = False) -> None:
    create_db_and_tables()
    with Session(engine) as session:
        existing = session.exec(select(PREvent)).first()
        if existing:
            print("Database already has PR events — skipping seed.")
            print("Delete backend/testagent.db and re-run to reseed.")
            return

        for key, sample in SAMPLES.items():
            print(f"Seeding sample: {key}")
            event = PREvent(
                repo_name=sample["repo_name"],
                pr_number=sample["pr_number"],
                pr_title=sample["pr_title"],
                pr_url=sample["pr_url"],
                diff_summary=sample["diff"][:2000],
                status="done",
                source="seed",
            )
            session.add(event)
            session.commit()
            session.refresh(event)

            cases = generate_test_cases(
                sample["diff"],
                pr_title=sample["pr_title"],
                pr_body=sample["pr_body"],
                use_ai=use_ai,
            )
            for tc in cases:
                session.add(
                    TestCase(
                        pr_event_id=event.id,
                        test_name=tc["test_name"],
                        test_type=tc["test_type"],
                        description=tc["description"],
                        code=tc["code"],
                    )
                )
            session.commit()
            print(f"  → {len(cases)} test cases")

    print("Seed complete.")


if __name__ == "__main__":
    use_ai = "--ai" in sys.argv
    seed(use_ai=use_ai)
