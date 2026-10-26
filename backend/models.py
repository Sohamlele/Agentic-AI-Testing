from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    github_id: int = Field(index=True, unique=True)
    github_username: str
    github_avatar_url: str = ""
    github_access_token: str = ""
    created_at: datetime = Field(default_factory=utc_now)

    repos: list["Repo"] = Relationship(back_populates="user")
    pr_events: list["PREvent"] = Relationship(back_populates="user")


class Repo(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    repo_full_name: str = Field(index=True)
    repo_url: str = ""
    webhook_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)

    user: Optional[User] = Relationship(back_populates="repos")


class PREvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    repo_name: str
    pr_number: int
    pr_title: str
    pr_url: str = ""
    diff_summary: str = ""
    status: str = "pending"  # pending | generating | done | error
    source: str = "webhook"  # webhook | manual | demo | seed
    error_message: str = ""
    comments_posted: bool = False
    created_at: datetime = Field(default_factory=utc_now)

    user: Optional[User] = Relationship(back_populates="pr_events")
    test_cases: list["TestCase"] = Relationship(back_populates="pr_event")


class TestCase(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    pr_event_id: int = Field(foreign_key="prevent.id")
    test_name: str
    test_type: str  # unit | integration
    description: str
    code: str
    created_at: datetime = Field(default_factory=utc_now)

    pr_event: Optional[PREvent] = Relationship(back_populates="test_cases")


class UserRead(SQLModel):
    id: int
    github_id: int
    github_username: str
    github_avatar_url: str
    created_at: datetime


class RepoCreate(SQLModel):
    repo_full_name: str
    repo_url: str = ""
    webhook_active: bool = True


class RepoRead(SQLModel):
    id: int
    user_id: int
    repo_full_name: str
    repo_url: str
    webhook_active: bool
    created_at: datetime


class TestCaseRead(SQLModel):
    id: int
    pr_event_id: int
    test_name: str
    test_type: str
    description: str
    code: str
    created_at: datetime


class PREventRead(SQLModel):
    id: int
    user_id: Optional[int] = None
    repo_name: str
    pr_number: int
    pr_title: str
    pr_url: str
    diff_summary: str
    status: str
    source: str = "webhook"
    error_message: str = ""
    comments_posted: bool = False
    created_at: datetime
    test_cases: list[TestCaseRead] = []


class PRListItem(SQLModel):
    id: int
    repo_name: str
    pr_number: int
    pr_title: str
    pr_url: str
    status: str
    source: str = "webhook"
    comments_posted: bool = False
    created_at: datetime
    test_case_count: int = 0


class GenerateRequest(SQLModel):
    repo_name: str = "local/demo"
    pr_number: int = 1
    pr_title: str
    pr_body: str = ""
    pr_url: str = ""
    diff: str
    post_to_github: bool = False


class SimulateRequest(SQLModel):
    sample: str = "refund"  # refund | auth | feature_flag
    use_ai: bool = True
