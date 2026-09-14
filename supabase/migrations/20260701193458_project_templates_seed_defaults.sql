-- NOTA AL VERSIONAR (2026-08-08)
--
-- Esta migración de datos semilla incrusta el UUID del workspace de Astratta
-- ('1e14b4d7-...'). Tal cual está, NO es reproducible en un entorno nuevo:
-- fallaría por FK contra un workspace que no existe.
--
-- Se conserva literal para que el historial refleje lo que realmente se aplicó
-- en producción. Cuando se implemente el alta autoservicio de agencias
-- (Fase 1 del roadmap), estas plantillas deberían sembrarse desde el trigger
-- de creación de workspace, no desde una migración con un id fijo.

-- Social Media Management
with ins as (
  insert into public.project_templates (workspace_id, project_type, name, description, is_default, is_active)
  values ('1e14b4d7-9584-48be-adef-72e97b39d335', 'social_media', 'Onboarding — Social Media Management', 'Plantilla default de onboarding para proyectos de gestión de redes sociales.', true, true)
  returning id
)
insert into public.project_template_tasks (template_id, title, description, type, priority, offset_days, estimated_hours, checklist_items, position)
select id, v.title, v.description, v.type::public.task_type, v.priority::public.task_priority, v.offset_days, v.estimated_hours, v.checklist_items, v.position
from ins, (values
  ('Solicitar accesos del cliente', 'Recopilar accesos necesarios para operar las cuentas del cliente.', 'admin', 'p0', 0, 1.0, array['Instagram Business','Facebook / Meta Business Suite','Google Analytics (si aplica)','Carpeta compartida (Drive)'], 0),
  ('Reunión de kickoff con el cliente', 'Alinear objetivos, tono de marca y expectativas del primer mes.', 'reunion', 'p1', 1, 1.0, array[]::text[], 1),
  ('Auditoría inicial de redes sociales', 'Análisis de perfiles actuales, benchmark de competencia y oportunidades.', 'revision', 'p1', 0, 3.0, array['Analizar perfiles actuales','Benchmark de competencia','Reporte de auditoría entregado'], 2),
  ('Calendario de contenido — Mes 1', 'Construir y aprobar el calendario del primer mes.', 'produccion', 'p1', 3, 4.0, array['Definir pilares de contenido','Crear calendario mes 1','Aprobación del cliente'], 3),
  ('Configurar reporte mensual', 'Dejar armado el template de reporte de resultados.', 'admin', 'p2', 5, 1.0, array[]::text[], 4)
) as v(title, description, type, priority, offset_days, estimated_hours, checklist_items, position);

-- Web Development
with ins as (
  insert into public.project_templates (workspace_id, project_type, name, description, is_default, is_active)
  values ('1e14b4d7-9584-48be-adef-72e97b39d335', 'web_dev', 'Onboarding — Web Development', 'Plantilla default de onboarding para proyectos de desarrollo web.', true, true)
  returning id
)
insert into public.project_template_tasks (template_id, title, description, type, priority, offset_days, estimated_hours, checklist_items, position)
select id, v.title, v.description, v.type::public.task_type, v.priority::public.task_priority, v.offset_days, v.estimated_hours, v.checklist_items, v.position
from ins, (values
  ('Kickoff técnico y levantamiento de requerimientos', 'Reunión inicial para definir alcance técnico.', 'reunion', 'p0', 0, 1.5, array[]::text[], 0),
  ('Solicitar accesos: hosting, dominio, DNS', 'Recopilar accesos técnicos necesarios para el proyecto.', 'admin', 'p0', 0, 1.0, array['Hosting','Dominio / DNS','Repositorio (si existe)','CMS actual (si existe)'], 1),
  ('Auditoría técnica / SEO inicial', 'Revisión del sitio actual (si aplica) y oportunidades técnicas.', 'revision', 'p1', 2, 3.0, array[]::text[], 2),
  ('Definir stack y cronograma', 'Confirmar tecnología a usar y plan de entregas.', 'admin', 'p1', 1, 1.0, array[]::text[], 3),
  ('Wireframes / arquitectura del sitio', 'Primera propuesta de estructura y navegación.', 'produccion', 'p1', 5, 4.0, array[]::text[], 4)
) as v(title, description, type, priority, offset_days, estimated_hours, checklist_items, position);

-- Paid Ads
with ins as (
  insert into public.project_templates (workspace_id, project_type, name, description, is_default, is_active)
  values ('1e14b4d7-9584-48be-adef-72e97b39d335', 'paid_ads', 'Onboarding — Paid Ads', 'Plantilla default de onboarding para proyectos de pauta paga.', true, true)
  returning id
)
insert into public.project_template_tasks (template_id, title, description, type, priority, offset_days, estimated_hours, checklist_items, position)
select id, v.title, v.description, v.type::public.task_type, v.priority::public.task_priority, v.offset_days, v.estimated_hours, v.checklist_items, v.position
from ins, (values
  ('Solicitar accesos: Meta Ads, Google Ads, Analytics', 'Recopilar accesos a cuentas publicitarias y de medición.', 'admin', 'p0', 0, 1.0, array['Meta Ads Manager','Google Ads','Google Analytics','Pixel / conversiones existentes'], 0),
  ('Auditoría de cuentas publicitarias', 'Revisar historial de campañas y performance previa (si existe).', 'revision', 'p0', 1, 2.5, array[]::text[], 1),
  ('Definir estrategia y presupuesto — Mes 1', 'Plan de campañas, audiencias y presupuesto inicial.', 'admin', 'p1', 2, 2.0, array[]::text[], 2),
  ('Configurar tracking / píxeles', 'Instalar y validar tracking de conversiones.', 'produccion', 'p0', 3, 2.0, array[]::text[], 3),
  ('Lanzar primeras campañas', 'Publicar y activar las campañas iniciales.', 'produccion', 'p1', 7, 3.0, array[]::text[], 4)
) as v(title, description, type, priority, offset_days, estimated_hours, checklist_items, position);

-- Graphic Design
with ins as (
  insert into public.project_templates (workspace_id, project_type, name, description, is_default, is_active)
  values ('1e14b4d7-9584-48be-adef-72e97b39d335', 'graphic_design', 'Onboarding — Graphic Design', 'Plantilla default de onboarding para proyectos de diseño gráfico.', true, true)
  returning id
)
insert into public.project_template_tasks (template_id, title, description, type, priority, offset_days, estimated_hours, checklist_items, position)
select id, v.title, v.description, v.type::public.task_type, v.priority::public.task_priority, v.offset_days, v.estimated_hours, v.checklist_items, v.position
from ins, (values
  ('Solicitar brand assets del cliente', 'Recopilar materiales de marca existentes.', 'admin', 'p0', 0, 1.0, array['Logo (vector)','Manual de marca','Fuentes','Fotografías / assets'], 0),
  ('Brief creativo y moodboard', 'Definir dirección creativa junto al cliente.', 'produccion', 'p1', 0, 2.0, array[]::text[], 1),
  ('Primeras propuestas de diseño', 'Entregar primer set de conceptos.', 'produccion', 'p1', 4, 5.0, array[]::text[], 2),
  ('Ronda de revisión con cliente', 'Presentar propuestas y recoger feedback.', 'revision', 'p1', 6, 1.0, array[]::text[], 3)
) as v(title, description, type, priority, offset_days, estimated_hours, checklist_items, position);

-- Branding
with ins as (
  insert into public.project_templates (workspace_id, project_type, name, description, is_default, is_active)
  values ('1e14b4d7-9584-48be-adef-72e97b39d335', 'branding', 'Onboarding — Branding', 'Plantilla default de onboarding para proyectos de branding.', true, true)
  returning id
)
insert into public.project_template_tasks (template_id, title, description, type, priority, offset_days, estimated_hours, checklist_items, position)
select id, v.title, v.description, v.type::public.task_type, v.priority::public.task_priority, v.offset_days, v.estimated_hours, v.checklist_items, v.position
from ins, (values
  ('Kickoff de branding y research', 'Entender el negocio, la industria y la competencia.', 'reunion', 'p0', 0, 1.5, array[]::text[], 0),
  ('Auditoría de marca actual', 'Revisar identidad visual y percepción actual (si existe).', 'revision', 'p1', 1, 2.0, array[]::text[], 1),
  ('Moodboard y territorios creativos', 'Explorar direcciones visuales posibles.', 'produccion', 'p1', 5, 4.0, array[]::text[], 2),
  ('Presentación de conceptos', 'Presentar propuestas de marca al cliente.', 'produccion', 'p1', 10, 2.0, array[]::text[], 3)
) as v(title, description, type, priority, offset_days, estimated_hours, checklist_items, position);

-- Auditoría / Diagnóstico
with ins as (
  insert into public.project_templates (workspace_id, project_type, name, description, is_default, is_active)
  values ('1e14b4d7-9584-48be-adef-72e97b39d335', 'audit', 'Onboarding — Auditoría / Diagnóstico', 'Plantilla default de onboarding para proyectos de auditoría.', true, true)
  returning id
)
insert into public.project_template_tasks (template_id, title, description, type, priority, offset_days, estimated_hours, checklist_items, position)
select id, v.title, v.description, v.type::public.task_type, v.priority::public.task_priority, v.offset_days, v.estimated_hours, v.checklist_items, v.position
from ins, (values
  ('Recopilar accesos y datos del cliente', 'Obtener accesos necesarios para ejecutar la auditoría.', 'admin', 'p0', 0, 1.0, array[]::text[], 0),
  ('Ejecutar auditoría', 'Correr el diagnóstico completo (ver módulo Diagnóstico).', 'revision', 'p0', 1, 3.0, array[]::text[], 1),
  ('Generar reporte de diagnóstico', 'Consolidar hallazgos en el reporte final.', 'produccion', 'p1', 3, 2.0, array[]::text[], 2),
  ('Presentar hallazgos al cliente', 'Reunión de entrega de resultados.', 'reunion', 'p1', 4, 1.0, array[]::text[], 3)
) as v(title, description, type, priority, offset_days, estimated_hours, checklist_items, position);
