import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import AppShell from "@/layouts/AppShell";
import PortalShell from "@/layouts/PortalShell";
import { RequireAuth } from "@/components/require-auth";

import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ResetPassword from "@/pages/ResetPassword";

import Dashboard from "@/pages/app/Dashboard";
import Clientes from "@/pages/app/Clientes";
import Proyectos from "@/pages/app/Proyectos";
import Calendario from "@/pages/app/Calendario";
import Tareas from "@/pages/app/Tareas";
import Finanzas from "@/pages/app/Finanzas";
import Reportes from "@/pages/app/Reportes";
import Configuracion from "@/pages/app/Configuracion";

import PortalLogin from "@/pages/portal/Login";
import PortalForgotPassword from "@/pages/portal/ForgotPassword";
import PortalHome from "@/pages/portal/Home";

import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Root → app */}
          <Route path="/" element={<Navigate to="/app/dashboard" replace />} />

          {/* Agency auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Agency app shell */}
          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="proyectos" element={<Proyectos />} />
            <Route path="calendario" element={<Calendario />} />
            <Route path="tareas" element={<Tareas />} />
            <Route path="finanzas" element={<Finanzas />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="configuracion" element={<Configuracion />} />
          </Route>

          {/* Client portal — public auth */}
          <Route path="/portal/login" element={<PortalLogin />} />
          <Route path="/portal/forgot-password" element={<PortalForgotPassword />} />

          {/* Client portal — gated shell */}
          <Route
            path="/portal"
            element={
              <RequireAuth redirectTo="/portal/login">
                <PortalShell />
              </RequireAuth>
            }
          >
            <Route index element={<PortalHome />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
