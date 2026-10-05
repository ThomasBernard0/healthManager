# healthManager — CLAUDE.md

## Stack

| Layer    | Tech                                                                                  |
| -------- | ------------------------------------------------------------------------------------- |
| Backend  | NestJS 12 (ESM, TypeScript), Prisma 7 + `@prisma/adapter-pg`, PostgreSQL               |
| API docs | `@nestjs/swagger` → OpenAPI at `/api/docs` (JSON: `/api/docs-json`)                   |
| Frontend | React 19, Vite 8, TypeScript, React Router 7                                          |
| Client   | Orval (axios-functions) generated from `frontend/openapi.json`                        |
| PWA      | `vite-plugin-pwa` (manifest + Workbox service worker); scanner: `barcode-detector` (ZXing wasm) |
| Shared   | `shared/` (`@healthmanager/shared`): pure domain maths used by both apps              |
| Tooling  | npm, oxlint, Vitest (all packages), Prettier (backend)                                |
| Hosting  | Railway project **healthManager**: service `app` + `Postgres`; GitHub Actions CI      |

- Repo: https://github.com/ThomasBernard0/healthManager — `main` is protected (PR + `backend` and `frontend` checks required, admins included).
- Production: https://app-production-0f43.up.railway.app (Swagger at `/api/docs`).

Production is **one service**: Nest serves `/api/*` and the built SPA from `frontend/dist`
(unknown non-API paths fall back to `index.html`, so deep links work). The frontend calls the API
on the same origin, so `VITE_API_URL` is empty in production.

Every `/api` route except `/api/health` requires the `X-Access-Key` header (= `ACCESS_KEY`), else 401.
No login: each device asks for the key once (or opens `/?key=…`) and keeps it in localStorage.

## Folder structure

```
shared/                  @healthmanager/shared — pure TS, no deps (nutrients, calendar/weeks, goals)
  src/                   built to dist/ by each app's `postinstall` (linked as `file:../shared`)
backend/                 NestJS API
  data/ciqual/           CIQUAL 2020 foods (TSV, Licence Ouverte) + convert.mjs (from the ANSES XML)
  prisma/                schema.prisma + migrations/
  prisma7.config.ts      Prisma CLI config (schema path, DATABASE_URL)
  src/
    main.ts              bootstrap: prefix, pipes, CORS, Swagger, listen
    app.setup.ts         shared app config + OpenAPI document builder
    app.module.ts        root module (Config, ServeStatic, Prisma, domain modules)
    prisma/              PrismaModule (global) + PrismaService
    access/              global AccessGuard (X-Access-Key), @Public() for /api/health
    common/              NutrientsDto, Decimal helpers, date/time validators
    <domain>/            one module per domain: *.module.ts, *.controller.ts, *.service.ts, dto/
    foods/open-food-facts.client.ts   Open Food Facts lookup (server-side, 8 s timeout, 502 if unreachable)
    scripts/             export-openapi.ts, import-ciqual.ts (runs on every deploy, idempotent)
    generated/prisma/    Prisma client (generated, gitignored)
  test/                  e2e tests (*.e2e-spec.ts)
frontend/                React SPA
  openapi.json           exported from backend (committed, never edit)
  orval.config.ts
  vite.config.ts         React + PWA (manifest, service worker) + theme-color metas, colours from theme tokens
  public/                favicon.svg, icons/ (PWA + apple-touch PNGs, rendered from the same ring motif)
  src/
    api/http.ts          axios instance + Orval mutator (base URL = VITE_API_URL)
    api/generated/       Orval output (committed, never edit)
    theme/               design tokens (light + dark) — single source for colors/spacing/typography
    i18n/fr.ts           every UI string (French only)
    core/                app-wide: access (key prompt), format (fr-FR, Europe/Paris), ui/ (Sheet, Ring, …)
    modules/food/        Alimentation module: pages/, components/, scanner/, routes.ts (Sport/Finances later as modules/<name>)
design/                  Claude Design handoff mockups (read-only)
docs/specs/              feature specs
.railway/railway.ts      Railway infrastructure as code (services, Postgres, variables, build/start/healthcheck)
.github/workflows/ci.yml CI (backend + frontend jobs)
```

## Commands

Root:

| Command                 | What it does                                                          |
| ----------------------- | --------------------------------------------------------------------- |
| `npm run build`         | `npm ci` both apps, `prisma generate` + `nest build`, `vite build`    |
| `npm start`             | `prisma migrate deploy`, CIQUAL import, then start Nest (Railway)    |
| `npm run api:sync`      | `export:openapi` (backend) + `generate-client` (frontend)             |
| `npm run lint` / `test` | lint / unit tests (`shared`, backend, frontend)                       |
| `npm run dev:backend` / `dev:frontend` | dev servers                                            |

Backend (`cd backend`):

| Command                                  | What it does                                                 |
| ---------------------------------------- | ------------------------------------------------------------ |
| `npm run start:dev`                      | watch mode on :3001                                          |
| `npm run build`                          | `prisma generate && nest build`                              |
| `npm run lint` / `npm test` / `npm run test:e2e` | oxlint / Vitest unit / Vitest e2e                   |
| `npm run export:openapi`                 | build + write `../frontend/openapi.json` (no DB needed)      |
| `npx prisma migrate dev --name <x>`     | create + apply a dev migration (needs a DB)                  |
| `npm run prisma:generate`                | regenerate the Prisma client                                 |
| `node dist/scripts/import-ciqual.js`     | load CIQUAL foods into `Food` (new codes only; `--force` updates) |

Frontend (`cd frontend`):

| Command                    | What it does                                     |
| -------------------------- | ------------------------------------------------ |
| `npm run dev`              | Vite dev server on :5173                         |
| `npm run build`            | type-check + production build to `dist/`         |
| `npm run lint` / `npm test`| oxlint / Vitest (jsdom)                          |
| `npm run generate-client`  | regenerate `src/api/generated` from openapi.json |

Shared (`cd shared`): `npm test` (Vitest), `npm run build` (tsc → `dist/`; also run by each app's `postinstall`).
After editing `shared/src`, rebuild it so the apps see the change.

> **Windows/PowerShell:** the npm shim drops arguments after `--` (`npm run dev -- --port 5173` runs `vite 5173`).
> Call the tool directly instead: `npx vite --port 5173`, `npx prisma migrate dev --name <x>`.
> **Never write source files with `Add-Content`/`Set-Content`/`Out-File` in Windows PowerShell 5.1**: they use the ANSI
> code page (or a BOM), and the bundler on Linux CI rejects the result. Use an editor/the Edit tool, or
> `[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding $false))`.

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
- **Domain maths live in `shared/`** (nutrient sums, week = Monday→Monday in Europe/Paris, goal for a date)
  and are used by both apps — never re-implement them in a component or a service.
- Dates are Europe/Paris local `YYYY-MM-DD` strings (Postgres `date`), times are `HH:mm`. kcal are integers,
  macros are grams to 0.1 g (`Decimal`); round only in the UI.
- **Desktop (≥ 1024 px)**: same routes and data; components switch layout with `useIsDesktop()`.
  Sheets use search params (`?ajout=…`, back button closes them); Nouveau repas and Mon objectif are
  modal routes opened with `state.background` (`ModalFrame`: centred dialog on desktop, bottom sheet on mobile). After a change
  made in a dialog call `invalidateData()` so the page underneath reloads (`useDataVersion()` in its key).
- **Barcodes**: validated with `normalizeBarcode` (shared, GTIN check digit) on both sides. The frontend never calls
  Open Food Facts: `GET /api/foods/barcode/:code` returns the food known by that barcode, else imports the OFF
  product once (`source: off`, serving → "portion" unit), else `{ food: null, suggestedName }` → "Mon aliment"
  created with the barcode. Camera scan on mobile only (native `BarcodeDetector`, else the ZXing wasm ponyfill loaded
  on demand from our origin); no Scanner button on desktop. `zxing-wasm` is pinned to the exact version
  `barcode-detector` expects (a test checks it): bump them together.
- **PWA**: the service worker precaches the app shell only; `/api` is never cached (offline → "Chargement impossible").
  It updates itself (`autoUpdate`). Not active in `vite` dev; test it on a build served by Nest.
- **All UI strings live in `frontend/src/i18n/fr.ts`** (French only, no helper/explanatory text);
  numbers via `core/format.ts` (`Intl.NumberFormat('fr-FR')`).

## Feature workflow

1. **Design handoff** lands in `design/<feature>/` (Claude Design bundle — read-only).
2. **Spec**: move/write the spec to `docs/specs/<feature>.md`.
3. **Branch**: `git switch -c feat/<feature>` from an up-to-date `main`.
4. **Backend**: Prisma model + migration (`npx prisma migrate dev --name <feature>`),
   domain module, decorated DTOs, service, controller, unit/e2e tests.
5. **Sync the contract**: `npm run api:sync` (= `export:openapi` + `generate-client`); commit
   `frontend/openapi.json` and `frontend/src/api/generated/`.
6. **Frontend**: pages/components using the generated client and theme tokens
   (transcribe any new tokens from the handoff into `src/theme/tokens.ts`).
7. **Verify**: `npm run lint`, builds and tests in both apps (CI runs the same, plus a check that the
   OpenAPI spec and generated client are not stale).
8. **PR to `main`** (`gh pr create`), Conventional Commit title; CI must pass.
9. **Merge** (squash).
10. **Railway auto-deploys** `main` once CI passes (build → `prisma migrate deploy` → start → healthcheck `/api/health`).
11. **Check the deploy**: `railway logs --build` / `railway logs` (service `app`) and hit `/api/health`.

## Railway infrastructure (`.railway/railway.ts`)

Railway does **not** read this file during deploys — changes take effect only when applied by hand:

```powershell
# Windows workaround: the railway/iac SDK re-runs the CLI via $env:_ and can't execute the npm shim
$env:_ = "$env:APPDATA\npm\node_modules\@railway\cli\bin\railway.exe"
& $env:_ config plan     # preview — always read it first
& $env:_ config apply    # only if the plan is what you expect
```

- The file manages the **whole project**: removing a resource from it deletes that resource on apply.
  Never remove `Postgres` or `postgres-volume` (that deletes the database).
- Commit changes to the file through a PR like any other change, and apply after merging.
- `source.checkSuites: true` = Railway waits for the GitHub `backend`/`frontend` checks before deploying.
- Secrets are declared with `preserve()` (kept as set on Railway, never committed). Set them by hand:
  `& $env:_ variables --set "ACCESS_KEY=<long random>" -s app`.
  **Never pipe a secret from Windows PowerShell 5.1** (`… | railway variable set X --stdin`): it prepends a
  UTF-8 BOM to the value. Pass it as an argument, then check its length with `railway variables -s app --json`.

## Environment variables

Backend (`backend/.env`, see `backend/.env.example`):

| Variable       | Required | Default                 | Notes                                                        |
| -------------- | -------- | ----------------------- | ------------------------------------------------------------ |
| `DATABASE_URL` | yes      | —                       | PostgreSQL URL. Railway: `${{Postgres.DATABASE_URL}}`        |
| `PORT`         | no       | `3001`                  | Railway injects it                                           |
| `FRONTEND_URL` | no       | `http://localhost:5173` | CORS allowed origin                                          |
| `NODE_ENV`     | no       | —                       | `production` on Railway                                      |
| `ACCESS_KEY`   | yes      | —                       | Required `X-Access-Key` value. Unset = every API call is 401 |

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
