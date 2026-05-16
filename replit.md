# TaskFlow

A full-stack team task manager with JWT auth, project management, kanban boards, and role-based access.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing key

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- Auth: JWT stored in localStorage as `taskmanager_token`

## Where things live

- `lib/db/src/schema.ts` — DB schema (users, projects, projectMembers, tasks)
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react/` — generated React Query hooks + Zod schemas
- `lib/api-zod/` — generated Zod validation schemas for server use
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middlewares/auth.ts` — JWT auth middleware
- `artifacts/task-manager/src/` — React frontend
- `artifacts/task-manager/src/contexts/AuthContext.tsx` — auth state
- `artifacts/task-manager/src/pages/` — all page components

## Architecture decisions

- JWT in localStorage (not cookies) for simplicity; `custom-fetch.ts` auto-attaches the token
- Orval-generated hooks keep frontend/backend in sync via a single OpenAPI spec
- Project creator is automatically added as admin member on creation
- Members can only update `status` on tasks assigned to them; admins can do everything
- Cascade deletes on `projectMembers` and `tasks` when a project is deleted

## Product

- **Auth**: Signup, login, JWT session with 7-day expiry
- **Dashboard**: Stats overview (total/todo/in-progress/done/overdue tasks), overdue task list, my assigned tasks, progress by project, tasks by team member
- **Projects**: List all joined projects with task/member counts; create new projects
- **Kanban Board**: Per-project view with To Do / In Progress / Done columns; quick status change buttons
- **Tasks**: Create, view, edit, delete tasks with title, description, priority, status, due date, assignee
- **Project Settings**: Edit name/description, manage members (add/remove), delete project

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm run typecheck:libs` after DB schema changes before typechecking API server
- `SESSION_SECRET` env var is used for JWT signing (has dev fallback but must be set in prod)
- API routes are mounted at `/api` prefix in Express

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
