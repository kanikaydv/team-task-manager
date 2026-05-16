import { useParams, Link } from "wouter";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetProject, getGetProjectQueryKey,
  useListProjectTasks, getListProjectTasksQueryKey,
  useUpdateTask,
  useCreateTask,
  useRemoveProjectMember,
  getListProjectsQueryKey,
} from "@/lib/api";
import type { TaskInput, TaskInputStatus, TaskInputPriority } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Plus, Settings, Crown, Loader2, AlertTriangle,
  CheckCircle2, Clock, ListTodo, Users, Calendar,
  UserMinus, UserPlus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isPast, parseISO, format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// ---------- shared helpers ----------

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    high: "bg-red-500/15 text-red-400 border-red-500/20",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    low: "bg-green-500/15 text-green-400 border-green-500/20",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${map[priority] ?? ""}`}>
      {priority}
    </span>
  );
}

function MemberAvatar({ name, role, size = "sm" }: { name: string; role?: string; size?: "sm" | "md" }) {
  const sz = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  return (
    <div
      title={role ? `${name} (${role})` : name}
      className={cn(
        sz,
        "rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary border-2 border-background shrink-0"
      )}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}

// ---------- Create Task dialog ----------

const createTaskSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
});
type CreateTaskValues = z.infer<typeof createTaskSchema>;

function CreateTaskDialog({
  open, onClose, projectId, members,
}: {
  open: boolean;
  onClose: () => void;
  projectId: number;
  members: { userId: number; name: string }[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createTask = useCreateTask();

  const form = useForm<CreateTaskValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { title: "", description: "", priority: "medium", status: "todo", dueDate: "", assigneeId: "" },
  });

  function onSubmit(data: CreateTaskValues) {
    const payload: TaskInput = {
      title: data.title,
      priority: data.priority as TaskInputPriority,
      status: data.status as TaskInputStatus,
    };
    if (data.description) payload.description = data.description;
    if (data.dueDate) payload.dueDate = data.dueDate;
    if (data.assigneeId && data.assigneeId !== "unassigned") {
      payload.assigneeId = parseInt(data.assigneeId, 10);
    }

    createTask.mutate(
      { projectId, data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectTasksQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          toast({ title: "Task created" });
          form.reset();
          onClose();
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to create task";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Add a new task to this project</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Task title" data-testid="input-title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                <FormControl>
                  <Textarea placeholder="What needs to be done?" rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="dueDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="assigneeId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign to</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.userId} value={String(m.userId)}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={createTask.isPending} data-testid="button-submit">
                {createTask.isPending ? "Creating..." : "Create Task"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Manage Members dialog ----------

function ManageMembersDialog({
  open, onClose, projectId, members,
}: {
  open: boolean;
  onClose: () => void;
  projectId: number;
  members: { userId: number; name: string; email: string; role: string }[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [emailInput, setEmailInput] = useState("");
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [addPending, setAddPending] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ userId: number; name: string } | null>(null);
  const removeMember = useRemoveProjectMember();

  async function handleAdd() {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    setAddError("");
    setAddSuccess("");
    setAddPending(true);
    try {
      const token = localStorage.getItem("taskmanager_token");
      const res = await fetch(`/api/projects/${projectId}/members/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email, role: "member" }),
      });
      const json = await res.json() as { success?: boolean; error?: string; member?: { name: string } };
      if (!res.ok) {
        setAddError(json.error ?? "Failed to add member");
      } else {
        setAddSuccess(`${json.member?.name ?? "Member"} added to project`);
        setEmailInput("");
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      }
    } catch {
      setAddError("Network error. Please try again.");
    } finally {
      setAddPending(false);
    }
  }

  function handleRemoveConfirm() {
    if (!confirmRemove) return;
    removeMember.mutate(
      { projectId, userId: confirmRemove.userId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          toast({ title: `${confirmRemove.name} removed from project` });
          setConfirmRemove(null);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to remove member", variant: "destructive" });
          setConfirmRemove(null);
        },
      }
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Manage Members
            </DialogTitle>
            <DialogDescription>Add or remove project members</DialogDescription>
          </DialogHeader>

          {/* Current members list */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-accent/30 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MemberAvatar name={m.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                  <Badge
                    variant={m.role === "admin" ? "default" : "secondary"}
                    className="text-xs shrink-0 ml-1"
                  >
                    {m.role === "admin" ? (
                      <><Crown className="h-2.5 w-2.5 mr-0.5" />Admin</>
                    ) : "Member"}
                  </Badge>
                </div>
                {m.userId !== user?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setConfirmRemove({ userId: m.userId, name: m.name })}
                  >
                    <UserMinus className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Add by email */}
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add member by email</p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="user@example.com"
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); setAddError(""); setAddSuccess(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="flex-1 text-sm"
              />
              <Button size="sm" onClick={handleAdd} disabled={!emailInput.trim() || addPending}>
                {addPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              </Button>
            </div>
            {addError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />{addError}
              </p>
            )}
            {addSuccess && (
              <p className="text-xs text-green-500 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />{addSuccess}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm remove dialog */}
      <Dialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              Remove <strong>{confirmRemove?.name}</strong> from this project? They will lose access to all project tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemoveConfirm}
              disabled={removeMember.isPending}
            >
              {removeMember.isPending ? "Removing…" : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- Kanban columns ----------

const STATUS_COLUMNS = [
  { key: "todo", label: "To Do", icon: <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />, bg: "bg-muted/30" },
  { key: "in_progress", label: "In Progress", icon: <Clock className="h-3.5 w-3.5 text-blue-400" />, bg: "bg-blue-500/5" },
  { key: "done", label: "Done", icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />, bg: "bg-green-500/5" },
] as const;

// ---------- Main page ----------

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = parseInt(projectId, 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);

  const { data: project, isLoading: projectLoading } = useGetProject(pid, {
    query: { enabled: !!pid, queryKey: getGetProjectQueryKey(pid) },
  });

  const { data: tasks = [], isLoading: tasksLoading } = useListProjectTasks(pid, {
    query: { enabled: !!pid, queryKey: getListProjectTasksQueryKey(pid) },
  });

  const updateTask = useUpdateTask();

  function handleStatusChange(taskId: number, newStatus: "todo" | "in_progress" | "done") {
    updateTask.mutate(
      { projectId: pid, taskId, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectTasksQueryKey(pid) });
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Update failed";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      }
    );
  }

  if (projectLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="px-6 py-6 text-center text-muted-foreground">Project not found</div>
      </Layout>
    );
  }

  const isAdmin = project.myRole === "admin";
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const progressPct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <Layout>
      <div className="px-6 py-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-project">
                {project.name}
              </h1>
              {isAdmin ? (
                <span className="flex items-center gap-0.5 text-xs text-amber-400 font-medium">
                  <Crown className="h-3.5 w-3.5" />
                  Admin
                </span>
              ) : (
                <Badge variant="secondary" className="text-xs">Member</Badge>
              )}
            </div>
            {project.description && (
              <p className="text-muted-foreground text-sm max-w-2xl">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {isAdmin && (
              <>
                <Button
                  size="sm"
                  onClick={() => setTaskDialogOpen(true)}
                  data-testid="button-new-task"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Task
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMembersDialogOpen(true)}
                  data-testid="button-manage-members"
                >
                  <Users className="h-4 w-4 mr-1.5" />
                  Members
                </Button>
                <Link href={`/projects/${pid}/settings`}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-settings">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Members + progress row */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          {/* Member avatars */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {project.members.map((m) => (
              <MemberAvatar key={m.userId} name={m.name} role={m.role} />
            ))}
            {isAdmin && (
              <button
                onClick={() => setMembersDialogOpen(true)}
                className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors text-xs"
                data-testid="button-add-member-avatar"
              >
                +
              </button>
            )}
            <span className="text-xs text-muted-foreground ml-1">
              {project.members.length} member{project.members.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Progress */}
          {tasks.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
              <span className="shrink-0">{progressPct}% complete</span>
              <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="shrink-0">{doneCount}/{tasks.length} done</span>
            </div>
          )}
        </div>

        {/* Members detail section */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Team</h2>
          <div className="flex flex-wrap gap-3">
            {project.members.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                <MemberAvatar name={m.name} role={m.role} size="md" />
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant={m.role === "admin" ? "default" : "secondary"}
                      className="text-xs px-1.5 py-0"
                    >
                      {m.role === "admin" ? (
                        <><Crown className="h-2.5 w-2.5 mr-0.5" />Admin</>
                      ) : "Member"}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kanban board */}
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Tasks</h2>
        {tasksLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STATUS_COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.key);
              return (
                <div key={col.key} className="flex flex-col gap-2">
                  {/* Column header */}
                  <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg", col.bg)}>
                    {col.icon}
                    <span className="text-sm font-semibold">{col.label}</span>
                    <Badge variant="secondary" className="ml-auto text-xs h-5 min-w-5 justify-center">
                      {colTasks.length}
                    </Badge>
                  </div>

                  {/* Task cards */}
                  <div className="flex flex-col gap-2 min-h-[100px]">
                    {colTasks.map((task) => {
                      const overdue = task.dueDate && isPast(parseISO(task.dueDate)) && task.status !== "done";
                      const canEdit = isAdmin || task.assigneeId === user?.id;
                      const borderColor = task.priority === "high"
                        ? "border-l-red-500"
                        : task.priority === "medium"
                          ? "border-l-yellow-500"
                          : "border-l-green-500";

                      return (
                        <Link
                          key={task.id}
                          href={`/projects/${pid}/tasks/${task.id}`}
                          data-testid={`card-task-${task.id}`}
                        >
                          <Card
                            className={cn(
                              "border-l-4 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer group",
                              borderColor
                            )}
                          >
                            <CardContent className="pt-3 pb-3 px-3">
                              <p className="text-sm font-medium group-hover:text-primary transition-colors mb-2 line-clamp-2">
                                {task.title}
                              </p>

                              {/* Assignee + priority row */}
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <PriorityBadge priority={task.priority} />
                                {task.assigneeName && (
                                  <div className="flex items-center gap-1">
                                    <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                                      {task.assigneeName[0]?.toUpperCase()}
                                    </div>
                                    <span className="text-xs text-muted-foreground truncate max-w-[72px]">
                                      {task.assigneeName}
                                    </span>
                                  </div>
                                )}
                                {task.dueDate && (
                                  <span
                                    className={cn(
                                      "text-xs ml-auto flex items-center gap-0.5",
                                      overdue ? "text-red-400 font-medium" : "text-muted-foreground"
                                    )}
                                  >
                                    {overdue
                                      ? <AlertTriangle className="h-3 w-3" />
                                      : <Calendar className="h-3 w-3" />}
                                    {format(parseISO(task.dueDate), "MMM d")}
                                  </span>
                                )}
                              </div>

                              {/* Overdue tag */}
                              {overdue && (
                                <span className="inline-flex items-center gap-0.5 text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded mb-1.5">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Overdue
                                </span>
                              )}

                              {/* Quick action buttons */}
                              {canEdit && col.key !== "done" && (
                                <div className="mt-1.5 flex gap-2">
                                  {col.key === "todo" && (
                                    <button
                                      className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleStatusChange(task.id, "in_progress");
                                      }}
                                      data-testid={`button-start-${task.id}`}
                                    >
                                      → Start
                                    </button>
                                  )}
                                  {col.key === "in_progress" && (
                                    <button
                                      className="text-xs text-green-400 hover:text-green-300 font-medium transition-colors"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleStatusChange(task.id, "done");
                                      }}
                                      data-testid={`button-done-${task.id}`}
                                    >
                                      ✓ Done
                                    </button>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })}

                    {colTasks.length === 0 && (
                      <div className="border border-dashed border-border rounded-lg h-16 flex items-center justify-center text-xs text-muted-foreground/40">
                        {isAdmin && col.key === "todo" ? (
                          <button
                            onClick={() => setTaskDialogOpen(true)}
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                          >
                            <Plus className="h-3 w-3" /> Add task
                          </button>
                        ) : "Empty"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {isAdmin && (
        <>
          <CreateTaskDialog
            open={taskDialogOpen}
            onClose={() => setTaskDialogOpen(false)}
            projectId={pid}
            members={project.members}
          />
          <ManageMembersDialog
            open={membersDialogOpen}
            onClose={() => setMembersDialogOpen(false)}
            projectId={pid}
            members={project.members}
          />
        </>
      )}
    </Layout>
  );
}
