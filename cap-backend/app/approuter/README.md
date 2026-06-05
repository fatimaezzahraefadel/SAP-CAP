# Ticket-CAP Approuter

This folder is the SAP Approuter module for the Ticket-CAP application.

It is responsible for:

- XSUAA OAuth flow for protected routes.
- Proxying backend routes to the CAP service destination named `srv-api`.
- Serving the built React SPA from `resources/`.

## Files

- `package.json`: Approuter runtime dependency and start command.
- `xs-app.json`: Route rules for OData, attachments, CAP system endpoints, static assets, and SPA fallback.
- `default-env.json`: Local-only placeholder destinations for running the approuter outside BTP.
- `resources/`: Generated frontend build output copied from `app/dist`.

## Build Flow

The frontend source lives in `app/frontend`. Its Vite build writes to `app/dist`.

Run from the project root:

```powershell
npm run build
```

That command builds the frontend, syncs `app/dist` into `app/approuter/resources`,
and then runs `cds build --production`.

Generated files in `resources/` are ignored by Git. The empty folders are kept so
the intended module shape is visible in the source tree.
