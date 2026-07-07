-- Plantilla de reporte v2 (basada en el reporte 180° Med Spa, jul 2026)
-- Aplicada en producción el 2026-07-06 vía MCP (apply_migration: client_reports_template_v2_sections)
alter table public.client_reports
  add column if not exists hero_stats jsonb not null default '[]'::jsonb,
  add column if not exists platform_kpis jsonb not null default '[]'::jsonb,
  add column if not exists highlight jsonb,
  add column if not exists audience jsonb not null default '[]'::jsonb,
  add column if not exists data_notes text;

comment on column public.client_reports.hero_stats is 'Stats destacadas del resumen ejecutivo: [{label, value, detail}]';
comment on column public.client_reports.platform_kpis is 'KPIs por plataforma: [{platform, metrics:[{label, value}]}]';
comment on column public.client_reports.highlight is 'Highlight del período: {title, description, stats:[{value, label, detail}], footer_note}';
comment on column public.client_reports.audience is 'Bloques de audiencia: [{title, body}]';
comment on column public.client_reports.data_notes is 'Notas de producción y datos (metodología, fuentes, limitaciones)';
