# XSUAA Authentication Change Log

This note summarizes the source-control changes made during the BTP deployment/authentication cleanup.

## Original Problem

The app had two authentication models mixed together:

- The approuter and CAP production runtime were configured for XSUAA.
- The React frontend still showed a custom email/password login and quick access buttons.
- The frontend stored an app-issued demo JWT and sent it to protected OData APIs.
- In Cloud Foundry, the approuter/CAP stack expected an XSUAA token, so protected calls such as `Users`, `Projects`, `Tickets`, `Notifications`, and `AuditLogs` returned `401 Unauthorized`.

There was also a separate XSUAA redirect problem:

- The deployed approuter URL used the `cfapps.us10-001.hana.ondemand.com` landscape.
- The XSUAA redirect URI allowlist did not include that host pattern.
- This caused: `redirect_uri does not match the configuration`.

## Fix Summary

The app was moved to the proper SAP/BTP model:

- XSUAA owns browser login.
- The approuter protects the SPA and OData routes.
- The approuter forwards the XSUAA token to CAP.
- CAP maps the authenticated SAP user's XSUAA role scope to the internal app role.
- The frontend no longer offers quick access or password-based demo login.

## Main Source Changes

### Approuter

`app/approuter/xs-app.json`

- Keeps `/odata/v4/*`, `/attachments/*`, and technical backend routes protected with `authenticationType: "xsuaa"`.
- Static frontend assets remain public where appropriate.
- The SPA entry routes remain XSUAA-protected.

### MTA Descriptor

`mta.yaml`

- Keeps `forwardAuthToken: true` for the `srv-api` destination so CAP receives the XSUAA token.
- Adds redirect URI configuration for:
  - `https://*.cfapps.eu10.hana.ondemand.com/**`
  - `https://*.cfapps.us10.hana.ondemand.com/**`
  - `https://*.cfapps.us10-001.hana.ondemand.com/**`

### XSUAA Descriptor

`xs-security.json`

- Adds the `us10-001` redirect URI pattern.
- Keeps the role templates/collections for:
  - `TicketCap_Admin`
  - `TicketCap_Manager`
  - `TicketCap_ProjectManager`
  - `TicketCap_DevCoordinator`
  - `TicketCap_ConsultantTechnique`
  - `TicketCap_ConsultantFonctionnel`

### Backend Auth

`srv/auth/auth.service.cds`

- Adds `currentUser()` to `UserService`.
- Removes the quick access service action.

`srv/auth/auth.impl.js`

- Registers the new `currentUser` action.
- Removes the quick access handler.

`srv/auth/auth.domain.service.js`

- Supports production XSUAA mode without requiring `MOCK_JWT_SECRET`.
- Uses `getRequestContext(req)` to read the authenticated SAP/XSUAA principal.
- Implements `currentUser(req)`:
  - reads the XSUAA-derived role,
  - optionally matches the SAP user email to a local active user,
  - otherwise falls back to the active seeded user for that role,
  - returns the app's `AuthUser` shape to the frontend.

`srv/_shared/auth/request-context.js`

- Maps XSUAA scope tails to internal roles:
  - `Admin` -> `ADMIN`
  - `Manager` -> `MANAGER`
  - `ProjectManager` -> `PROJECT_MANAGER`
  - `DevCoordinator` -> `DEV_COORDINATOR`
  - `ConsultantTechnique` -> `CONSULTANT_TECHNIQUE`
  - `ConsultantFonctionnel` -> `CONSULTANT_FONCTIONNEL`
- Supports `req.user.roles`, `req.user.hasRole(...)`, and CAP-style `req.user.is(...)`.

`srv/auth/auth.repo.js`

- Adds lookup by role for resolving the active local app profile from an XSUAA role.
- Removes the unused quick access user listing.

`srv/shared/services/audit.js`

- Removes quick access from the audit skip list because that action no longer exists.

### Frontend Auth

`app/frontend/src/app/context/AuthContext.tsx`

- Removes localStorage demo session restoration.
- Removes custom token login behavior.
- Loads the authenticated SAP user by calling `AuthAPI.currentUser()`.
- Clears old demo auth storage keys.
- Logs out through `/do/logout`.

`app/frontend/src/app/pages/Login.page.tsx`

- Removes:
  - email input,
  - password input,
  - quick access users,
  - direct-login UI.
- Replaces them with a SAP/XSUAA session screen and a retry button.

`app/frontend/src/app/services/odata/authApi.ts`

- Adds `currentUser()`.
- Removes the quick access API helper.
- Leaves the old `authenticate()` helper for backward compatibility/tests, but the frontend login flow no longer uses it.

`app/frontend/src/app/services/odata/core.ts`

- Restores normal behavior: it only sends `Authorization` if a frontend token is explicitly configured.
- In XSUAA deployment, the browser relies on the approuter session and does not manage its own bearer token.

`app/frontend/src/app/components/layout/TopBar.tsx`

- Notification loading no longer depends on a frontend-managed OData token.
- It now works with the XSUAA/approuter session.

`app/frontend/src/locales/en/translation.json`
`app/frontend/src/locales/fr/translation.json`

- Removes quick access/direct login copy.
- Adds SAP/XSUAA session copy.

## Tests Added/Updated

`test/auth.domain.service.test.js`

- Verifies production XSUAA mode does not require `MOCK_JWT_SECRET`.
- Verifies `currentUser()` maps an XSUAA role to an active local app user.

`test/request-context.test.js`

- Adds coverage for CAP-style `req.user.is(...)` role checks.

## Validation Run

The following checks passed after the changes:

```powershell
npm test -- test/auth.domain.service.test.js test/request-context.test.js --runInBand --silent
npm run check --prefix app/frontend
npm run build
npm run lint
npx --yes yaml@2 valid mta.yaml
```

`npm run lint` still reports the same existing warnings unrelated to this auth change.

## Deployment Notes

After deploying, the SAP/BTP user must be assigned exactly one appropriate Ticket-CAP role collection, or at least one role collection that maps to a supported role:

- `TicketCap_Admin`
- `TicketCap_Manager`
- `TicketCap_ProjectManager`
- `TicketCap_DevCoordinator`
- `TicketCap_ConsultantTechnique`
- `TicketCap_ConsultantFonctionnel`

Then rebuild and redeploy:

```powershell
mbt build
cf deploy mta_archives\ticket-cap_1.0.0.mtar
```

After deployment, hard refresh the browser so the old frontend bundle is not reused from cache.
