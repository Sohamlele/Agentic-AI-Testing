"""Shared serializers and processing helpers."""

from __future__ import annotations

import logging
import os
from typing import Optional

from sqlmodel import Session

from database import engine
from models import PREvent, PREventRead, TestCase, TestCaseRead, User
from services.claude import generate_test_cases
from services.github import (
    fetch_pr_diff,
    format_test_cases_comment,
    parse_repo_and_number_from_url,
    post_pr_comment,
)

logger = logging.getLogger(__name__)


def serialize_event(event: PREvent) -> PREventRead:
    return PREventRead(
        id=event.id,
        user_id=getattr(event, "user_id", None),
        repo_name=event.repo_name,
        pr_number=event.pr_number,
        pr_title=event.pr_title,
        pr_url=event.pr_url,
        diff_summary=event.diff_summary,
        status=event.status,
        source=getattr(event, "source", "webhook") or "webhook",
        error_message=getattr(event, "error_message", "") or "",
        comments_posted=bool(getattr(event, "comments_posted", False)),
        created_at=event.created_at,
        test_cases=[
            TestCaseRead(
                id=tc.id,
                pr_event_id=tc.pr_event_id,
                test_name=tc.test_name,
                test_type=tc.test_type,
                description=tc.description,
                code=tc.code,
                created_at=tc.created_at,
            )
            for tc in event.test_cases
        ],
    )


async def process_pr_event(
    pr_event_id: int,
    *,
    diff_url: Optional[str] = None,
    inline_diff: Optional[str] = None,
    pr_title: str = "",
    pr_body: str = "",
    use_ai: bool = True,
    post_to_github: bool = False,
    github_access_token: Optional[str] = None,
) -> None:
    """Background job: resolve diff, generate tests, optionally comment on the PR."""
    with Session(engine) as session:
        pr_event = session.get(PREvent, pr_event_id)
        if not pr_event:
            return

        # Prefer the linked user's OAuth token when available
        token = github_access_token
        if not token and pr_event.user_id:
            user = session.get(User, pr_event.user_id)
            if user and user.github_access_token:
                token = user.github_access_token

        pr_event.status = "generating"
        pr_event.error_message = ""
        session.add(pr_event)
        session.commit()

        try:
            if inline_diff is not None:
                diff = inline_diff
            elif diff_url:
                diff = await fetch_pr_diff(diff_url, access_token=token)
            else:
                raise RuntimeError("No diff provided")

            pr_event.diff_summary = diff[:2000]
            session.add(pr_event)
            session.commit()

            test_cases_data = generate_test_cases(
                diff,
                pr_title=pr_title,
                pr_body=pr_body,
                use_ai=use_ai,
            )

            for tc in test_cases_data:
                session.add(
                    TestCase(
                        pr_event_id=pr_event_id,
                        test_name=tc["test_name"],
                        test_type=tc["test_type"],
                        description=tc["description"],
                        code=tc["code"],
                    )
                )

            should_comment = post_to_github or (
                os.getenv("POST_PR_COMMENTS", "true").lower() == "true"
                and pr_event.source == "webhook"
            )

            if should_comment and pr_event.pr_url and token:
                parsed = parse_repo_and_number_from_url(pr_event.pr_url)
                if parsed:
                    repo, number = parsed
                    body = format_test_cases_comment(pr_event.pr_title, test_cases_data)
                    await post_pr_comment(repo, number, body, access_token=token)
                    pr_event.comments_posted = True

            pr_event.status = "done"
            session.add(pr_event)
            session.commit()
            logger.info(
                "Generated %d test cases for PR event %s",
                len(test_cases_data),
                pr_event_id,
            )
        except Exception as exc:
            logger.exception("Failed to process PR event %s", pr_event_id)
            pr_event.status = "error"
            pr_event.error_message = str(exc)[:1000]
            session.add(pr_event)
            session.commit()
