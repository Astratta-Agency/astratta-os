import { createContext, useContext } from "react";

export type CalendarClientInfo = {
  id: string;
  name: string;
  logo_url?: string | null;
  brand_primary_color?: string | null;
};

/**
 * Presente solo en la vista "Todos los clientes": las tarjetas y la lista
 * muestran a qué cliente pertenece cada post. Sin provider (un solo cliente
 * o el portal) no se muestra nada.
 */
const CalendarClientsContext = createContext<Map<string, CalendarClientInfo> | null>(null);

export const CalendarClientsProvider = CalendarClientsContext.Provider;

export function useCalendarClient(clientId: string): CalendarClientInfo | null {
  const map = useContext(CalendarClientsContext);
  return map?.get(clientId) ?? null;
}

export function useCalendarClients(): Map<string, CalendarClientInfo> | null {
  return useContext(CalendarClientsContext);
}
