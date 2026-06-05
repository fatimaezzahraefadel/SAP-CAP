# Ticket-CAP Approuter

SAP Approuter module. On BTP it sits in front of the CAP backend and the SPA
and does three things:

1. **OAuth2 via XSUAA** — every protected route triggers a login redirect; the
   approuter then stores the session and forwards the bearer JWT to the
   backend on subsequent calls.
2. **Reverse proxy** — backend routes (`/odata/v4/*`, `/attachments/*`, `/-/*`)
   are forwarded to the `srv-api` destination wired up in `mta.yaml`.
3. **Static SPA host** — the built React app sits in `resources/` and is
   served from the same origin (no CORS needed).

## Files

| File | Purpose | Tracked in git? |
|---|---|---|
| `package.json` | `@sap/approuter` dependency, `npm start` entry point | ✓ |
| `xs-app.json` | Route table — backend proxy, static assets, SPA fallback | ✓ |
| `default-env-template.json` | Template you copy for local approuter testing | ✓ |
| `default-env.json` | Local-only overrides — never commit, never deploy | ✗ (gitignored) |
| `README.md` | This file | ✓ |
| `resources/` | Generated SPA bundle (`npm run build` populates it) | ✗ (gitignored) |

## Route table (xs-app.json)

| Pattern | Handler | Auth | Notes |
|---|---|---|---|
| `/odata/v4/*` | proxy → `srv-api` | xsuaa | OData API |
| `/attachments/*` | proxy → `srv-api` | xsuaa | Public file download route |
| `/-/*` | proxy → `srv-api` | xsuaa | CAP system endpoints |
| `/assets/*` | static | none | Hashed JS/CSS — cached 1 year, immutable |
| `/locales/*` | static | none | i18n bundles — cached 1 hour |
| `*.png \| .jpg \| .svg \| .woff2 \| ...` | static | none | Images/fonts — cached 1 week |
| `/index.html` | static | xsuaa | Never cached — every deploy is fresh |
| `/*` (catch-all) | → index.html | xsuaa | SPA fallback for client-side routes |

The cache split matters: hashed assets get a long TTL so the browser doesn't
re-fetch them, but the `index.html` shell is always re-fetched so a redeploy
picks up the new hashed asset URLs immediately.

## Build flow

The frontend source lives in `app/frontend`. Its Vite build writes to
`app/dist`. From `cap-backend/`:

```bash
npm run build
```

That command runs `npm run build:web && npm run sync:approuter && cds build --production`, which:

1. Builds the React SPA → `app/dist`
2. Copies `app/dist` → `app/approuter/resources` (`scripts/sync-approuter-resources.js`)
3. Runs `cds build --production` → `gen/srv` and `gen/db`

After that, `mbt build` packages everything into an `.mtar` archive ready for
`cf deploy`.

## Running the approuter locally (optional)

You normally don't need it locally — the Vite dev server + CAP `cds watch` is
faster. But if you want to test the OAuth path end-to-end:

```bash
# 1. Build the SPA + sync into resources
npm run build:web && npm run sync:approuter

# 2. Copy the template for local env
cp app/approuter/default-env-template.json app/approuter/default-env.json

# 3. Run the approuter (port 5000 by default)
cd app/approuter
npm install
npm start
```

The dummy XSUAA credentials in `default-env.json` short-circuit auth so the
approuter just forwards to `http://localhost:4004`. Useful for verifying
routing rules, not for testing real OAuth.
