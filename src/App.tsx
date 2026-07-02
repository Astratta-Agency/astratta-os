import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import AppShell from "@/layouts/AppShell";
import PortalShell from "@/layouts/PortalShell";
import PortalRedirect from "@/pages/portal/PortalRedirect";
import ClientHome from "@/pages/portal/ClientHome";
import ClientApprovals from "@/pages/portal/ClientApprovals";
import ClientPayments from "@/pages/portal/ClientPayments";
import ClientCalendar from "@/pages/portal/ClientCalendar";
import PortalComingSoon from "@/pages/portal/PortalComingSoon";
import { RequireAgencyAuth } from "@/components/auth/RequireAgencyAuth";
import { RequireClientAuth } from "@/components/auth/RequireClientAuth";

import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Onboarding from "@/pages/Onboarding";

import Dashboard from "@/pages/app/Dashboard";
import Clientes from "@/pages/app/Clientes";
import ClienteDetalle from "@/pages/app/ClienteDetalle";
import ProyectoDetalle from "@/pages/app/ProyectoDetalle";
import Proyectos from "@/pages/app/Proyectos";
import Ventas from "@/pages/app/Ventas";
import LeadCapture from "@/pages/public/LeadCapture";
import ProposalView from "@/pages/public/ProposalView";
import ContractView from "@/pages/public/ContractView";
import Contratos from "@/pages/app/Contratos";
import ContratoDetalle from "@/pages/app/ContratoDetalle";
import Calendario from "@/pages/app/Calendario";
import Equipo from "@/pages/app/Equipo";
import Tareas from "@/pages/app/Tareas";

import Finanzas from "@/pages/app/Finanzas";
import Reportes from "@/pages/app/Reportes";
import Configuracion from "@/pages/app/Configuracion";

import PortalLogin from "@/pages/portal/Login";
import PortalForgotPassword from "@/pages/portal/ForgotPassword";
import PortalResetPassword from "@/pages/portal/ResetPassword";


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
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Public lead capture (embeddable in astrattaagency.com) */}
          <Route path="/leads/nuevo/:workspaceSlug" element={<LeadCapture />} />

          {/* Public proposal view (e-signature) */}
          <Route path="/propuestas/:token" element={<ProposalView />} />
          <Route path="/contratos/:token" element={<ContractView />} />

          {/* Onboarding (gated, but allowed before onboarded_at is set) */}
          <Route
            path="/onboarding"
            element={
              <RequireAgencyAuth allowUnonboarded>
                <Onboarding />
              </RequireAgencyAuth>
            }
          />

          {/* Agency app shell */}
          <Route
            path="/app"
            element={
              <RequireAgencyAuth>
                <AppShell />
              </RequireAgencyAuth>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:slug" element={<ClienteDetalle />} />
            <Route path="ventas" element={<Ventas />} />
            <Route path="contratos" element={<Contratos />} />
            <Route path="contratos/:id" element={<ContratoDetalle />} />
            <Route path="proyectos" element={<Proyectos />} />
            <Route path="proyectos/:id" element={<ProyectoDetalle />} />
            <Route path="calendario" element={<Calendario />} />
            <Route path="equipo" element={<Equipo />} />
            <Route path="tareas" element={<Tareas />} />
            <Route path="finanzas" element={<Finanzas />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="configuracion" element={<Configuracion />} />
          </Route>

          {/* Client portal — public auth */}
          <Route path="/portal/login" element={<PortalLogin />} />
          <Route path="/portal/forgot-password" element={<PortalForgotPassword />} />
          <Route path="/portal/reset-password" element={<PortalResetPassword />} />

          {/* Client portal — bare /portal: route by membership */}
          <Route
            path="/portal"
            element={
              <RequireClientAuth>
                <PortalRedirect />
              </RequireClientAuth>
            }
          />

          {/* Client portal — gated shell */}
          <Route
            path="/portal/:slug"
            element={
              <RequireClientAuth>
                <PortalShell />
              </RequireClientAuth>
            }
          >
            <Route index element={<ClientHome />} />
            <Route path="aprobaciones" element={<ClientApprovals />} />
            <Route path="pagos" element={<ClientPayments />} />
            <Route path="calendario" element={<ClientCalendar />} />
            <Route path="documentos" element={<PortalComingSoon section="Documentos" />} />
            <Route path="reportes" element={<PortalComingSoon section="Reportes" />} />
            <Route path="activos" element={<PortalComingSoon section="Activos" />} />
            <Route path="credenciales" element={<PortalComingSoon section="Credenciales" />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
