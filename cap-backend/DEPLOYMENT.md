# Ticket-CAP — BTP Cloud Foundry Deployment

This guide covers deploying the application to SAP BTP using
**Multi-Target Application (MTA)** packaging. The application is wired for
XSUAA by default so local and deployed runtimes use the same authentication
model. Jest tests use a test-only dummy-auth profile.

## Architecture on BTP

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       Browser (https://...)                              │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ OAuth2 redirect for protected routes
                                 ▼
              ┌──────────────────────────────────┐
              │       ticket-cap-approuter       │  ← public route
              │  (@sap/approuter, xs-app.json)   │
              └────┬──────────────────────────┬──┘
                   │ JWT (bearer)             │ static SPA
                   ▼                          │
         ┌──────────────────────┐             │
         │   ticket-cap-srv     │◀────────────┘
         │   (@sap/cds + xssec) │
         └──┬───────────────┬───┘
            │               │
            ▼               ▼
     ┌─────────────┐ ┌─────────────┐
     │  HANA HDI   │ │   XSUAA     │
     │  container  │ │  service    │
     └─────────────┘ └─────────────┘
```

| Component | What it is | Where the config lives |
|---|---|---|
| **Approuter** | OAuth2 entry point + reverse proxy + static SPA host | `app/approuter/xs-app.json` |
| **CAP backend** | Node.js OData v4 service, hooks, policies | `srv/**` |
| **HANA HDI** | Cloud database for the CAP schema | `db/**` |
| **XSUAA** | Issues JWTs, defines the 6 business roles | `xs-security.json` |
| **MTA descriptor** | Glues everything together for `cf deploy` | `mta.yaml` |

> All paths above are relative to `cap-backend/`, which is the project root for
> the MTA build. There is no separate "approuter folder at the repo root" —
> everything is under `cap-backend/`.

## Prerequisites (one-time)

1. **Install the Cloud Foundry CLI**
   ```bash
   # Windows
   choco install cloudfoundry-cli
   # macOS
   brew install cloudfoundry/tap/cf-cli@8
   ```

2. **Install the MTA build tool**
   ```bash
   npm install -g mbt
   ```

3. **Install the MTA deploy plugin**
   ```bash
   cf install-plugin multiapps
   ```

4. **Log in to your BTP space**
   ```bash
   cf login -a https://api.cf.eu10.hana.ondemand.com
   # pick your org / space
   ```

## Build and deploy

From `cap-backend/` (the MTA project root):

```bash
# 1. Build the .mtar archive (runs npm + cds build under the hood)
mbt build

# 2. Deploy to Cloud Foundry
cf deploy mta_archives/ticket-cap_1.0.0.mtar
```

The first deploy creates three services in your space:

- `ticket-cap-db` (HANA HDI container)
- `ticket-cap-uaa` (XSUAA service)
- Three apps: `ticket-cap-srv`, `ticket-cap-db-deployer`, `ticket-cap-approuter`

The approuter URL is the public entry point — open it in a browser to trigger
the XSUAA OAuth flow.

### Environment variables (after the first deploy)

Some features read configuration from the backend app's environment. Set them
once with `cf set-env` and restage:

```bash
# Optional overrides (defaults shown)
cf set-env ticket-cap-srv CLEANUP_CRON "0 2 * * *"          # orphan-attachment purge schedule
cf set-env ticket-cap-srv ATTACHMENT_MAX_SIZE_MB 25          # upload size limit
cf set-env ticket-cap-srv ATTACHMENT_ALLOWED_MIME_TYPES "pdf,png,jpg,jpeg,docx,xlsx,txt"

cf restage ticket-cap-srv
```

## Assigning roles to users (one-time per user)

1. Open the **BTP Cockpit → your subaccount → Security → Role Collections**.
2. You'll see 6 collections pre-created by `xs-security.json`:
   - `TicketCap_Admin`
   - `TicketCap_Manager`
   - `TicketCap_ProjectManager`
   - `TicketCap_DevCoordinator`
   - `TicketCap_ConsultantTechnique`
   - `TicketCap_ConsultantFonctionnel`
3. Edit a collection → **Users** tab → add the user's IdP email.
4. The user logs out and back in; the new role takes effect.

## Local auth model

| File | Runtime default | Production override |
|---|---|---|
| `package.json` | `auth: xsuaa`, `db: sqlite` | `[production]: { auth: xsuaa, db: hana-cloud }` |
| `srv/_shared/auth/request-context.js` | Reads CAP/XSUAA user context from `req.user` | Same role mapping, backed by BTP XSUAA |
| Tests | `[test]` profile uses dummy auth plus explicit `x-test-user-*` headers | n/a |

CAP activates the `[production]` profile when `NODE_ENV=production` (the
Cloud Foundry buildpack sets this automatically). For local runtime testing,
bind XSUAA credentials or run through the approuter. `npm test` keeps using the
test profile and does not need a live XSUAA service.

## Re-deploys and updates

```bash
mbt build && cf deploy mta_archives/ticket-cap_1.0.0.mtar
```

The HDI deployer applies schema diffs incrementally — existing data is
preserved between deploys (unlike the local `cds deploy --to sqlite` which
re-seeds from CSVs).

## Tearing it down

```bash
cf undeploy ticket-cap --delete-services --delete-service-keys
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| 401 on every request after login | The user has no role collection assigned — see "Assigning roles" above |
| `403 insufficient_scope` from the backend | The role-collection name in BTP doesn't map to a scope defined in `xs-security.json`. Compare `XSUAA_SCOPE_TO_ROLE` in `request-context.js` |
| Approuter shows "no destinations" | `mta.yaml` `requires: - name: srv-api` is misconfigured; check the `provides` block on `ticket-cap-srv` |
| HANA deploy fails with `403` | The space doesn't have a HANA Cloud instance bound; create one in BTP Cockpit before `cf deploy` |
