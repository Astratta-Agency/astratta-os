import { useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useAuth } from "@/hooks/useAuth";

interface Props {
  /** Where "Mi perfil" navigates. Defaults to the agency settings page. */
  profilePath?: string;
  /** Where to redirect after signing out. Defaults to the agency login. */
  loginPath?: string;
}

export function UserMenu({ profilePath = "/app/configuracion", loginPath = "/login" }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const email = user?.email ?? "invitado@astrattaos.com";
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.first_name as string | undefined) ||
    null;
  const initials = (displayName?.[0] ?? email[0] ?? "A").toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate(loginPath, { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs text-muted-foreground">Sesión iniciada como</p>
          {displayName && (
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
          )}
          <p className={`truncate text-sm ${displayName ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
            {email}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(profilePath)}>
          <UserIcon className="mr-2 h-4 w-4" />
          Mi perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
