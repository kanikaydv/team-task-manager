import {
  useGetDashboardStats,
  useGetOverdueTasks,
  useGetMyTasks,
  getGetDashboardStatsQueryKey,
  getGetOverdueTasksQueryKey,
  getGetMyTasksQueryKey,
} from "@/lib/api";
import type { DashboardStats } from "@/lib/api";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  CheckCircle2, Clock, AlertTriangle, FolderKanban,
  ListTodo, Loader2, TrendingUp, Calendar,
} from "lucide-react";
import { isPast, parseISO, format } from "date-fns";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { cn } from "@/lib/utils";

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    high: "bg-red-500/15 text-red-400 border-red-500/20",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    low: "bg-green-500/15 text-green-400 border-green-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[priority] ?? ""}`}>
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
  const labels: Record<string, string> = { todo: "To Do", in_progress: "In Progress", done: "Done" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? ""}`}>
      {labels[status] ?? status}
    </span>
  );
}

const STAT_CARDS: Array<{
  label: string;
  key: string;
  icon: React.ElementType;
  iconColor: string;
  border: string;
  value: (s: DashboardStats) => number;
  textColor: string;
}> = [
  {
    label: "Total Tasks",
    key: "totalTasks",
    icon: ListTodo,
    iconColor: "text-primary",
    border: "border-l-primary",
    value: (s) => s.totalTasks,
    textColor: "text-foreground",
  },
  {
    label: "In Progress",
    key: "inProgressTasks",
    icon: Clock,
    iconColor: "text-blue-400",
    border: "border-l-blue-500",
    value: (s) => s.inProgressTasks,
    textColor: "text-blue-400",
  },
  {
    label: "Completed",
    key: "doneTasks",
    icon: CheckCircle2,
    iconColor: "text-green-400",
    border: "border-l-green-500",
    value: (s) => s.doneTasks,
    textColor: "text-green-400",
  },
  {
    label: "Overdue",
    key: "overdueTasks",
    icon: AlertTriangle,
    iconColor: "text-red-400",
    border: "border-l-red-500",
    value: (s) => s.overdueTasks,
    textColor: "text-red-400",
  },
  {
    label: "My Tasks",
    key: "myAssignedTasks",
    icon: TrendingUp,
    iconColor: "text-violet-400",
    border: "border-l-violet-500",
    value: (s) => s.myAssignedTasks,
    textColor: "text-violet-400",
  },
  {
    label: "Projects",
    key: "totalProjects",
    icon: FolderKanban,
    iconColor: "text-muted-foreground",
    border: "border-l-border",
    value: (s) => s.totalProjects,
    textColor: "text-foreground",
  },
];

const STATUS_COLORS: Record<string, string> = {
  "To Do": "#6b7280",
  "In Progress": "#3b82f6",
  "Done": "#22c55e",
};

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() },
  });
  const { data: overdue = [], isLoading: overdueLoading } = useGetOverdueTasks({
    query: { queryKey: getGetOverdueTasksQueryKey() },
  });
  const { data: myTasks = [], isLoading: myTasksLoading } = useGetMyTasks({
    query: { queryKey: getGetMyTasksQueryKey() },
  });

  const pieData = stats && stats.totalTasks > 0
    ? [
        { name: "To Do", value: stats.todoTasks },
        { name: "In Progress", value: stats.inProgressTasks },
        { name: "Done", value: stats.doneTasks },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <Layout>
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-dashboard">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Your workspace at a glance</p>
        </div>

        {/* Stat cards */}
        {statsLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {STAT_CARDS.map((card) => {
              const Icon = card.icon;
              const val = stats ? card.value(stats) : 0;
              return (
                <Card
                  key={card.label}
                  className={cn(
                    "border-l-4 hover:-translate-y-0.5 hover:shadow-md transition-all",
                    card.border
                  )}
                >
                  <CardContent className="pt-4 pb-4 px-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
                      <Icon className={cn("h-4 w-4", card.iconColor)} />
                    </div>
                    <span
                      className={cn("text-2xl font-bold", card.textColor)}
                      data-testid={`stat-${card.label.toLowerCase().replace(" ", "-")}`}
                    >
                      {val}
                    </span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Tasks by Status — Donut chart */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Tasks by Status</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center h-44">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : pieData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-44 text-center">
                  <ListTodo className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-xs text-muted-foreground">No tasks yet</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={68}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={STATUS_COLORS[entry.name] ?? "#6b7280"}
                            strokeWidth={0}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-1">
                    {[
                      { label: "To Do", value: stats?.todoTasks ?? 0, color: "bg-gray-500" },
                      { label: "In Progress", value: stats?.inProgressTasks ?? 0, color: "bg-blue-500" },
                      { label: "Done", value: stats?.doneTasks ?? 0, color: "bg-green-500" },
                    ].map((row) => {
                      const total = stats?.totalTasks ?? 0;
                      const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
                      return (
                        <div key={row.label} className="flex items-center gap-2 text-xs">
                          <div className={cn("h-2 w-2 rounded-full shrink-0", row.color)} />
                          <span className="w-20 text-muted-foreground">{row.label}</span>
                          <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", row.color)} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-5 text-right text-muted-foreground">{row.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Progress by Project */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Progress by Project</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center h-44">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !stats || stats.tasksByProject.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-44 text-center">
                  <FolderKanban className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-xs text-muted-foreground">No projects yet</p>
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  {stats.tasksByProject.map((p) => {
                    const pct = p.taskCount > 0 ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
                    return (
                      <div key={p.projectId} data-testid={`project-progress-${p.projectId}`}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-medium truncate max-w-[140px]">{p.projectName}</span>
                          <span className="text-muted-foreground text-xs shrink-0 ml-1">{pct}%</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.doneCount} of {p.taskCount} done</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tasks per Member with mini bars */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Tasks per Member</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center h-44">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !stats || stats.tasksByUser.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-44 text-center">
                  <TrendingUp className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-xs text-muted-foreground">No assigned tasks</p>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {(() => {
                    const max = Math.max(...stats.tasksByUser.map((u) => u.taskCount), 1);
                    return stats.tasksByUser.map((u) => (
                      <div key={u.userId} className="flex items-center gap-2" data-testid={`user-tasks-${u.userId}`}>
                        <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {u.userName[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium truncate">{u.userName}</span>
                            <span className="text-muted-foreground ml-1">{u.taskCount}</span>
                          </div>
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${Math.round((u.taskCount / max) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Overdue + My Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                Overdue Tasks
                {overdue.length > 0 && (
                  <Badge variant="destructive" className="ml-auto">{overdue.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overdueLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : overdue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-400/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No overdue tasks</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {overdue.slice(0, 6).map((task) => (
                    <Link
                      key={task.id}
                      href={`/projects/${task.projectId}/tasks/${task.id}`}
                      data-testid={`task-overdue-${task.id}`}
                      className="flex items-start justify-between p-2.5 rounded-md border border-red-500/10 bg-red-500/5 hover:border-red-500/30 transition-colors cursor-pointer group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{task.projectName}</p>
                        {task.dueDate && (
                          <span className="flex items-center gap-1 text-xs text-red-400 font-medium mt-1">
                            <Calendar className="h-3 w-3" />
                            Due {format(parseISO(task.dueDate), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                        <PriorityBadge priority={task.priority} />
                        <span className="text-xs text-red-400 font-medium flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" />
                          Overdue
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                My Assigned Tasks
                {myTasks.length > 0 && (
                  <Link href="/tasks" className="ml-auto text-xs text-primary hover:underline font-normal">
                    View all
                  </Link>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myTasksLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : myTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ListTodo className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-sm text-muted-foreground">No tasks assigned to you</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myTasks.slice(0, 6).map((task) => {
                    const taskOverdue = task.dueDate && isPast(parseISO(task.dueDate)) && task.status !== "done";
                    return (
                      <Link
                        key={task.id}
                        href={`/projects/${task.projectId}/tasks/${task.id}`}
                        data-testid={`task-mine-${task.id}`}
                        className="flex items-start justify-between p-2.5 rounded-md border border-border hover:border-primary/30 hover:bg-accent/30 transition-colors cursor-pointer group"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {task.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{task.projectName}</p>
                          {task.dueDate && (
                            <span className={cn("flex items-center gap-1 text-xs mt-1", taskOverdue ? "text-red-400 font-medium" : "text-muted-foreground")}>
                              <Calendar className="h-3 w-3" />
                              {taskOverdue && <AlertTriangle className="h-3 w-3" />}
                              {format(parseISO(task.dueDate), "MMM d")}
                            </span>
                          )}
                        </div>
                        <div className="ml-2 shrink-0">
                          <StatusBadge status={task.status} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
