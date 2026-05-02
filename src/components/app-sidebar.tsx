import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarDays,
  CheckSquare,
  DollarSign,
  BarChart3,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/brand/Logo";
import { SidebarUserMenu } from "@/components/sidebar-user-menu";

const mainItems = [
  { title: "Dashboard", url: "/app/dashboard", icon: LayoutDashboard },
  { title: "Clientes", url: "/app/clientes", icon: Users },
  { title: "Proyectos", url: "/app/proyectos", icon: Briefcase },
  { title: "Calendario de contenido", url: "/app/calendario", icon: CalendarDays },
  { title: "Tareas", url: "/app/tareas", icon: CheckSquare },
  { title: "Finanzas", url: "/app/finanzas", icon: DollarSign },
  { title: "Reportes", url: "/app/reportes", icon: BarChart3 },
];

const footerItems = [{ title: "Configuración", url: "/app/configuracion", icon: Settings }];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const renderItem = ({ title, url, icon: Icon }: (typeof mainItems)[number]) => {
    const active = isActive(url);
    return (
      <SidebarMenuItem key={title}>
        <SidebarMenuButton asChild isActive={active} tooltip={title}>
          <NavLink
            to={url}
            className={`relative flex items-center gap-3 rounded-input px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
            }`}
          >
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-secondary"
              />
            )}
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="font-medium">{title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader
        className={`border-b border-sidebar-border bg-sidebar py-4 ${
          collapsed ? "px-2" : "px-4"
        }`}
      >
        <div className={`flex items-center ${collapsed ? "justify-center" : ""}`}>
          {collapsed ? <Logo mark /> : <Logo variant="light" />}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{mainItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-sidebar">
        <SidebarMenu>{footerItems.map(renderItem)}</SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
