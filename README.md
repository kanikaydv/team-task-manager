# Team Task Manager

A full-stack team task management application with role-based access control, built with React, TypeScript, Express, and PostgreSQL.

## Live URL
<!-- Replace with your Railway URL after deployment -->
https://your-app-name.up.railway.app

## GitHub Repo
<!-- Replace with your actual repo URL -->
https://github.com/yourusername/team-task-manager

---

## Overview

TaskFlow is a team task manager that helps teams organize projects, assign tasks, track progress, and collaborate efficiently. It features a clean, modern UI with a Kanban board, dashboard analytics, and role-based permissions.

### Key Features

- **Authentication** — Secure JWT-based signup/login with 7-day session expiry
- **Project & Team Management** — Create projects, invite members by email, manage roles
- **Task Creation, Assignment & Status Tracking** — Full CRUD with priority, due dates, assignees, and Kanban columns (To Do / In Progress / Done)
- **Dashboard** — Visual overview with stats cards, status donut chart, project progress bars, tasks per member, overdue task list, and my assigned tasks
- **Role-Based Access Control** — Admins have full control; Members can view and update tasks assigned to them

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS v4 + shadcn/ui + TanStack Query |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Auth | JWT (localStorage) + bcryptjs |
| Validation | Zod |

---

## Role-Based Access Control

| Action | Admin | Member |
|--------|-------|--------|
| Create/Delete Project | Yes | No |
| Edit Project Name/Description | Yes | No |
| Add/Remove Members | Yes | No |
| Create Tasks | Yes | Yes |
| Edit Task (all fields) | Yes | No |
| Edit Task (status + title only) | Yes | Yes (if assigned) |
| Delete Tasks | Yes | No |
| View Dashboard/Projects/Tasks | Yes | Yes |

---

## API Endpoints

### Auth
- `POST /api/auth/signup` — Register new user
- `POST /api/auth/login` — Authenticate and receive JWT
- `GET /api/auth/me` — Get current user
- `POST /api/auth/logout` — Clear session

### Projects
- `GET /api/projects` — List projects for current user
- `POST /api/projects` — Create project (auto-admin)
- `GET /api/projects/:id` — Get project details with members
- `PUT /api/projects/:id` — Update project (admin only)
- `DELETE /api/projects/:id` — Delete project (admin only)

### Members
- `POST /api/projects/:id/members` — Add member by userId (admin only)
- `POST /api/projects/:id/members/invite` — Invite by email (admin only)
- `DELETE /api/projects/:id/members/:userId` — Remove member (admin only)

### Tasks
- `GET /api/projects/:id/tasks` — List tasks in project
- `POST /api/projects/:id/tasks` — Create task
- `GET /api/projects/:id/tasks/:taskId` — Get task details
- `PUT /api/projects/:id/tasks/:taskId` — Update task (RBAC enforced)
- `DELETE /api/projects/:id/tasks/:taskId` — Delete task (admin only)

### Dashboard
- `GET /api/dashboard/stats` — Overview stats + charts data
- `GET /api/dashboard/overdue` — Overdue tasks across all projects
- `GET /api/dashboard/my-tasks` — Tasks assigned to current user

### Seed
- `POST /api/seed` — Auto-creates demo project with sample tasks on first signup

---

## Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL running locally (or use Railway Postgres addon)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/team-task-manager.git
cd team-task-manager
```

Install root (frontend) deps:
```bash
npm install
```

Install server deps:
```bash
cd server && npm install && cd ..
```

### 2. Set Environment Variables

Create a `.env` file in the `server/` directory:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/taskmanager
SESSION_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=5555
```

### 3. Run Locally

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend:**
```bash
npm run dev
```

Open http://localhost:3000

### 4. Build for Production

```bash
# Build frontend
npm run build

# Build and run server
cd server && npm run build && npm start
```

The server serves the built frontend and handles SPA routing automatically.

---

## Railway Deployment

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

### Step 2: Create Railway Project

1. Go to https://railway.app and login/signup
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `team-task-manager` repo
4. Railway will auto-detect `railway.toml`

### Step 3: Add PostgreSQL Database

1. In your Railway project, click **New** → **Database** → **Add PostgreSQL**
2. Wait for it to provision (takes ~30 seconds)
3. Go to the PostgreSQL service → **Variables** tab
4. Copy the `DATABASE_URL` value

### Step 4: Add Environment Variables

Go to your **app service** → **Variables** tab, and add:

| Variable | Value | Source |
|----------|-------|--------|
| `DATABASE_URL` | `postgres://...` | Reference the PostgreSQL service variable |
| `SESSION_SECRET` | Any random 32+ char string | Generate one yourself |

To reference the Postgres variable: click **New Variable** → **Add Reference** → select your PostgreSQL service → `DATABASE_URL`.

### Step 5: Deploy

Railway will auto-deploy on every push to `main`. For the first deploy:

1. Go to your app service → **Settings**
2. Click **Generate Domain** to get a public URL
3. Wait for the deploy to finish (watch the **Deploy Logs**)

### Step 6: Verify

- Visit your Railway URL
- Sign up → a demo project auto-seeds
- Create projects, tasks, invite members
- Verify admin vs member permissions work

---

## Database Schema

```
users (id, name, email, password_hash, created_at)
projects (id, name, description, created_by_id, created_at)
project_members (id, project_id, user_id, role, created_at)
tasks (id, project_id, title, description, status, priority, due_date, assignee_id, created_by_id, created_at, updated_at)
```

Relationships:
- `projects.created_by_id` → `users.id`
- `project_members.project_id` → `projects.id`
- `project_members.user_id` → `users.id`
- `tasks.project_id` → `projects.id`
- `tasks.assignee_id` → `users.id`
- `tasks.created_by_id` → `users.id`

---

## Project Structure

```
team-task-manager/
├── server/                    # Express backend
│   ├── src/
│   │   ├── index.ts           # API routes
│   │   ├── db.ts              # Drizzle ORM + PostgreSQL schema
│   │   ├── auth.ts            # JWT middleware
│   │   └── migrate.ts         # DB migration script
│   ├── package.json
│   └── tsconfig.json
├── src/                       # React frontend
│   ├── pages/                 # All page components
│   ├── components/ui/         # shadcn/ui components
│   ├── contexts/              # AuthContext
│   ├── lib/api.ts             # API client + React Query hooks
│   ├── App.tsx
│   └── main.tsx
├── public/
├── index.html
├── vite.config.ts
├── package.json
├── railway.toml               # Railway deployment config
└── README.md
```

---

## License

MIT
