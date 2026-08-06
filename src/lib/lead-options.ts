// Shared option lists for lead capture — used by both the public lead form
// (src/pages/public/LeadCapture.tsx) and the internal "Nuevo lead" dialog
// (src/components/sales/new-lead-dialog.tsx) so the two stay in sync.

export const SERVICE_OPTIONS = [
  "Social Media Management",
  "Branding / Diseño",
  "Desarrollo Web",
  "Publicidad (Ads)",
] as const;

export const REFERRAL_OPTIONS = [
  "Instagram",
  "Facebook",
  "TikTok",
  "LinkedIn",
  "Google / Búsqueda web",
  "Referido",
  "Otro",
] as const;
