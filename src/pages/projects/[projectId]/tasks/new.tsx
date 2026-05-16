import { useParams, useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateTask,
  useGetProject,
  getGetProjectQueryKey,
  getListProjectTasksQueryKey,
} from "@/lib/api";
import type { TaskInput, TaskInputStatus, TaskInputPriority } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewTaskPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = parseInt(projectId, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createTask = useCreateTask();

  const { data: project } = useGetProject(pid, {
    query: { enabled: !!pid, queryKey: getGetProjectQueryKey(pid) },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", priority: "medium", status: "todo", dueDate: "", assigneeId: "" },
  });

  function onSubmit(data: FormValues) {
    const payload: TaskInput = {
      title: data.title,
      priority: data.priority as TaskInputPriority,
      status: data.status as TaskInputStatus,
    };
    if (data.description) payload.description = data.description;
    if (data.dueDate) payload.dueDate = data.dueDate;
    if (data.assigneeId && data.assigneeId !== "unassigned") payload.assigneeId = parseInt(data.assigneeId, 10);

    createTask.mutate(
      { projectId: pid, data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectTasksQueryKey(pid) });
          toast({ title: "Task created" });
          setLocation(`/projects/${pid}`);
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to create task";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      }
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
          <CardHeader>
            <CardTitle>New Task</CardTitle>
            <CardDescription>Add a task to {project?.name ?? "this project"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Task title" data-testid="input-title" {...field} />
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
                      <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Textarea placeholder="What needs to be done?" rows={3} data-testid="input-description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority">
                              <SelectValue placeholder="Select priority" />
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
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Select status" />
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
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due date <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-due-date" {...field} />
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
                        <FormLabel>Assignee <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={createTask.isPending} data-testid="button-submit">
                    {createTask.isPending ? "Creating..." : "Create Task"}
                  </Button>
                  <Link href={`/projects/${pid}`}>
                    <Button type="button" variant="outline" data-testid="button-cancel">Cancel</Button>
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
