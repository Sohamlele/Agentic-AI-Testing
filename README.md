# TestAgent

Agentic test-case generation for pull requests.

Sign in with GitHub → connect repos → open a PR → TestAgent reads the diff → Claude writes tests → results land in your dashboard and as a PR comment.

```
/
├── frontend/     Next.js 14 + Tailwind + shadcn/ui
├── backend/      FastAPI + SQLModel (SQLite) + Anthropic Claude
└── scripts/      Local helpers (seed, health, run)
```

## Features (Week 2)

- **GitHub OAuth** — Sign in, JWT session in httpOnly cookie, protected dashboard
- **Repo management** — connect/remove repos + webhook setup instructions
- **User-scoped dashboard** — stats, PR table, side panel with generated tests
- **GitHub webhook** — `pull_request` opened/synchronize → async generation
- **PR comments** — posts formatted test cases back onto the pull request
- **Generate from diff / samples** — still available when signed in
- **Offline fallback** — heuristic tests when `ANTHROPIC_API_KEY` is missing

## Quick start

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# fill GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, JWT_SECRET, etc.

# Terminal 1 — API
./scripts/dev.sh backend

# Terminal 2 — UI
./scripts/dev.sh frontend
```

- App: http://localhost:3000  
- API docs: http://localhost:8000/docs  

### Create a GitHub OAuth App

1. https://github.com/settings/developers → **New OAuth App**
2. Homepage URL: `http://localhost:3000`
3. Authorization callback URL: `http://localhost:8000/auth/github/callback`
4. Copy Client ID + Secret into `backend/.env`

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Yes (auth) | GitHub OAuth App |
| `GITHUB_OAUTH_REDIRECT_URI` | Yes | Must match OAuth App callback |
| `JWT_SECRET` | Yes | Signs session cookies |
| `FRONTEND_URL` | Yes | Post-login redirect |
| `PUBLIC_API_URL` | For webhooks | Webhook URL shown in UI |
| `ANTHROPIC_API_KEY` | No* | Claude generation |
| `GITHUB_WEBHOOK_SECRET` | For webhooks | HMAC validation |
| `GITHUB_TOKEN` | Optional | Fallback token if user token missing |
| `POST_PR_COMMENTS` | No | Default `true` for webhook PRs |
| `NEXT_PUBLIC_API_URL` | No | Frontend → API base |

\*Without Anthropic, offline generator still works for demos.

## Flow

1. Click **Sign in with GitHub** on the landing page  
2. Connect a repo under **Repositories** and add the webhook  
3. Open a PR → dashboard shows Pending → Generating → Done  
4. Click a PR row to view tests; GitHub gets a formatted comment  

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/github` | No | Start OAuth |
| `GET` | `/auth/github/callback` | No | OAuth callback → sets cookie |
| `GET` | `/auth/me` | Yes | Current user |
| `POST` | `/auth/logout` | No | Clear session cookie |
| `GET/POST/DELETE` | `/repos` | Yes | Manage connected repos |
| `GET` | `/repos/webhook-info` | Yes | Webhook URL + secret |
| `GET` | `/prs` | Yes | User's PR events |
| `GET` | `/test-cases/{id}` | Yes | Tests for one PR |
| `POST` | `/webhook/github` | Signature | GitHub webhook |
| `POST` | `/generate` | Yes | Paste a diff |
| `GET` | `/stats` | Yes | Dashboard stats |
| `GET` | `/health` | No | Health check |

## Local webhook testing

```bash
ngrok http 8000
```

Use the ngrok HTTPS URL as `PUBLIC_API_URL` (and in the GitHub webhook Payload URL). Keep `GITHUB_OAUTH_REDIRECT_URI` pointed at localhost unless you also tunnel OAuth.

## Notes

- Session cookie is httpOnly, SameSite=Lax, scoped to the API host
- Frontend calls use `credentials: "include"`
- SQLite only for the MVP; fine for a single-instance portfolio deploy
