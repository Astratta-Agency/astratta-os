import { SidebarTrigger } from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { UserMenu } from "@/components/user-menu";
import { NotificationsBell } from "@/components/notifications-bell";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-border bg-background px-4 md:px-6">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="h-6 w-px bg-border" aria-hidden />
      <WorkspaceSwitcher />

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <NotificationsBell />
        <UserMenu />
      </div>
    </header>
  );
}
