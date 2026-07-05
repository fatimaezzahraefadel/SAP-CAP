# Repository Guidelines

## Project Structure & Module Organization
The repository root contains the application in `cap-backend/`. Work from that directory for most backend commands.

- `cap-backend/db/`: SAP CAP domain model and CSV seed data.
- `cap-backend/srv/`: OData v4 service definitions, handlers, repositories, and domain services.
- `cap-backend/test/`: Jest backend integration tests.
- `cap-backend/app/frontend/`: Vite, React, and TypeScript frontend.
- `cap-backend/app/frontend/src/app/features/`: feature modules such as `tickets`, `projects`, and `imputations`.
- `cap-backend/app/frontend/src/app/components/`: shared UI, layout, business, chart, and common components.
- `cap-backend/app/frontend/src/app/services/odata/`: frontend API adapters.

## Build, Test, and Development Commands
Install dependencies separately for backend and frontend:

- `cd cap-backend && npm install`: install CAP backend dependencies.
- `cd cap-backend/app/frontend && npm install`: install frontend dependencies.
- `cd cap-backend && npm run watch`: run CAP in watch mode.
- `cd cap-backend && npm run dev:all`: start backend and frontend together via `scripts/dev-all.js`.
- `cd cap-backend && npm run build`: build frontend, then run `cds build`.
- `cd cap-backend && npm test`: run backend Jest tests.
- `cd cap-backend && npm run lint`: lint backend JavaScript.
- `cd cap-backend/app/frontend && npm run check`: run TypeScript checks, Vite build, and Vitest.

## Coding Style & Naming Conventions
Use 2-space indentation and semicolons. Backend code is CommonJS JavaScript; frontend code is TypeScript/TSX with React hooks. Prefer `PascalCase.tsx` for React components, `camelCase.ts` for utilities, and existing backend names such as `ticket.impl.js`, `ticket.service.cds`, and `tickets.repo.js`. In frontend imports, use the established `@/app/...` alias where appropriate.

## Testing Guidelines
Backend tests use Jest and live in `cap-backend/test/` as `*.test.js`. Frontend tests use Vitest and are colocated as `*.test.ts` or `*.test.tsx`. Add tests for changed business rules, OData mappers/adapters, validation, route behavior, and attachment or persistence flows.

## Commit & Pull Request Guidelines
Recent history mostly uses Conventional Commit-style subjects, for example `feat(ticketing): ...` and `feat(attachments): ...`. Keep commits imperative and scoped when useful: `fix(tickets): reject invalid status transition`.

Pull requests should include a short scope summary, linked issue or ticket when available, test evidence, and screenshots or recordings for visible UI changes. Note any database, seed data, or environment configuration changes explicitly.

## Security & Configuration Tips
Do not commit secrets, generated build output, local SQLite files, or uploaded attachment data. Runtime authentication uses XSUAA; backend tests use test-only dummy auth configured in `cap-backend/package.json`. Verify production settings before deployment.
