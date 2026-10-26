import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional
from urllib.parse import quote

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlmodel import Session, func, select

from auth import COOKIE_NAME, cookie_settings, create_access_token, get_current_user
from database import create_db_and_tables, engine, get_session
from models import (
    GenerateRequest,
    PREvent,
    PREventRead,
    PRListItem,
    Repo,
    RepoCreate,
    RepoRead,
    SimulateRequest,
    TestCase,
    User,
    UserRead,
)
from processing import process_pr_event, serialize_event
from services.github import (
    exchange_code_for_token,
    fetch_github_user,
    github_oauth_authorize_url,
    verify_signature,
)
from services.samples import SAMPLES, list_samples

load_dotenv(Path(__file__).resolve().parent / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _cors_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _public_api_url() -> str:
    return os.getenv("PUBLIC_API_URL", "http://localhost:8000").rstrip("/")


def _normalize_repo_name(name: str) -> str:
    cleaned = name.strip().removeprefix("https://github.com/").removeprefix("http://github.com/")
    cleaned = cleaned.strip("/")
    if cleaned.count("/") != 1:
        raise HTTPException(
            status_code=400,
            detail="repo_full_name must look like owner/repo",
        )
    return cleaned


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(
    title="TestAgent API",
    version="0.3.0",
    description="Agentic test case generation with GitHub OAuth.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth ─────────────────────────────────────────────────────────────────────


@app.get("/auth/github")
async def auth_github():
    if not os.getenv("GITHUB_CLIENT_ID"):
        raise HTTPException(
            status_code=500,
            detail="GITHUB_CLIENT_ID is not configured",
        )
    return RedirectResponse(github_oauth_authorize_url())


@app.get("/auth/github/callback")
async def auth_github_callback(code: Optional[str] = None, error: Optional[str] = None):
    if error:
        return RedirectResponse(f"{_frontend_url()}/?auth_error={quote(error)}")
    if not code:
        raise HTTPException(status_code=400, detail="Missing OAuth code")

    try:
        access_token = await exchange_code_for_token(code)
        gh_user = await fetch_github_user(access_token)
    except Exception as exc:
        logger.exception("OAuth callback failed")
        return RedirectResponse(
            f"{_frontend_url()}/?auth_error={quote(str(exc)[:120])}"
        )

    github_id = int(gh_user["id"])
    username = gh_user.get("login", "")
    avatar = gh_user.get("avatar_url", "")

    with Session(engine) as session:
        user = session.exec(select(User).where(User.github_id == github_id)).first()
        if user:
            user.github_username = username
            user.github_avatar_url = avatar
            user.github_access_token = access_token
        else:
            user = User(
                github_id=github_id,
                github_username=username,
                github_avatar_url=avatar,
                github_access_token=access_token,
            )
            session.add(user)
        session.commit()
        session.refresh(user)
        token = create_access_token(user.id)

    response = RedirectResponse(f"{_frontend_url()}/dashboard", status_code=302)
    settings = cookie_settings()
    response.set_cookie(value=token, **settings)
    return response


@app.get("/auth/me", response_model=UserRead)
def auth_me(user: User = Depends(get_current_user)):
    return UserRead(
        id=user.id,
        github_id=user.github_id,
        github_username=user.github_username,
        github_avatar_url=user.github_avatar_url,
        created_at=user.created_at,
    )


@app.get("/auth/logout")
def auth_logout(response: Response):
    response = RedirectResponse(f"{_frontend_url()}/", status_code=302)
    response.delete_cookie(COOKIE_NAME, path="/")
    return response


@app.post("/auth/logout")
def auth_logout_api():
    response = Response(content='{"status":"logged_out"}', media_type="application/json")
    response.delete_cookie(COOKIE_NAME, path="/")
    return response


# ── Webhook ──────────────────────────────────────────────────────────────────


@app.post("/webhook/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: Optional[str] = Header(default=None),
    x_github_event: Optional[str] = Header(default=None),
):
    body = await request.body()

    if not verify_signature(body, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()

    if x_github_event != "pull_request":
        return {"status": "ignored", "reason": f"event={x_github_event}"}

    action = payload.get("action")
    if action not in ("opened", "synchronize"):
        return {"status": "ignored", "reason": f"action={action}"}

    pr = payload.get("pull_request", {})
    repo = payload.get("repository", {})

    repo_name = repo.get("full_name", "unknown")
    pr_number = pr.get("number", 0)
    pr_title = pr.get("title", "")
    pr_url = pr.get("html_url", "")
    pr_body = pr.get("body") or ""
    diff_url = pr.get("diff_url") or (pr.get("url", "") + "/files")

    with Session(engine) as session:
        connected = session.exec(
            select(Repo).where(
                Repo.repo_full_name == repo_name,
                Repo.webhook_active == True,  # noqa: E712
            )
        ).first()
        user_id = connected.user_id if connected else None
        user_token = None
        if connected:
            owner = session.get(User, connected.user_id)
            user_token = owner.github_access_token if owner else None

        pr_event = PREvent(
            user_id=user_id,
            repo_name=repo_name,
            pr_number=pr_number,
            pr_title=pr_title,
            pr_url=pr_url,
            status="pending",
            source="webhook",
        )
        session.add(pr_event)
        session.commit()
        session.refresh(pr_event)
        pr_event_id = pr_event.id

    background_tasks.add_task(
        process_pr_event,
        pr_event_id,
        diff_url=diff_url,
        pr_title=pr_title,
        pr_body=pr_body,
        use_ai=True,
        post_to_github=True,
        github_access_token=user_token,
    )

    return {"status": "accepted", "pr_event_id": pr_event_id}


# ── Repos ─────────────────────────────────────────────────────────────────────


@app.get("/repos", response_model=list[RepoRead])
def list_repos(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    repos = session.exec(
        select(Repo).where(Repo.user_id == user.id).order_by(Repo.created_at.desc())
    ).all()
    return [
        RepoRead(
            id=r.id,
            user_id=r.user_id,
            repo_full_name=r.repo_full_name,
            repo_url=r.repo_url,
            webhook_active=r.webhook_active,
            created_at=r.created_at,
        )
        for r in repos
    ]


@app.get("/repos/webhook-info")
def webhook_info(user: User = Depends(get_current_user)):
    return {
        "webhook_url": f"{_public_api_url()}/webhook/github",
        "webhook_secret": os.getenv("GITHUB_WEBHOOK_SECRET", ""),
        "events": ["pull_request"],
        "content_type": "application/json",
        "user": user.github_username,
    }


@app.post("/repos", response_model=RepoRead)
def create_repo(
    payload: RepoCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    full_name = _normalize_repo_name(payload.repo_full_name)
    existing = session.exec(
        select(Repo).where(Repo.user_id == user.id, Repo.repo_full_name == full_name)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Repo already connected")

    repo_url = payload.repo_url or f"https://github.com/{full_name}"
    repo = Repo(
        user_id=user.id,
        repo_full_name=full_name,
        repo_url=repo_url,
        webhook_active=payload.webhook_active,
    )
    session.add(repo)
    session.commit()
    session.refresh(repo)
    return RepoRead(
        id=repo.id,
        user_id=repo.user_id,
        repo_full_name=repo.repo_full_name,
        repo_url=repo.repo_url,
        webhook_active=repo.webhook_active,
        created_at=repo.created_at,
    )


@app.delete("/repos/{repo_id}")
def delete_repo(
    repo_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    repo = session.get(Repo, repo_id)
    if not repo or repo.user_id != user.id:
        raise HTTPException(status_code=404, detail="Repo not found")
    session.delete(repo)
    session.commit()
    return {"status": "deleted", "id": repo_id}


# ── PRs / test cases ──────────────────────────────────────────────────────────


@app.get("/prs", response_model=list[PRListItem])
def list_prs(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    events = session.exec(
        select(PREvent)
        .where(PREvent.user_id == user.id)
        .order_by(PREvent.created_at.desc())
    ).all()
    results: list[PRListItem] = []
    for event in events:
        results.append(
            PRListItem(
                id=event.id,
                repo_name=event.repo_name,
                pr_number=event.pr_number,
                pr_title=event.pr_title,
                pr_url=event.pr_url,
                status=event.status,
                source=event.source,
                comments_posted=event.comments_posted,
                created_at=event.created_at,
                test_case_count=len(event.test_cases),
            )
        )
    return results


@app.get("/test-cases", response_model=list[PREventRead])
def list_test_cases(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    events = session.exec(
        select(PREvent)
        .where(PREvent.user_id == user.id)
        .order_by(PREvent.created_at.desc())
    ).all()
    return [serialize_event(event) for event in events]


@app.get("/test-cases/{pr_id}", response_model=PREventRead)
def get_test_cases(
    pr_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    event = session.get(PREvent, pr_id)
    if not event or event.user_id != user.id:
        raise HTTPException(status_code=404, detail="PR event not found")
    return serialize_event(event)


@app.delete("/test-cases/{pr_id}")
def delete_test_cases(
    pr_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    event = session.get(PREvent, pr_id)
    if not event or event.user_id != user.id:
        raise HTTPException(status_code=404, detail="PR event not found")
    for tc in list(event.test_cases):
        session.delete(tc)
    session.delete(event)
    session.commit()
    return {"status": "deleted", "id": pr_id}


@app.post("/generate", response_model=PREventRead)
async def generate_from_diff(
    payload: GenerateRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not payload.diff.strip():
        raise HTTPException(status_code=400, detail="diff is required")

    pr_event = PREvent(
        user_id=user.id,
        repo_name=payload.repo_name,
        pr_number=payload.pr_number,
        pr_title=payload.pr_title,
        pr_url=payload.pr_url,
        status="pending",
        source="manual",
    )
    session.add(pr_event)
    session.commit()
    session.refresh(pr_event)

    background_tasks.add_task(
        process_pr_event,
        pr_event.id,
        inline_diff=payload.diff,
        pr_title=payload.pr_title,
        pr_body=payload.pr_body,
        use_ai=True,
        post_to_github=payload.post_to_github,
        github_access_token=user.github_access_token,
    )

    return serialize_event(pr_event)


@app.post("/demo/simulate", response_model=PREventRead)
async def simulate_sample(
    payload: SimulateRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    sample = SAMPLES.get(payload.sample)
    if not sample:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown sample. Choose one of: {', '.join(SAMPLES)}",
        )

    pr_event = PREvent(
        user_id=user.id,
        repo_name=sample["repo_name"],
        pr_number=sample["pr_number"],
        pr_title=sample["pr_title"],
        pr_url=sample["pr_url"],
        status="pending",
        source="demo",
    )
    session.add(pr_event)
    session.commit()
    session.refresh(pr_event)

    background_tasks.add_task(
        process_pr_event,
        pr_event.id,
        inline_diff=sample["diff"],
        pr_title=sample["pr_title"],
        pr_body=sample["pr_body"],
        use_ai=payload.use_ai,
        post_to_github=False,
        github_access_token=user.github_access_token,
    )

    return serialize_event(pr_event)


@app.get("/demo/samples")
def get_samples():
    return list_samples()


@app.get("/stats")
def stats(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    total_prs = session.exec(
        select(func.count(PREvent.id)).where(PREvent.user_id == user.id)
    ).one()
    done = session.exec(
        select(func.count(PREvent.id)).where(
            PREvent.user_id == user.id, PREvent.status == "done"
        )
    ).one()
    test_cases = session.exec(
        select(func.count(TestCase.id))
        .select_from(TestCase)
        .join(PREvent, TestCase.pr_event_id == PREvent.id)
        .where(PREvent.user_id == user.id)
    ).one()
    repos_connected = session.exec(
        select(func.count(Repo.id)).where(Repo.user_id == user.id)
    ).one()
    return {
        "total_prs": total_prs,
        "prs_analyzed": done,
        "test_cases_generated": test_cases,
        "repos_connected": repos_connected,
        "anthropic_configured": bool(os.getenv("ANTHROPIC_API_KEY", "").strip()),
        "github_oauth_configured": bool(os.getenv("GITHUB_CLIENT_ID", "").strip()),
        "webhook_secret_configured": bool(os.getenv("GITHUB_WEBHOOK_SECRET", "").strip()),
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "0.3.0",
        "anthropic_configured": bool(os.getenv("ANTHROPIC_API_KEY", "").strip()),
        "github_oauth_configured": bool(os.getenv("GITHUB_CLIENT_ID", "").strip()),
    }
