import { UsersRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useUserContext } from "@/hooks/useUserContext";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useTeamMembers, useWorkspaceTasks } from "@/hooks/useTeam";
import { TeamMembersTable } from "@/components/team/team-members-table";
import { MemberAssignmentsCard } from "@/components/team/member-assignments-card";
import { MemberPerformanceCard } from "@/components/team/member-performance-card";
import { TimeTrackingCard } from "@/components/team/time-tracking-card";
import { FreelancerPaymentsCard } from "@/components/team/freelancer-payments-card";

export default function Equipo() {
  const { workspace, isLoading: wsLoading } = useActiveWorkspace();
  const { data: ctx } = useUserContext();
  const { user } = useAuth();
  const membership = ctx?.workspaces?.find((w) => w.workspace_id === workspace?.id);
  const isOwner = membership?.role === "owner";

  const workspaceId = workspace?.id;
  const { data: members = [], isLoading: mLoading } = useTeamMembers(workspaceId);
  const { data: projects = [] } = useProjects(workspaceId, {
    statuses: ["planning", "in_progress"],
  });
  const { data: tasks = [] } = useWorkspaceTasks(workspaceId);

  const loading = wsLoading || !workspace || mLoading;

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-3">
        <UsersRound className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Equipo</h1>
          <p className="mt-1 text-base text-muted-foreground">Miembros, capacidad y desempeño</p>
        </div>
      </header>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Tabs defaultValue="miembros">
          <TabsList>
            <TabsTrigger value="miembros">Miembros</TabsTrigger>
            <TabsTrigger value="asignaciones">Asignaciones</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="time">Time tracking</TabsTrigger>
            <TabsTrigger value="pagos">Pagos a freelancers</TabsTrigger>
          </TabsList>

          <TabsContent value="miembros" className="pt-4">
            <TeamMembersTable workspaceId={workspace!.id} members={members} isOwner={!!isOwner} />
          </TabsContent>

          <TabsContent value="asignaciones" className="pt-4">
            <MemberAssignmentsCard
              members={members}
              projects={projects}
              tasks={tasks}
              currentUserId={user?.id ?? null}
              isOwner={!!isOwner}
            />
          </TabsContent>

          <TabsContent value="performance" className="pt-4">
            <MemberPerformanceCard
              workspaceId={workspace!.id}
              members={members}
              tasks={tasks}
              isOwner={!!isOwner}
            />
          </TabsContent>

          <TabsContent value="time" className="pt-4">
            <TimeTrackingCard
              workspaceId={workspace!.id}
              members={members}
              currentUserId={user?.id ?? null}
              isOwner={!!isOwner}
            />
          </TabsContent>

          <TabsContent value="pagos" className="pt-4">
            <FreelancerPaymentsCard
              workspaceId={workspace!.id}
              members={members}
              isOwner={!!isOwner}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
