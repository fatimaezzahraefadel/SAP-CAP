# Ticket-CAP Approuter

The SAP Approuter is the public entry point of the application on BTP Cloud
Foundry. It does three things:

1. **Authentication** — every protected route triggers an OAuth2 redirect to
   XSUAA (which in turn uses IAS or the SAP ID service). After login the user's
   roles arrive as a JWT bearer token.
2. **Reverse proxy** — `/odata/v4/*`, `/attachments/*` and `/-/*` are forwarded
   to the CAP backend (destination `srv-api`, wired in `mta.yaml`). The JWT is
   forwarded so `@sap/xssec` on the backend can validate scopes.
3. **Static hosting** — the React SPA built into `resources/` is served from
   the same origin, so the browser never needs CORS for `/odata/v4/*`.

## Routes (xs-app.json)

| Pattern | Destination / dir | Auth | Notes |
|---|---|---|---|
| `/odata/v4/*` | `srv-api` (backend) | xsuaa | OData API |
| `/attachments/*` | `srv-api` (backend) | xsuaa | File download route |
| `/-/*` | `srv-api` (backend) | xsuaa | CAP system endpoints |
| `*.js / *.css / *.png / ...` | `resources/` | none | SPA static assets |
| `/*` (catch-all) | `resources/index.html` | xsuaa | SPA shell — kicks off the OAuth flow |

## Local development

You do **not** need the approuter locally. Run the backend and the Vite dev
server directly:

```bash
# Terminal 1 — backend (mocked auth)
cd cap-backend && npm run watch

# Terminal 2 — frontend
cd cap-backend/app/frontend && npm run dev
```

The approuter only matters on BTP, where it bridges the public internet, the
XSUAA service, and the internal backend route.

## Build

The `mta.yaml` build-parameters copy `cap-backend/app/dist/` into
`approuter/resources/` so the SPA travels with the approuter container.
