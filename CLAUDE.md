# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent & Tool Priority

When performing any task, apply this priority order:
1. **everything-claude-code (ECC) skills/agents** — use these first whenever they add quality (planning, code review, TDD, security, architecture, etc.)
2. **Other specialized agents/tools** — if no ECC tool fits, check for other agents that improve over base behavior
3. **Base Claude** — only if no specialized tool applies

## Commands

### Frontend (Next.js — `frontend/`)
```bash
npm run dev       # Start dev server on port 3000
npm run build     # Production build
npm run lint      # ESLint
```

### Backend (FastAPI — `backend/`)
```bash
# Run from project root, inside the Python venv
uvicorn backend.main:app --reload --port 8008 --host 0.0.0.0

pip install -r backend/requirements.txt
```

No test suite exists yet.

## Deployment

This app runs across two machines connected via **Tailscale**:

- **Frontend** — runs on the dev machine (this device). Edit and run locally with `npm run dev`.
- **Backend** — runs on the home server **nukterrae**. To deploy backend changes, commit and push to `main`; the server pulls and restarts the service manually (no CI/CD).

The frontend's `NEXT_PUBLIC_API_URL` points to nukterrae's Tailscale IP on port 8008.

## Product Goal

Provide the most useful Clash Royale coaching experience possible while remaining **free to use** — rely only on free-tier API quotas (Clash Royale API, Gemini free tier). Avoid paid services or usage patterns that would require billing.

## Environment Setup

**Frontend (`frontend/.env.local`):**
```
NEXT_PUBLIC_API_URL=http://<backend-host>:8008
```

**Backend (`backend/.env`):**
```
CR_API_KEY=<Clash Royale API key>
PLAYER_TAG=<player tag, e.g. #YY8VGYLJC>
GEMINI_API_KEY=<Google Generative AI API key>
```

## Architecture

This is a two-process app: a **Next.js frontend** (port 3000) and a **FastAPI backend** (port 8008). There is no database — all data is fetched live per request.

### Backend Data Flow

```
Request → main.py route
  → cr_api.py       (fetch player profile + battle history from Clash Royale API)
  → analyzer.py     (heuristic scoring: card usage frequency, win rates)
  → gemini.py       (AI prompts to Gemini 2.5 Flash with Google Search grounding)
  → Response
```

**Four endpoints:**
- `GET /player` — player profile & card collection
- `GET /upgrades` — upgrade priority list + AI narrative advice
- `GET /decks` — recent decks + AI-suggested meta decks (structured JSON via Pydantic schema)
- `GET /coach/{deck_index}` — per-deck coaching as free-form Markdown

**AI integration in `gemini.py`:**
- `ask_gemini_json()` — returns structured data validated against a Pydantic schema (`BestDecksResponse`)
- `ask_gemini()` — returns free-form Markdown for coaching narratives
- Google Search grounding is enabled for live meta awareness

### Frontend Structure

```
frontend/app/
├── page.tsx         # Dashboard: player stats + card collection grid
├── decks/page.tsx   # Best decks + per-deck AI coaching
├── upgrades/page.tsx # Upgrade priorities + AI advice
└── utils/levels.ts  # Card level conversion (exp level → card level)
```

Pages fetch from `NEXT_PUBLIC_API_URL` directly — no API routes in Next.js.

### Key Configuration

- `next.config.ts` — image domain `api-assets.clashroyale.com` is allowlisted
- `tsconfig.json` — path alias `@/*` maps to `frontend/` root
- Backend CORS is open (`allow_origins=["*"]`)
- Tailwind v4 with custom CSS variables for the dark gaming theme (defined in `globals.css`)
