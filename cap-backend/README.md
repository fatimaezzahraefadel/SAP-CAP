# CAP-SAP Performance Dashboard

Monolithic SAP CAP application with a React frontend for managing projects,
tickets, WRICEF objects, time tracking, evaluations, and dashboard data.

## Project Structure

- `db/`: CAP domain model and CSV seed data.
- `srv/`: OData v4 service definitions, handlers, repositories, and domain services.
- `test/`: Jest backend integration tests.
- `app/frontend/`: Vite, React, and TypeScript frontend source.
- `app/dist/`: generated frontend production build output.
- `app/approuter/`: SAP Approuter module for BTP deployment.
- `scripts/`: local development and build helper scripts.
- `mta.yaml`: BTP Multi-Target Application descriptor.
- `xs-security.json`: XSUAA scopes, roles, and role collections.

Generated folders such as `gen/`, `app/dist/`, and
`app/approuter/resources/` are not source. Rebuild them instead of editing them
manually.

## Quick Start

Run backend commands from this directory.

```powershell
npm install
npm run watch
```

Run the frontend dev server separately when needed.

```powershell
cd app\frontend
npm install
npm run dev
```

For a one-command local run:

```powershell
npm run dev:all
```

## Build

```powershell
npm run build
```

The build command:

1. Builds the frontend into `app/dist`.
2. Syncs `app/dist` into `app/approuter/resources`.
3. Runs `cds build --production` to generate `gen/`.

## Checks

```powershell
npm test
npm run lint
cd app\frontend
npm run check
```

## Notes

- The backend is pinned to Node 20 in `.node-version`.
- OData services are exposed under `/odata/v4`.
- Local development uses mocked auth and SQLite.
- Production deployment uses XSUAA and HANA via the `[production]` CAP profile.
