import { useParams, useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetProject,
  getGetProjectQueryKey,
  useUpdateProject,
  useDeleteProject,
  useAddProjectMember,
  useRemoveProjectMember,
  useListUsers,
  getListUsersQueryKey,
  getListProjectsQueryKey,
} from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Trash2, UserPlus, UserMinus, Loader2, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const editSchema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
});

type EditForm = z.infer<typeof editSchema>;

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = parseInt(projectId, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [addUserId, setAddUserId] = useState("");

  const { data: project, isLoading } = useGetProject(pid, {
    query: { enabled: !!pid, queryKey: getGetProjectQueryKey(pid) },
  });

  const { data: allUsers = [] } = useListUsers({
    query: { queryKey: getListUsersQueryKey() },
  });

  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    if (project) {
      form.reset({ name: project.name, description: project.description ?? "" });
    }
  }, [project, form]);

  function onSave(data: EditForm) {
    updateProject.mutate(
      { projectId: pid, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(pid) });
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          toast({ title: "Project updated" });
        },
        onError: () => toast({ title: "Error", description: "Update failed", variant: "destructive" }),
      }
    );
  }

  function handleDelete() {
    if (!confirm("Delete this project and all its tasks?")) return;
    deleteProject.mutate(
      { projectId: pid },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          toast({ title: "Project deleted" });
          setLocation("/projects");
        },
        onError: () => toast({ title: "Error", description: "Delete failed", variant: "destructive" }),
      }
    );
  }

  function handleAddMember() {
    if (!addUserId || addUserId === "pick") return;
    addMember.mutate(
      { projectId: pid, data: { userId: parseInt(addUserId, 10), role: "member" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(pid) });
          setAddUserId("");
          toast({ title: "Member added" });
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to add member";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      }
    );
  }

  function handleRemoveMember(userId: number) {
    if (!confirm("Remove this member?")) return;
    removeMember.mutate(
      { projectId: pid, userId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(pid) });
          toast({ title: "Member removed" });
        },
        onError: () => toast({ title: "Error", description: "Failed to remove member", variant: "destructive" }),
      }
    );
  }

  const memberIds = new Set(project?.members.map((m) => m.userId) ?? []);
  const nonMembers = allUsers.filter((u) => !memberIds.has(u.id));

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!project || project.myRole !== "admin") {
    return (
      <Layout>
        <div className="px-6 py-6 text-center text-muted-foreground">Admin access required</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-6 py-6 max-w-2xl mx-auto space-y-6">
        <Link href={`/projects/${pid}`}>
          <Button variant="ghost" size="sm" className="-ml-1 text-muted-foreground" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {project.name}
          </Button>
        </Link>

        {/* Edit project */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project name</FormLabel>
                      <FormControl>
                        <Input data-testid="input-name" {...field} />
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
                        <Textarea rows={2} data-testid="input-description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={updateProject.isPending} data-testid="button-save">
                  {updateProject.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {project.members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between" data-testid={`member-row-${m.userId}`}>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {m.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  {m.role === "admin" && (
                    <Crown className="h-3.5 w-3.5 text-amber-400" />
                  )}
                </div>
                {m.userId !== user?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-7 w-7"
                    onClick={() => handleRemoveMember(m.userId)}
                    data-testid={`button-remove-member-${m.userId}`}
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}

            {nonMembers.length > 0 && (
              <div className="flex gap-2 pt-2 border-t border-border">
                <Select value={addUserId} onValueChange={setAddUserId}>
                  <SelectTrigger className="flex-1" data-testid="select-add-member">
                    <SelectValue placeholder="Select a user to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {nonMembers.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddMember}
                  disabled={!addUserId || addUserId === "pick" || addMember.isPending}
                  size="sm"
                  data-testid="button-add-member"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Delete this project</p>
                <p className="text-xs text-muted-foreground">This will permanently delete all tasks</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteProject.isPending}
                data-testid="button-delete-project"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Delete Project
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
