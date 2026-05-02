import { Outlet, Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";

export default function PortalShell() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center border-b border-border px-6">
        <Link to="/portal">
          <Logo />
        </Link>
        <span className="ml-3 rounded-input bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          Portal de cliente
        </span>
      </header>
      <main className="flex-1 px-4 py-10 md:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
