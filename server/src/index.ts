import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import { eq, and, inArray, count, sql } from "drizzle-orm";
import { db, users, projects, projectMembers, tasks } from "./db.js";
import { signToken, authMiddleware, AuthenticatedRequest } from "./auth.js";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

function paramId(req: express.Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
}

// Ensure DB tables exist (auto-migrate on startup)
await db.execute(sql`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'todo',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    due_date TIMESTAMP,
    assignee_id INTEGER,
    created_by_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
`);

// Serve built frontend in production
const distPath = path.resolve(process.cwd(), "../dist");
app.use(express.static(distPath));

// ---------- Auth ----------

const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

app.post("/api/auth/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { name, email, password } = parsed.data;
  const existingRows = await db.select().from(users).where(eq(users.email, email));
  if (existingRows.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const userRows = await db.insert(users).values({ name, email, passwordHash }).returning();
  const user = userRows[0];
  const token = signToken({ userId: user.id, email: user.email });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  const userRows = await db.select().from(users).where(eq(users.email, email));
  const user = userRows[0];
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken({ userId: user.id, email: user.email });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get("/api/auth/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
  res.json(req.user);
});

app.post("/api/auth/logout", authMiddleware, (_req: AuthenticatedRequest, res) => {
  res.json({ success: true });
});

// ---------- Users ----------

app.get("/api/users", authMiddleware, async (_req: AuthenticatedRequest, res) => {
  const all = await db.select({ id: users.id, name: users.name, email: users.email }).from(users);
  res.json(all);
});

// ---------- Projects ----------

app.get("/api/projects", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const memberRows = await db.select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));
  const projectIds = memberRows.map((m) => m.projectId);
  if (projectIds.length === 0) {
    res.json([]);
    return;
  }

  const projs = await db.select().from(projects).where(inArray(projects.id, projectIds));

  const enriched = await Promise.all(
    projs.map(async (p) => {
      const taskCountRows = await db.select({ count: count() }).from(tasks).where(eq(tasks.projectId, p.id));
      const memberCountRows = await db.select({ count: count() }).from(projectMembers).where(eq(projectMembers.projectId, p.id));
      const myMembershipRows = await db.select({ role: projectMembers.role })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, p.id), eq(projectMembers.userId, userId)));
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        taskCount: taskCountRows[0]?.count ?? 0,
        memberCount: memberCountRows[0]?.count ?? 0,
        myRole: myMembershipRows[0]?.role ?? "member",
      };
    })
  );

  res.json(enriched);
});

app.post("/api/projects", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ name: z.string().min(1), description: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const userId = req.user!.id;
  const projectRows = await db.insert(projects).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    createdById: userId,
  }).returning();
  const project = projectRows[0];

  await db.insert(projectMembers).values({
    projectId: project.id,
    userId,
    role: "admin",
  });

  res.status(201).json(project);
});

app.get("/api/projects/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const projectId = parseInt(paramId(req, "id"), 10);
  if (isNaN(projectId)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }
  const userId = req.user!.id;

  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId));
  const project = projectRows[0];
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const membershipRows = await db.select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  const membership = membershipRows[0];
  if (!membership) {
    res.status(403).json({ error: "Not a member" });
    return;
  }

  const members = await db.select({ userId: projectMembers.userId, role: projectMembers.role })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId));

  const memberDetails = await Promise.all(
    members.map(async (m) => {
      const uRows = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, m.userId));
      const u = uRows[0];
      return { userId: m.userId, name: u?.name ?? "", email: u?.email ?? "", role: m.role };
    })
  );

  res.json({
    id: project.id,
    name: project.name,
    description: project.description,
    myRole: membership.role,
    members: memberDetails,
  });
});

app.put("/api/projects/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const projectId = parseInt(paramId(req, "id"), 10);
  const userId = req.user!.id;
  const membershipRows = await db.select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  const membership = membershipRows[0];
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ error: "Admin required" });
    return;
  }
  const schema = z.object({ name: z.string().min(1).optional(), description: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;

  const updatedRows = await db.update(projects).set(updateData).where(eq(projects.id, projectId)).returning();
  res.json(updatedRows[0]);
});

app.delete("/api/projects/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const projectId = parseInt(paramId(req, "id"), 10);
  const userId = req.user!.id;
  const membershipRows = await db.select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  const membership = membershipRows[0];
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ error: "Admin required" });
    return;
  }
  await db.delete(tasks).where(eq(tasks.projectId, projectId));
  await db.delete(projectMembers).where(eq(projectMembers.projectId, projectId));
  await db.delete(projects).where(eq(projects.id, projectId));
  res.json({ success: true });
});

// ---------- Project Members ----------

app.post("/api/projects/:id/members", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const projectId = parseInt(paramId(req, "id"), 10);
  const userId = req.user!.id;
  const membershipRows = await db.select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  const membership = membershipRows[0];
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ error: "Admin required" });
    return;
  }
  const schema = z.object({ userId: z.number(), role: z.enum(["admin", "member"]).default("member") });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const existingRows = await db.select().from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, parsed.data.userId)));
  if (existingRows.length > 0) {
    res.status(409).json({ error: "User already a member" });
    return;
  }
  await db.insert(projectMembers).values({
    projectId,
    userId: parsed.data.userId,
    role: parsed.data.role,
  });
  res.json({ success: true });
});

app.post("/api/projects/:id/members/invite", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const projectId = parseInt(paramId(req, "id"), 10);
  const userId = req.user!.id;
  const membershipRows = await db.select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  const membership = membershipRows[0];
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ error: "Admin required" });
    return;
  }
  const schema = z.object({ email: z.string().email(), role: z.enum(["admin", "member"]).default("member") });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const targetUserRows = await db.select().from(users).where(eq(users.email, parsed.data.email));
  const targetUser = targetUserRows[0];
  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const existingRows = await db.select().from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, targetUser.id)));
  if (existingRows.length > 0) {
    res.status(409).json({ error: "User already a member" });
    return;
  }
  await db.insert(projectMembers).values({
    projectId,
    userId: targetUser.id,
    role: parsed.data.role,
  });
  res.json({ success: true, member: { name: targetUser.name } });
});

app.delete("/api/projects/:id/members/:userId", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const projectId = parseInt(paramId(req, "id"), 10);
  const targetUserId = parseInt(paramId(req, "userId"), 10);
  const userId = req.user!.id;
  const membershipRows = await db.select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  const membership = membershipRows[0];
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ error: "Admin required" });
    return;
  }
  await db.delete(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, targetUserId)));
  res.json({ success: true });
});

// ---------- Tasks ----------

app.get("/api/projects/:id/tasks", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const projectId = parseInt(paramId(req, "id"), 10);
  const userId = req.user!.id;
  const membershipRows = await db.select().from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  if (membershipRows.length === 0) {
    res.status(403).json({ error: "Not a member" });
    return;
  }
  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId));
  const project = projectRows[0];
  const taskList = await db.select().from(tasks).where(eq(tasks.projectId, projectId));

  const enriched = await Promise.all(
    taskList.map(async (t) => {
      const assigneeRows = t.assigneeId ? await db.select({ name: users.name }).from(users).where(eq(users.id, t.assigneeId)) : [];
      return {
        ...t,
        assigneeName: assigneeRows[0]?.name ?? null,
        projectName: project?.name ?? null,
      };
    })
  );

  res.json(enriched);
});

app.post("/api/projects/:id/tasks", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const projectId = parseInt(paramId(req, "id"), 10);
  const userId = req.user!.id;
  const membershipRows = await db.select().from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  if (membershipRows.length === 0) {
    res.status(403).json({ error: "Not a member" });
    return;
  }
  const schema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    status: z.enum(["todo", "in_progress", "done"]).default("todo"),
    dueDate: z.string().optional(),
    assigneeId: z.number().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const data = parsed.data;
  const taskRows = await db.insert(tasks).values({
    projectId,
    title: data.title,
    description: data.description ?? null,
    priority: data.priority as any,
    status: data.status as any,
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    assigneeId: data.assigneeId ?? null,
    createdById: userId,
  }).returning();
  res.status(201).json(taskRows[0]);
});

app.get("/api/projects/:id/tasks/:taskId", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const projectId = parseInt(paramId(req, "id"), 10);
  const taskId = parseInt(paramId(req, "taskId"), 10);
  const userId = req.user!.id;
  const membershipRows = await db.select().from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  if (membershipRows.length === 0) {
    res.status(403).json({ error: "Not a member" });
    return;
  }
  const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId));
  const task = taskRows[0];
  if (!task || task.projectId !== projectId) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(task);
});

app.put("/api/projects/:id/tasks/:taskId", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const projectId = parseInt(paramId(req, "id"), 10);
  const taskId = parseInt(paramId(req, "taskId"), 10);
  const userId = req.user!.id;
  const membershipRows = await db.select({ role: projectMembers.role }).from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  const membership = membershipRows[0];
  if (!membership) {
    res.status(403).json({ error: "Not a member" });
    return;
  }
  const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId));
  const task = taskRows[0];
  if (!task || task.projectId !== projectId) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const isAdmin = membership.role === "admin";
  const isAssignee = task.assigneeId === userId;

  const schema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    status: z.enum(["todo", "in_progress", "done"]).optional(),
    dueDate: z.string().optional(),
    assigneeId: z.number().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (isAdmin) {
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
  } else if (isAssignee) {
    if (data.title !== undefined) updateData.title = data.title;
  } else {
    res.status(403).json({ error: "Cannot edit this task" });
    return;
  }

  const updatedRows = await db.update(tasks).set(updateData).where(eq(tasks.id, taskId)).returning();
  res.json(updatedRows[0]);
});

app.delete("/api/projects/:id/tasks/:taskId", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const projectId = parseInt(paramId(req, "id"), 10);
  const taskId = parseInt(paramId(req, "taskId"), 10);
  const userId = req.user!.id;
  const membershipRows = await db.select({ role: projectMembers.role }).from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  const membership = membershipRows[0];
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ error: "Admin required" });
    return;
  }
  const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId));
  const task = taskRows[0];
  if (!task || task.projectId !== projectId) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  await db.delete(tasks).where(eq(tasks.id, taskId));
  res.json({ success: true });
});

// ---------- Dashboard ----------

app.get("/api/dashboard/stats", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const memberRows = await db.select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));
  const projectIds = memberRows.map((m) => m.projectId);

  let totalTasks = 0;
  let todoTasks = 0;
  let inProgressTasks = 0;
  let doneTasks = 0;
  let overdueTasks = 0;
  let myAssignedTasks = 0;

  const tasksByProject: { projectId: number; projectName: string; taskCount: number; doneCount: number }[] = [];
  const tasksByUser: { userId: number; userName: string; taskCount: number }[] = [];

  if (projectIds.length > 0) {
    const allTasks = await db.select().from(tasks).where(inArray(tasks.projectId, projectIds));
    totalTasks = allTasks.length;
    todoTasks = allTasks.filter((t) => t.status === "todo").length;
    inProgressTasks = allTasks.filter((t) => t.status === "in_progress").length;
    doneTasks = allTasks.filter((t) => t.status === "done").length;
    const now = new Date();
    overdueTasks = allTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "done").length;
    myAssignedTasks = allTasks.filter((t) => t.assigneeId === userId).length;

    for (const pid of projectIds) {
      const projRows = await db.select().from(projects).where(eq(projects.id, pid));
      const proj = projRows[0];
      const projTasks = allTasks.filter((t) => t.projectId === pid);
      tasksByProject.push({
        projectId: pid,
        projectName: proj?.name ?? "",
        taskCount: projTasks.length,
        doneCount: projTasks.filter((t) => t.status === "done").length,
      });
    }

    const userTaskCounts = new Map<number, number>();
    for (const t of allTasks) {
      if (t.assigneeId) {
        userTaskCounts.set(t.assigneeId, (userTaskCounts.get(t.assigneeId) ?? 0) + 1);
      }
    }
    for (const [uid, count] of userTaskCounts.entries()) {
      const uRows = await db.select({ name: users.name }).from(users).where(eq(users.id, uid));
      tasksByUser.push({ userId: uid, userName: uRows[0]?.name ?? "", taskCount: count });
    }
  }

  res.json({
    totalTasks,
    todoTasks,
    inProgressTasks,
    doneTasks,
    overdueTasks,
    myAssignedTasks,
    totalProjects: projectIds.length,
    tasksByProject,
    tasksByUser,
  });
});

app.get("/api/dashboard/overdue", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const memberRows = await db.select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));
  const projectIds = memberRows.map((m) => m.projectId);
  if (projectIds.length === 0) {
    res.json([]);
    return;
  }
  const allTasks = await db.select().from(tasks).where(inArray(tasks.projectId, projectIds));
  const overdue = allTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done");

  const enriched = await Promise.all(
    overdue.map(async (t) => {
      const projectRows = await db.select().from(projects).where(eq(projects.id, t.projectId));
      const assigneeRows = t.assigneeId ? await db.select({ name: users.name }).from(users).where(eq(users.id, t.assigneeId)) : [];
      return {
        ...t,
        projectName: projectRows[0]?.name ?? null,
        assigneeName: assigneeRows[0]?.name ?? null,
      };
    })
  );
  res.json(enriched);
});

app.get("/api/dashboard/my-tasks", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const memberRows = await db.select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));
  const projectIds = memberRows.map((m) => m.projectId);
  if (projectIds.length === 0) {
    res.json([]);
    return;
  }
  const myTasksList = await db.select().from(tasks)
    .where(and(inArray(tasks.projectId, projectIds), eq(tasks.assigneeId, userId)));

  const enriched = await Promise.all(
    myTasksList.map(async (t) => {
      const projectRows = await db.select().from(projects).where(eq(projects.id, t.projectId));
      const assigneeRows = t.assigneeId ? await db.select({ name: users.name }).from(users).where(eq(users.id, t.assigneeId)) : [];
      return {
        ...t,
        projectName: projectRows[0]?.name ?? null,
        assigneeName: assigneeRows[0]?.name ?? null,
      };
    })
  );
  res.json(enriched);
});

// ---------- Seed ----------

app.post("/api/seed", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const existingProjectRows = await db.select({ count: count() }).from(projects).where(eq(projects.createdById, userId));
  if ((existingProjectRows[0]?.count ?? 0) > 0) {
    res.json({ success: true, message: "Already seeded" });
    return;
  }

  const demoProjectRows = await db.insert(projects).values({
    name: "Demo Project",
    description: "A sample project to get you started",
    createdById: userId,
  }).returning();
  const demoProject = demoProjectRows[0];

  await db.insert(projectMembers).values({
    projectId: demoProject.id,
    userId,
    role: "admin",
  });

  await db.insert(tasks).values([
    { projectId: demoProject.id, title: "Explore the dashboard", description: "Get familiar with the app", status: "done" as any, priority: "low" as any, createdById: userId },
    { projectId: demoProject.id, title: "Create your first real project", description: "", status: "todo" as any, priority: "medium" as any, createdById: userId },
    { projectId: demoProject.id, title: "Invite a team member", description: "Add someone to your project", status: "todo" as any, priority: "high" as any, createdById: userId },
  ]);

  res.json({ success: true });
});

// ---------- SPA fallback ----------

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(distPath, "index.html"));
});

// ---------- Error handling ----------

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const PORT = process.env.PORT ?? 5555;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
