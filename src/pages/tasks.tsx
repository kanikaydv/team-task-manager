import {
  useGetMyTasks,
  useListProjectTasks,
  useGetProject,
  useListProjects,
  getGetMyTasksQueryKey,
  getListProjectsQueryKey,
  getListProjectTasksQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  ListTodo,
  FolderKanban,
  User,
} from "lucide-react";
import { isPast, parseISO, format } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "todo" | "in_progress" | "done";

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    high: "bg-red-500/15 text-red-400 border-red-500/20",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    low: "bg-green-500/15 text-green-400 border-green-500/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[priority] ?? ""}`}
    >
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    todo: "bg-muted text-muted-foreground border-border",
    in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    done: "bg-green-500/15 text-green-400 border-green-500/20",
  };
  const labels: Record<string, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    done: "Done",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? ""}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

type Task = {
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
};

function TaskCard({ task }: { task: Task }) {
  const overdue =
    task.dueDate &&
    isPast(parseISO(task.dueDate)) &&
    task.status !== "done";

  return (
    <Link
      href={`/projects/${task.projectId}/tasks/${task.id}`}
      data-testid={`card-task-${task.id}`}
    >
      <div
        className={cn(
          "group flex flex-col gap-2 p-4 rounded-lg border bg-card hover:border-primary/40 transition-colors cursor-pointer",
          task.priority === "high" && "border-l-4 border-l-red-500",
          task.priority === "medium" && "border-l-4 border-l-yellow-500",
          task.priority === "low" && "border-l-4 border-l-green-500"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2 flex-1">
            {task.title}
          </p>
          {overdue && (
            <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
              <AlertTriangle className="h-3 w-3" />
              Overdue
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />

          {task.projectName && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <FolderKanban className="h-3 w-3" />
              {task.projectName}
            </span>
          )}

          {task.assigneeName && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <User className="h-3 w-3" />
              {task.assigneeName}
            </span>
          )}
        </div>

        {task.dueDate && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs",
              overdue ? "text-red-400 font-medium" : "text-muted-foreground"
            )}
          >
            <Calendar className="h-3 w-3" />
            {overdue && <AlertTriangle className="h-3 w-3" />}
            Due {format(parseISO(task.dueDate), "MMM d, yyyy")}
          </div>
        )}
      </div>
    </Link>
  );
}

const FILTERS: { key: StatusFilter; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <ListTodo className="h-3.5 w-3.5" /> },
  { key: "todo", label: "To Do", icon: <ListTodo className="h-3.5 w-3.5" /> },
  { key: "in_progress", label: "In Progress", icon: <Clock className="h-3.5 w-3.5 text-blue-400" /> },
  { key: "done", label: "Done", icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> },
];

export default function TasksPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const { data: myTasks = [], isLoading } = useGetMyTasks({
    query: { queryKey: getGetMyTasksQueryKey() },
  });

  const filtered =
    filter === "all" ? myTasks : myTasks.filter((t) => t.status === filter);

  const counts = {
    all: myTasks.length,
    todo: myTasks.filter((t) => t.status === "todo").length,
    in_progress: myTasks.filter((t) => t.status === "in_progress").length,
    done: myTasks.filter((t) => t.status === "done").length,
  };

  return (
    <Layout>
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1
            className="text-2xl font-bold tracking-tight"
            data-testid="heading-tasks"
          >
            My Tasks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            All tasks assigned to you across every project
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-6 bg-muted/50 rounded-lg p-1 w-fit">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              data-testid={`filter-${f.key}`}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                filter === f.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  filter === f.key
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 text-center border border-dashed border-border rounded-lg">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {filter === "all" ? "No tasks assigned to you" : `No ${filter.replace("_", " ")} tasks`}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Ask a project admin to assign tasks to you
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
