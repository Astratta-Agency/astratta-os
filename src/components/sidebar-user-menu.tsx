import { useNavigate } from "react-router-dom";
import { ChevronsUpDown, LogOut, RefreshCw, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { signOut, useAuth } from "@/hooks/useAuth";

export function SidebarUserMenu() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const email = user?.email ?? "invitado@astrattaos.com";
  const name = (user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? email.split("@")[0];
  const initials = (name[0] ?? "A").toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={name}
              className="data-[state=open]:bg-sidebar-accent hover:bg-sidebar-accent"
            >
              <Avatar className="h-8 w-8 rounded-md">
                <AvatarFallback className="rounded-md bg-primary text-xs font-bold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-semibold text-sidebar-foreground">{name}</span>
                    <span className="truncate text-xs text-sidebar-muted">{email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto h-4 w-4 text-sidebar-muted" />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={collapsed ? "right" : "top"}
            align="start"
            className="w-56"
          >
            <DropdownMenuLabel className="font-normal">
              <p className="text-xs text-muted-foreground">Sesión iniciada como</p>
              <p className="truncate text-sm font-semibold text-foreground">{email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/app/configuracion")}>
              <UserIcon className="mr-2 h-4 w-4" />
              Mi perfil
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <RefreshCw className="mr-2 h-4 w-4" />
              Cambiar workspace
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
