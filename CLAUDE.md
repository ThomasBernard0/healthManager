# healthManager — CLAUDE.md

## Stack

| Layer    | Tech                                                                                  |
| -------- | ------------------------------------------------------------------------------------- |
| Backend  | NestJS 12 (ESM, TypeScript), Prisma 7 + `@prisma/adapter-pg`, PostgreSQL               |
| API docs | `@nestjs/swagger` → OpenAPI at `/api/docs` (JSON: `/api/docs-json`)                   |
| Frontend | React 19, Vite 8, TypeScript, React Router 7                                          |
| Client   | Orval (axios-functions) generated from `frontend/openapi.json`                        |
| Tooling  | npm, oxlint, Vitest (both apps), Prettier (backend)                                   |
| Hosting  | Railway project **healthManager**: service `app` + `Postgres`; GitHub Actions CI      |

Production is **one service**: Nest serves `/api/*` and the built SPA from `frontend/dist`
(unknown non-API paths fall back to `index.html`, so deep links work). The frontend calls the API
on the same origin, so `VITE_API_URL` is empty in production.

## Folder structure

```
backend/                 NestJS API
  prisma/                schema.prisma + migrations/
  prisma7.config.ts      Prisma CLI config (schema path, DATABASE_URL)
  src/
    main.ts              bootstrap: prefix, pipes, CORS, Swagger, listen
    app.setup.ts         shared app config + OpenAPI document builder
    app.module.ts        root module (Config, ServeStatic, Prisma, domain modules)
    prisma/              PrismaModule (global) + PrismaService
    <domain>/            one module per domain: *.module.ts, *.controller.ts, *.service.ts, dto/
    scripts/             export-openapi.ts
    generated/prisma/    Prisma client (generated, gitignored)
  test/                  e2e tests (*.e2e-spec.ts)
frontend/                React SPA
  openapi.json           exported from backend (committed, never edit)
  orval.config.ts
  src/
    api/http.ts          axios instance + Orval mutator (base URL = VITE_API_URL)
    api/generated/       Orval output (committed, never edit)
    theme/               design tokens — single source for colors/spacing/typography
    pages/               route components
design/<feature>/        Claude Design handoff bundles (read-only)
docs/specs/              feature specs
railway.json             Railway build/start/healthcheck
.github/workflows/ci.yml CI (backend + frontend jobs)
```

## Commands

Root:

| Command                 | What it does                                                          |
| ----------------------- | --------------------------------------------------------------------- |
| `npm run build`         | `npm ci` both apps, `prisma generate` + `nest build`, `vite build`    |
| `npm start`             | `prisma migrate deploy` then start Nest (used by Railway)             |
| `npm run api:sync`      | `export:openapi` (backend) + `generate-client` (frontend)             |
| `npm run lint` / `test` | lint / unit tests for both apps                                       |
| `npm run dev:backend` / `dev:frontend` | dev servers                                            |

Backend (`cd backend`):

| Command                                  | What it does                                                 |
| ---------------------------------------- | ------------------------------------------------------------ |
| `npm run start:dev`                      | watch mode on :3001                                          |
| `npm run build`                          | `prisma generate && nest build`                              |
| `npm run lint` / `npm test` / `npm run test:e2e` | oxlint / Vitest unit / Vitest e2e                   |
| `npm run export:openapi`                 | build + write `../frontend/openapi.json` (no DB needed)      |
| `npm run prisma:migrate -- --name <x>`   | create + apply a dev migration (needs a DB)                  |
| `npm run prisma:generate`                | regenerate the Prisma client                                 |

Frontend (`cd frontend`):

| Command                    | What it does                                     |
| -------------------------- | ------------------------------------------------ |
| `npm run dev`              | Vite dev server on :5173                         |
| `npm run build`            | type-check + production build to `dist/`         |
| `npm run lint` / `npm test`| oxlint / Vitest (jsdom)                          |
| `npm run generate-client`  | regenerate `src/api/generated` from openapi.json |

## Conventions

- **Backend: one NestJS module per domain** (`src/<domain>/`), with its controller, service and `dto/`.
  Data access only through the injected `PrismaService`.
- **DTOs are fully decorated for Swagger** (`@ApiProperty` / `@ApiPropertyOptional` on every field)
  and validated with `class-validator`; controllers declare responses (`@ApiOkResponse({ type })`, …)
  and `@ApiTags('<domain>')`. If it isn't in the OpenAPI spec, the frontend can't use it.
- The global `ValidationPipe` uses `whitelist`, `forbidNonWhitelisted`, `transform`: unknown fields are rejected.
- Operation IDs are `<Controller>_<method>` → Orval function `<controller><Method>()`
  (e.g. `HealthController.check` → `healthCheck()`). Name controller methods accordingly.
- Backend is ESM: relative imports end in `.js`.
- **Frontend only talks to the API through the generated client** (`src/api/generated`).
  No hand-written `axios`/`fetch` calls to the API; the only hand-written API file is `src/api/http.ts`.
- **No hard-coded colors, spacing, font sizes, radii or shadows outside `src/theme`.**
  Use CSS variables (`var(--color-primary)`, `var(--space-md)`, …) in CSS modules, or `tokens` in TS.
  New values are added to `src/theme/tokens.ts` first.
- Schema changes always go through a Prisma migration committed in `backend/prisma/migrations/`.

## Feature workflow

1. **Design handoff** lands in `design/<feature>/` (Claude Design bundle — read-only).
2. **Spec**: move/write the spec to `docs/specs/<feature>.md`.
3. **Branch**: `git switch -c feat/<feature>` from an up-to-date `main`.
4. **Backend**: Prisma model + migration (`npm run prisma:migrate -- --name <feature>`),
   domain module, decorated DTOs, service, controller, unit/e2e tests.
5. **Sync the contract**: `npm run api:sync` (= `export:openapi` + `generate-client`); commit
   `frontend/openapi.json` and `frontend/src/api/generated/`.
6. **Frontend**: pages/components using the generated client and theme tokens
   (transcribe any new tokens from the handoff into `src/theme/tokens.ts`).
7. **Verify**: `npm run lint`, builds and tests in both apps (CI runs the same, plus a check that the
   OpenAPI spec and generated client are not stale).
8. **PR to `main`** (`gh pr create`), Conventional Commit title; CI must pass.
9. **Merge** (squash).
10. **Railway auto-deploys** `main` (build → `prisma migrate deploy` → start → healthcheck `/api/health`).
11. **Check the deploy**: `railway logs --build` / `railway logs` (service `app`) and hit `/api/health`.

## Environment variables

Backend (`backend/.env`, see `backend/.env.example`):

| Variable       | Required | Default                 | Notes                                                        |
| -------------- | -------- | ----------------------- | ------------------------------------------------------------ |
| `DATABASE_URL` | yes      | —                       | PostgreSQL URL. Railway: `${{Postgres.DATABASE_URL}}`        |
| `PORT`         | no       | `3001`                  | Railway injects it                                           |
| `FRONTEND_URL` | no       | `http://localhost:5173` | CORS allowed origin                                          |
| `NODE_ENV`     | no       | —                       | `production` on Railway                                      |

Frontend (`frontend/.env`, see `frontend/.env.example`; read at **build** time):

| Variable       | Required | Notes                                                                      |
| -------------- | -------- | -------------------------------------------------------------------------- |
| `VITE_API_URL` | no       | API origin, e.g. `http://localhost:3001` in dev. Empty/unset in production (same origin) |

## Rules

- **Never commit to `main` directly.** Always a `feat/…`, `fix/…`, `chore/…` branch + PR (`main` is protected).
- **Conventional Commits** for commit messages and PR titles (`feat: …`, `fix: …`, `chore: …`, `docs: …`, `refactor: …`, `test: …`, `ci: …`).
- **Never edit `design/`** — handoff bundles are read-only.
- **Never edit the generated client** (`frontend/src/api/generated/`) or `frontend/openapi.json` by hand — change the backend, then `npm run api:sync`.
- Never commit `.env` files or secrets.
