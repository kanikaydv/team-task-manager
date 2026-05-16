import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API_BASE = "";

function getToken() {
  return localStorage.getItem("taskmanager_token") ?? "";
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error ?? `HTTP ${res.status}`) as Error & { status: number; data: unknown };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return res.json();
}

// ---------- Types ----------

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string | null;
  taskCount: number;
  memberCount: number;
  myRole: string;
}

export interface ProjectDetail {
  id: number;
  name: string;
  description?: string | null;
  myRole: string;
  members: ProjectMember[];
}

export interface ProjectMember {
  userId: number;
  name: string;
  email: string;
  role: string;
}

export interface Task {
  id: number;
  projectId: number;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  assigneeId?: number | null;
  assigneeName?: string | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
  projectName?: string | null;
}

export type TaskInputStatus = "todo" | "in_progress" | "done";
export type TaskInputPriority = "low" | "medium" | "high";

export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskInputStatus;
  priority?: TaskInputPriority;
  dueDate?: string;
  assigneeId?: number;
}

export interface DashboardStats {
  totalTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  overdueTasks: number;
  myAssignedTasks: number;
  totalProjects: number;
  tasksByProject: Array<{ projectId: number; projectName: string; taskCount: number; doneCount: number }>;
  tasksByUser: Array<{ userId: number; userName: string; taskCount: number }>;
}

// ---------- Query Keys ----------

export const getGetMeQueryKey = () => ["auth", "me"];
export const getListProjectsQueryKey = () => ["projects"];
export const getGetProjectQueryKey = (id: number) => ["projects", id];
export const getListProjectTasksQueryKey = (projectId: number) => ["projects", projectId, "tasks"];
export const getGetTaskQueryKey = (projectId: number, taskId: number) => ["projects", projectId, "tasks", taskId];
export const getListUsersQueryKey = () => ["users"];
export const getGetDashboardStatsQueryKey = () => ["dashboard", "stats"];
export const getGetOverdueTasksQueryKey = () => ["dashboard", "overdue"];
export const getGetMyTasksQueryKey = () => ["dashboard", "my-tasks"];

// ---------- Auth Hooks ----------

export function useSignup() {
  return useMutation({
    mutationFn: async ({ data }: { data: { name: string; email: string; password: string } }) => {
      return apiFetch("/api/auth/signup", { method: "POST", body: JSON.stringify(data) }) as Promise<{ token: string; user: User }>;
    },
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async ({ data }: { data: { email: string; password: string } }) => {
      return apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(data) }) as Promise<{ token: string; user: User }>;
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      return apiFetch("/api/auth/logout", { method: "POST" });
    },
  });
}

export function useGetMe(options?: { query?: { queryKey?: unknown[]; retry?: boolean; enabled?: boolean } }) {
  return useQuery({
    queryKey: getGetMeQueryKey(),
    queryFn: async () => {
      return apiFetch("/api/auth/me") as Promise<User>;
    },
    retry: options?.query?.retry ?? true,
    enabled: options?.query?.enabled ?? true,
  });
}

// ---------- Project Hooks ----------

export function useListProjects(options?: { query?: { queryKey?: unknown[] } }) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getListProjectsQueryKey(),
    queryFn: async () => {
      return apiFetch("/api/projects") as Promise<Project[]>;
    },
  });
}

export function useCreateProject() {
  return useMutation({
    mutationFn: async ({ data }: { data: { name: string; description?: string } }) => {
      return apiFetch("/api/projects", { method: "POST", body: JSON.stringify(data) }) as Promise<Project>;
    },
  });
}

export function useGetProject(id: number, options?: { query?: { enabled?: boolean; queryKey?: unknown[] } }) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getGetProjectQueryKey(id),
    queryFn: async () => {
      return apiFetch(`/api/projects/${id}`) as Promise<ProjectDetail>;
    },
    enabled: options?.query?.enabled ?? !!id,
  });
}

export function useUpdateProject() {
  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: number; data: { name?: string; description?: string } }) => {
      return apiFetch(`/api/projects/${projectId}`, { method: "PUT", body: JSON.stringify(data) }) as Promise<Project>;
    },
  });
}

export function useDeleteProject() {
  return useMutation({
    mutationFn: async ({ projectId }: { projectId: number }) => {
      return apiFetch(`/api/projects/${projectId}`, { method: "DELETE" }) as Promise<{ success: boolean }>;
    },
  });
}

// ---------- Task Hooks ----------

export function useListProjectTasks(projectId: number, options?: { query?: { enabled?: boolean; queryKey?: unknown[] } }) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getListProjectTasksQueryKey(projectId),
    queryFn: async () => {
      return apiFetch(`/api/projects/${projectId}/tasks`) as Promise<Task[]>;
    },
    enabled: options?.query?.enabled ?? !!projectId,
  });
}

export function useCreateTask() {
  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: number; data: TaskInput }) => {
      return apiFetch(`/api/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(data) }) as Promise<Task>;
    },
  });
}

export function useGetTask(projectId: number, taskId: number, options?: { query?: { enabled?: boolean; queryKey?: unknown[] } }) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getGetTaskQueryKey(projectId, taskId),
    queryFn: async () => {
      return apiFetch(`/api/projects/${projectId}/tasks/${taskId}`) as Promise<Task>;
    },
    enabled: options?.query?.enabled ?? (!!projectId && !!taskId),
  });
}

export function useUpdateTask() {
  return useMutation({
    mutationFn: async ({ projectId, taskId, data }: { projectId: number; taskId: number; data: Partial<TaskInput> }) => {
      return apiFetch(`/api/projects/${projectId}/tasks/${taskId}`, { method: "PUT", body: JSON.stringify(data) }) as Promise<Task>;
    },
  });
}

export function useDeleteTask() {
  return useMutation({
    mutationFn: async ({ projectId, taskId }: { projectId: number; taskId: number }) => {
      return apiFetch(`/api/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" }) as Promise<{ success: boolean }>;
    },
  });
}

// ---------- Member Hooks ----------

export function useAddProjectMember() {
  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: number; data: { userId: number; role: string } }) => {
      return apiFetch(`/api/projects/${projectId}/members`, { method: "POST", body: JSON.stringify(data) });
    },
  });
}

export function useRemoveProjectMember() {
  return useMutation({
    mutationFn: async ({ projectId, userId }: { projectId: number; userId: number }) => {
      return apiFetch(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });
    },
  });
}

// ---------- User Hooks ----------

export function useListUsers(options?: { query?: { queryKey?: unknown[] } }) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getListUsersQueryKey(),
    queryFn: async () => {
      return apiFetch("/api/users") as Promise<User[]>;
    },
  });
}

// ---------- Dashboard Hooks ----------

export function useGetDashboardStats(options?: { query?: { queryKey?: unknown[] } }) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getGetDashboardStatsQueryKey(),
    queryFn: async () => {
      return apiFetch("/api/dashboard/stats") as Promise<DashboardStats>;
    },
  });
}

export function useGetOverdueTasks(options?: { query?: { queryKey?: unknown[] } }) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getGetOverdueTasksQueryKey(),
    queryFn: async () => {
      return apiFetch("/api/dashboard/overdue") as Promise<Task[]>;
    },
  });
}

export function useGetMyTasks(options?: { query?: { queryKey?: unknown[] } }) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getGetMyTasksQueryKey(),
    queryFn: async () => {
      return apiFetch("/api/dashboard/my-tasks") as Promise<Task[]>;
    },
  });
}
