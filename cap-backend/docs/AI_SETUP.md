# AI Dispatch — Setup Guide

The **AI Dispatch** feature recommends the 5 best technical consultants to
assign to a ticket. It analyses the ticket (title, description, nature, module,
complexity, priority) together with each candidate's skills, availability and
ticket history, and returns a ranked list with per-factor scores and a short
explanation.

- **Backend**: `srv/ai/` — the `recommendAssignees` action on `TicketService`,
  calling [OpenRouter](https://openrouter.ai) (Gemini 2.5 Flash by default).
- **Frontend**: *AI Dispatch* page (Project Manager and Dev Coordinator menus).
- **Fallback**: if the AI is unreachable or misconfigured, the UI silently
  falls back to a deterministic scoring algorithm
  (`app/frontend/src/app/services/aiRecommender.ts`) — the feature always works,
  the AI only makes it smarter.

---

## 1. Get an OpenRouter API key

1. Create an account at <https://openrouter.ai>.
2. Add a few dollars of credit (Gemini 2.5 Flash costs a fraction of a cent
   per recommendation).
3. Go to **Keys** → **Create Key** and copy the `sk-or-v1-...` value.

> **Never commit the key.** `.env` is gitignored; keep it there locally and use
> `cf set-env` on BTP. If a key ever lands in git history, revoke it on
> openrouter.ai and create a new one.

## 2. Local development

Create (or edit) `cap-backend/.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

CAP loads `.env` automatically. Then start the app as usual:

```powershell
cd cap-backend
npm run dev:all      # backend + frontend
```

Sign in, open **AI Dispatch** (Project Manager or Dev Coordinator role), pick an
unassigned ticket and click **Suggest**.

## 3. Production (SAP BTP / Cloud Foundry)

Set the key on the backend app once, after the first deploy:

```powershell
cf set-env ticket-cap-srv OPENROUTER_API_KEY sk-or-v1-your-key-here
cf restage ticket-cap-srv
```

Without the key the rest of the app is unaffected — only the AI endpoint
returns an error, and the UI falls back to the deterministic recommender.

## 4. Optional configuration

| Variable | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | *(required)* | OpenRouter API key |
| `AI_DISPATCH_MODEL` | `google/gemini-2.5-flash` | Any OpenRouter model id |
| `AI_DISPATCH_TIMEOUT_MS` | `15000` | Abort the LLM call after this delay |
| `AI_DISPATCH_REFERER` | `https://ticket-cap.local` | Attribution header sent to OpenRouter |

## 5. Behaviour and access

- Only staff roles can call the endpoint: **ADMIN, MANAGER, PROJECT_MANAGER,
  DEV_COORDINATOR**. Consultants get a 403 (and cannot spend LLM tokens).
- Explanations follow the caller's UI language (French or English).
- Responses are validated server-side: entries without a known user id are
  dropped by the UI, and every factor score is clamped to 0–100.
- Every call is audit-logged like any other action.

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `500 OPENROUTER_API_KEY is missing` | Key not set in the environment | Step 2 (local) or 3 (BTP) |
| `502 The AI service is unavailable` | OpenRouter down / key invalid / no credit | Check the key and your OpenRouter credit; details are in the server log |
| `502 The AI returned an unexpected format` | Model replied with non-JSON | Retry; consider a different `AI_DISPATCH_MODEL` |
| `403 Only staff can request AI dispatch recommendations` | Caller has a consultant role | Use a manager / PM / dev-coordinator account |
| Recommendations look generic, no explanation box | The heuristic fallback answered | The AI call failed — check the browser console and server log |
| Request hangs then fails after ~15 s | Model too slow | Raise `AI_DISPATCH_TIMEOUT_MS` or pick a faster model |

## 7. Testing without spending tokens

The JSON parsing/validation layer is covered by unit tests that never call the
network:

```powershell
cd cap-backend
npx jest test/ai.parse.test.js --config jest.config.cjs
```
