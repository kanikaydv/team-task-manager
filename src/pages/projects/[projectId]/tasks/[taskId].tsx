import { useParams, useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetTask,
  getGetTaskQueryKey,
  useUpdateTask,
  useDeleteTask,
  useGetProject,
  getGetProjectQueryKey,
  getListProjectTasksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const schema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["todo", "in_progress", "done"]),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function TaskDetailPage() {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
  const pid = parseInt(projectId, 10);
  const tid = parseInt(taskId, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const { data: task, isLoading: taskLoading } = useGetTask(pid, tid, {
    query: { enabled: !!pid && !!tid, queryKey: getGetTaskQueryKey(pid, tid) },
  });

  const { data: project } = useGetProject(pid, {
    query: { enabled: !!pid, queryKey: getGetProjectQueryKey(pid) },
  });

  const isAdmin = project?.myRole === "admin";
  const isAssignee = task?.assigneeId === user?.id;
  const canEdit = isAdmin || isAssignee;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", priority: "medium", status: "todo", dueDate: "", assigneeId: "" },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description ?? "",
        priority: task.priority as "low" | "medium" | "high",
        status: task.status as "todo" | "in_progress" | "done",
        dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
        assigneeId: task.assigneeId ? String(task.assigneeId) : "unassigned",
      });
    }
  }, [task, form]);

  function onSubmit(data: FormValues) {
    const payload: Record<string, unknown> = {
      title: data.title,
      status: data.status,
    };
    if (isAdmin) {
      payload.priority = data.priority;
      payload.description = data.description ?? "";
      if (data.dueDate) payload.dueDate = data.dueDate;
      if (data.assigneeId && data.assigneeId !== "unassigned") {
        payload.assigneeId = parseInt(data.assigneeId, 10);
      }
    }

    updateTask.mutate(
      { projectId: pid, taskId: tid, data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(pid, tid) });
          queryClient.invalidateQueries({ queryKey: getListProjectTasksQueryKey(pid) });
          toast({ title: "Task updated" });
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Update failed";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      }
    );
  }

  function handleDelete() {
    if (!confirm("Delete this task?")) return;
    deleteTask.mutate(
      { projectId: pid, taskId: tid },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectTasksQueryKey(pid) });
          toast({ title: "Task deleted" });
          setLocation(`/projects/${pid}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
        },
      }
    );
  }

  if (taskLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!task) {
    return (
      <Layout>
        <div className="px-6 py-6 text-center text-muted-foreground">Task not found</div>
      </Layout>
    );
  }

  const members = project?.members ?? [];

  return (
    <Layout>
      <div className="px-6 py-6 max-w-2xl mx-auto">
        <Link href={`/projects/${pid}`}>
          <Button variant="ghost" size="sm" className="mb-4 -ml-1 text-muted-foreground" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {project?.name ?? "Project"}
          </Button>
        </Link>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Task Details</CardTitle>
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteTask.isPending}
                data-testid="button-delete-task"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!canEdit ? (
              <p className="text-sm text-muted-foreground mb-4">You can view but not edit this task.</p>
            ) : null}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Task title" disabled={!canEdit} data-testid="input-title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea rows={3} disabled={!isAdmin} data-testid="input-description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
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
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!isAdmin}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority">
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
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due date</FormLabel>
                        <FormControl>
                          <Input type="date" disabled={!isAdmin} data-testid="input-due-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="assigneeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assignee</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!isAdmin}>
                          <FormControl>
                            <SelectTrigger data-testid="select-assignee">
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {members.map((m) => (
                              <SelectItem key={m.userId} value={String(m.userId)}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {canEdit && (
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={updateTask.isPending} data-testid="button-submit">
                      {updateTask.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Link href={`/projects/${pid}`}>
                      <Button type="button" variant="outline" data-testid="button-cancel">Cancel</Button>
                    </Link>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
