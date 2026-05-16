import { useListProjects, getListProjectsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Plus, FolderKanban, Users, CheckSquare, Loader2, Crown } from "lucide-react";

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useListProjects({
    query: { queryKey: getListProjectsQueryKey() },
  });

  return (
    <Layout>
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-projects">Projects</h1>
            <p className="text-muted-foreground text-sm mt-1">All projects you are part of</p>
          </div>
          <Link href="/projects/new">
            <Button size="sm" data-testid="button-new-project">
              <Plus className="h-4 w-4 mr-1.5" />
              New Project
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-border rounded-lg">
            <FolderKanban className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-sm font-medium text-muted-foreground">No projects yet</h3>
            <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Create your first project to get started</p>
            <Link href="/projects/new">
              <Button size="sm" data-testid="button-create-first-project">
                <Plus className="h-4 w-4 mr-1.5" />
                Create Project
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} data-testid={`card-project-${project.id}`}>
                <Card className="hover:border-primary/40 transition-colors cursor-pointer group h-full">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded bg-primary/15 flex items-center justify-center">
                          <FolderKanban className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate max-w-[160px]">
                            {project.name}
                          </h3>
                          {project.myRole === "admin" && (
                            <span className="flex items-center gap-0.5 text-xs text-amber-400">
                              <Crown className="h-3 w-3" />
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {project.myRole}
                      </Badge>
                    </div>

                    {project.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckSquare className="h-3 w-3" />
                        {project.taskCount} tasks
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {project.memberCount} members
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
