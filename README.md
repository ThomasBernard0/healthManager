# healthManager

Full-stack app: **NestJS + Prisma/PostgreSQL** API (`backend/`) and **React + Vite** SPA (`frontend/`),
deployed to Railway as a single service (Nest serves the built SPA and `/api`).

## Quick start

```bash
# backend (needs a PostgreSQL URL in backend/.env)
cd backend && cp .env.example .env && npm install && npm run start:dev   # http://localhost:3001/api

# frontend
cd frontend && cp .env.example .env && npm install && npm run dev         # http://localhost:5173
```

- Health: `GET /api/health` → `{ "status": "ok" }`
- API docs (Swagger): `/api/docs`
- After changing the API: `npm run api:sync` at the root (exports OpenAPI and regenerates the client)

See [CLAUDE.md](CLAUDE.md) for conventions, workflow and environment variables.
