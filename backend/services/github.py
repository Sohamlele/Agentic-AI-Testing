import hashlib
import hmac
import os
import re
from typing import Optional
from urllib.parse import urlencode

import httpx


def verify_signature(payload_body: bytes, signature_header: str | None) -> bool:
    """Validate X-Hub-Signature-256 from GitHub webhooks."""
    secret = os.getenv("GITHUB_WEBHOOK_SECRET", "")
    if not secret:
        # Allow local dev without a secret configured
        return True
    if not signature_header:
        return False

    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        payload_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def github_oauth_authorize_url(state: str = "") -> str:
    client_id = os.getenv("GITHUB_CLIENT_ID", "")
    redirect_uri = os.getenv(
        "GITHUB_OAUTH_REDIRECT_URI",
        "http://localhost:8000/auth/github/callback",
    )
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": "read:user user:email repo",
    }
    if state:
        params["state"] = state
    return f"https://github.com/login/oauth/authorize?{urlencode(params)}"


async def exchange_code_for_token(code: str) -> str:
    client_id = os.getenv("GITHUB_CLIENT_ID", "")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET", "")
    redirect_uri = os.getenv(
        "GITHUB_OAUTH_REDIRECT_URI",
        "http://localhost:8000/auth/github/callback",
    )
    if not client_id or not client_secret:
        raise RuntimeError("GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
        response.raise_for_status()
        data = response.json()
        token = data.get("access_token")
        if not token:
            raise RuntimeError(data.get("error_description") or "Failed to get access token")
        return token


async def fetch_github_user(access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            "https://api.github.com/user",
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {access_token}",
                "User-Agent": "TestAgent",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        response.raise_for_status()
        return response.json()


def _auth_headers(token: Optional[str] = None) -> dict:
    headers = {
        "Accept": "application/vnd.github.v3.diff",
        "User-Agent": "TestAgent",
    }
    resolved = token or os.getenv("GITHUB_TOKEN", "")
    if resolved:
        headers["Authorization"] = f"Bearer {resolved}"
        headers["Accept"] = "application/vnd.github.v3.diff"
    return headers


async def fetch_pr_diff(diff_url: str, access_token: Optional[str] = None) -> str:
    """Fetch the full PR diff from GitHub."""
    headers = _auth_headers(access_token)
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(diff_url, headers=headers)
        response.raise_for_status()
        return response.text


async def post_pr_comment(
    repo_full_name: str,
    pr_number: int,
    body: str,
    access_token: Optional[str] = None,
) -> dict:
    """Post a markdown comment on a pull request."""
    token = access_token or os.getenv("GITHUB_TOKEN", "")
    if not token:
        raise RuntimeError("A GitHub token is required to post PR comments")

    url = f"https://api.github.com/repos/{repo_full_name}/issues/{pr_number}/comments"
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "TestAgent",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, json={"body": body})
        response.raise_for_status()
        return response.json()


def parse_repo_and_number_from_url(pr_url: str) -> tuple[str, int] | None:
    """Extract owner/repo and PR number from an html_url."""
    match = re.search(r"github\.com/([^/]+/[^/]+)/pull/(\d+)", pr_url or "")
    if not match:
        return None
    return match.group(1), int(match.group(2))


def detect_language(code: str) -> str:
    if "def " in code or "import " in code and "from " in code:
        return "python"
    if "describe(" in code or "it(" in code or "=>" in code or "export " in code:
        return "typescript"
    if "func " in code:
        return "go"
    return "text"


def format_test_cases_comment(pr_title: str, test_cases: list[dict]) -> str:
    lines = [
        "## 🤖 TestAgent — Generated Test Cases",
        "",
        f"Auto-generated for **{pr_title}**.",
        "",
    ]
    for tc in test_cases:
        lang = detect_language(tc.get("code", ""))
        lines.append(f"**{tc['test_name']}** ({tc['test_type']})")
        if tc.get("description"):
            lines.append(tc["description"])
        lines.append("")
        lines.append(f"```{lang}")
        lines.append(tc.get("code", ""))
        lines.append("```")
        lines.append("")
    lines.append("---")
    lines.append("_Generated by TestAgent_")
    return "\n".join(lines)
