import json
import os
import re

from anthropic import Anthropic

SYSTEM_PROMPT = (
    "You are an expert QA engineer. Given a code diff from a pull request, "
    "generate comprehensive test cases. For each changed function or feature, "
    "write unit tests and integration tests. Output as structured JSON with fields: "
    "test_name, test_type (unit/integration), description, code "
    "(the actual test code in the repo's language)."
)


def generate_test_cases(
    diff: str,
    pr_title: str = "",
    pr_body: str = "",
    *,
    use_ai: bool = True,
) -> list[dict]:
    """Generate test cases from a PR diff via Claude, with offline fallback."""
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if use_ai and api_key:
        try:
            return _generate_with_claude(diff, pr_title, pr_body, api_key)
        except Exception:
            # Fall through to offline so demos still work
            offline = _generate_offline(diff, pr_title)
            if offline:
                return offline
            raise

    return _generate_offline(diff, pr_title)


def _generate_with_claude(diff: str, pr_title: str, pr_body: str, api_key: str) -> list[dict]:
    client = Anthropic(api_key=api_key)

    user_message = (
        f"Pull request title: {pr_title}\n\n"
        f"Pull request description:\n{pr_body or '(none)'}\n\n"
        f"Code diff:\n```\n{diff[:100000]}\n```\n\n"
        "Return a JSON array of test case objects. "
        "Each object must have: test_name, test_type, description, code. "
        "Respond with only valid JSON, no markdown fences."
    )

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    text = message.content[0].text.strip()
    return _parse_test_cases(text)


def _generate_offline(diff: str, pr_title: str) -> list[dict]:
    """Heuristic tests so the product is demoable without an API key."""
    language = _detect_language(diff)
    symbols = _extract_symbols(diff)
    title_slug = re.sub(r"[^a-z0-9]+", "_", (pr_title or "change").lower()).strip("_") or "change"

    if language == "python":
        unit_code = _python_unit(symbols, title_slug)
        integration_code = _python_integration(symbols, title_slug)
    elif language == "typescript":
        unit_code = _ts_unit(symbols, title_slug)
        integration_code = _ts_integration(symbols, title_slug)
    else:
        unit_code = _generic_unit(symbols, title_slug)
        integration_code = _generic_integration(symbols, title_slug)

    focus = ", ".join(symbols[:3]) if symbols else "the changed behavior"
    return [
        {
            "test_name": f"test_{title_slug}_happy_path",
            "test_type": "unit",
            "description": f"Offline-generated unit test covering {focus}.",
            "code": unit_code,
        },
        {
            "test_name": f"test_{title_slug}_edge_cases",
            "test_type": "integration",
            "description": f"Offline-generated integration test for {pr_title or 'this PR'}.",
            "code": integration_code,
        },
    ]


def _detect_language(diff: str) -> str:
    if re.search(r"\.(py)\b", diff) or "def " in diff:
        return "python"
    if re.search(r"\.(tsx?|jsx?)\b", diff) or "export function" in diff or "=>" in diff:
        return "typescript"
    return "generic"


def _extract_symbols(diff: str) -> list[str]:
    patterns = [
        r"^\+\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)",
        r"^\+\s*(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)",
        r"^\+\s*export\s+function\s+([a-zA-Z_][a-zA-Z0-9_]*)",
        r"^\+\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)",
    ]
    found: list[str] = []
    for line in diff.splitlines():
        for pattern in patterns:
            match = re.match(pattern, line)
            if match and match.group(1) not in found:
                found.append(match.group(1))
    return found


def _python_unit(symbols: list[str], slug: str) -> str:
    target = symbols[0] if symbols else "subject"
    return f'''def test_{slug}_happy_path():
    """Verifies {target} succeeds for a valid input."""
    # Arrange
    payload = {{"amount": 1000, "idempotency_key": "key-1"}}

    # Act
    result = {target}(**payload) if callable({target}) else payload

    # Assert
    assert result is not None
'''


def _python_integration(symbols: list[str], slug: str) -> str:
    target = symbols[0] if symbols else "endpoint"
    return f'''def test_{slug}_edge_cases(client):
    """Integration coverage for {target} failure paths."""
    missing = client.post("/resource", json={{}})
    assert missing.status_code in (400, 422)

    duplicate = client.post("/resource", json={{"idempotency_key": "dup"}})
    again = client.post("/resource", json={{"idempotency_key": "dup"}})
    assert duplicate.status_code == again.status_code
'''


def _ts_unit(symbols: list[str], slug: str) -> str:
    target = symbols[0] if symbols else "subject"
    return f'''describe("{slug} happy path", () => {{
  it("handles a valid call to {target}", async () => {{
    const result = await {target}({{ id: "user-1" }} as any);
    expect(result).toBeDefined();
  }});
}});
'''


def _ts_integration(symbols: list[str], slug: str) -> str:
    target = symbols[0] if symbols else "handler"
    return f'''describe("{slug} edge cases", () => {{
  it("rejects invalid input for {target}", async () => {{
    await expect({target}(null as any)).rejects.toBeDefined();
  }});
}});
'''


def _generic_unit(symbols: list[str], slug: str) -> str:
    focus = symbols[0] if symbols else "changed_symbol"
    return f"""# test_{slug}_happy_path
# Assert that {focus} behaves correctly for the primary success path.
assert True  # replace with real assertions for your stack
"""


def _generic_integration(symbols: list[str], slug: str) -> str:
    focus = symbols[0] if symbols else "changed_symbol"
    return f"""# test_{slug}_edge_cases
# Assert error handling around {focus} (not found, unauthorized, conflict).
assert True  # replace with real assertions for your stack
"""


def _parse_test_cases(text: str) -> list[dict]:
    """Parse Claude's response into a list of test case dicts."""
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence_match:
        text = fence_match.group(1).strip()

    data = json.loads(text)

    if isinstance(data, dict):
        for key in ("test_cases", "tests", "cases"):
            if key in data and isinstance(data[key], list):
                data = data[key]
                break
        else:
            data = [data]

    results = []
    for item in data:
        if not isinstance(item, dict):
            continue
        results.append(
            {
                "test_name": item.get("test_name", "unnamed_test"),
                "test_type": item.get("test_type", "unit"),
                "description": item.get("description", ""),
                "code": item.get("code", ""),
            }
        )
    return results
