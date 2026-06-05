# Ticket-CAP — BTP Cloud Foundry Deployment

This guide covers deploying the application to SAP BTP using
**Multi-Target Application (MTA)** packaging. Local development is unchanged —
the production wiring lives in profile-gated config and never activates
unless you build with `--production`.

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
| **Approuter** | OAuth2 entry point + reverse proxy + static SPA host | `approuter/xs-app.json` |
| **CAP backend** | Node.js OData v4 service, hooks, policies | `cap-backend/srv/**` |
| **HANA HDI** | Cloud database for the CAP schema | `cap-backend/db/**` |
| **XSUAA** | Issues JWTs, defines the 6 business roles | `xs-security.json` |
| **MTA descriptor** | Glues everything together for `cf deploy` | `mta.yaml` |

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

From the repo root:

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

## How local dev stays unaffected

| File | Local default | Production override |
|---|---|---|
| `cap-backend/package.json` | `auth: "mocked"`, `db: sqlite` | `[production]: { auth: xsuaa, db: hana-cloud }` |
| `cap-backend/srv/_shared/auth/request-context.js` | Reads `req._authClaims` (mocked JWT) | Falls back to `req.user` (XSUAA scopes mapped to internal roles) |
| Tests | All use mocked auth — no XSUAA wiring needed | n/a |

CAP activates the `[production]` profile when `NODE_ENV=production` (the
Cloud Foundry buildpack sets this automatically). On your laptop, nothing
changes — `npm run watch` and `npm test` keep working exactly as before.

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
