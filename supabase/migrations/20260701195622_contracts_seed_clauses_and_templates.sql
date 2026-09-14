-- NOTA AL VERSIONAR (2026-08-08)
--
-- Datos semilla con dos ataduras a un solo inquilino:
--   1. El UUID del workspace de Astratta ('1e14b4d7-...') va incrustado, así que
--      esta migración no se puede reproducir tal cual en un entorno nuevo.
--   2. Las cláusulas legales se rigen por las leyes del Estado de Texas. Cada
--      agencia que contrate el producto necesitará su propia jurisdicción y su
--      propio texto legal revisado por un abogado — no se pueden heredar.
--
-- Se conserva literal para reflejar lo aplicado en producción. En la Fase 1 del
-- roadmap estas plantillas deberían sembrarse por workspace en el alta, con la
-- jurisdicción como parámetro.

-- Cláusulas legales reusables (Texas-compliant, boilerplate editable)
insert into public.contract_clauses (workspace_id, title, body, category) values
('1e14b4d7-9584-48be-adef-72e97b39d335', 'Alcance de servicios', 'La Agencia prestará al Cliente los servicios descritos en el Anexo de Alcance de este contrato ("Servicios"). Cualquier trabajo adicional no contemplado en el alcance original deberá acordarse por escrito mediante una adenda y podrá generar cargos adicionales.', 'general'),
('1e14b4d7-9584-48be-adef-72e97b39d335', 'Plazo y vigencia', 'Este contrato entra en vigor en la Fecha de Inicio y permanece vigente hasta la Fecha de Término indicada, salvo terminación anticipada conforme a la cláusula de Terminación. Si se marca renovación automática, el contrato se renovará por períodos iguales salvo aviso de no renovación con al menos 30 días de anticipación.', 'general'),
('1e14b4d7-9584-48be-adef-72e97b39d335', 'Honorarios y forma de pago', 'El Cliente pagará a la Agencia los honorarios indicados en este contrato. Los pagos se realizarán según el cronograma acordado. Los pagos vencidos por más de 7 días podrán generar un cargo por mora del 1.5% mensual y la Agencia podrá suspender los Servicios hasta regularizar el pago.', 'pago'),
('1e14b4d7-9584-48be-adef-72e97b39d335', 'Confidencialidad', 'Ambas partes se comprometen a mantener confidencial toda información no pública compartida en el marco de este contrato, y a no divulgarla a terceros sin consentimiento previo por escrito, salvo requerimiento legal.', 'confidencialidad'),
('1e14b4d7-9584-48be-adef-72e97b39d335', 'Propiedad intelectual', 'Los entregables finales pagados en su totalidad serán propiedad del Cliente. La Agencia conserva el derecho de exhibir el trabajo en su portafolio salvo acuerdo en contrario por escrito. Las herramientas, procesos y metodologías propias de la Agencia permanecen de su propiedad.', 'propiedad_intelectual'),
('1e14b4d7-9584-48be-adef-72e97b39d335', 'Terminación', 'Cualquiera de las partes podrá terminar este contrato con un aviso previo por escrito de 30 días. La Agencia tiene derecho al pago de los Servicios prestados hasta la fecha efectiva de terminación. El incumplimiento grave no subsanado en 10 días podrá dar lugar a terminación inmediata.', 'terminacion'),
('1e14b4d7-9584-48be-adef-72e97b39d335', 'Limitación de responsabilidad', 'La responsabilidad total de la Agencia bajo este contrato no excederá el monto total pagado por el Cliente en los tres (3) meses previos al reclamo. Ninguna de las partes será responsable por daños indirectos, incidentales o consecuentes.', 'general'),
('1e14b4d7-9584-48be-adef-72e97b39d335', 'Ley aplicable y jurisdicción', 'Este contrato se rige por las leyes del Estado de Texas, Estados Unidos, sin dar efecto a sus disposiciones sobre conflicto de leyes. Cualquier disputa se resolverá en los tribunales competentes del condado donde la Agencia tiene su domicilio principal en Texas.', 'general');

-- Plantillas default de contrato por tipo de servicio (7.1 — versionadas, variables dinámicas)
with ins as (
  insert into public.contract_templates (workspace_id, name, service_type, is_active, content)
  values ('1e14b4d7-9584-48be-adef-72e97b39d335', 'Contrato — Social Media Management', 'social', true,
  '[
    {"type":"heading","text":"Contrato de Servicios de Social Media Management"},
    {"type":"paragraph","text":"Este contrato se celebra entre {{workspace}} (\"la Agencia\") y {{cliente}} (\"el Cliente\") con fecha de inicio {{fecha_inicio}} y fecha de término {{fecha_fin}}, por un monto total de {{precio}} {{moneda}}."},
    {"type":"clause","title":"Alcance de servicios","text":"La Agencia gestionará las redes sociales del Cliente según el siguiente alcance: {{alcance}}. Incluye calendario de contenido mensual, creación de piezas gráficas/copy, publicación y reporte de resultados."},
    {"type":"clause","title":"Plazo y vigencia","text":"Este contrato entra en vigor en la Fecha de Inicio y permanece vigente hasta la Fecha de Término indicada, salvo terminación anticipada conforme a la cláusula de Terminación."},
    {"type":"clause","title":"Honorarios y forma de pago","text":"El Cliente pagará a la Agencia {{precio}} {{moneda}} según el cronograma acordado. Los pagos vencidos por más de 7 días podrán generar un cargo por mora del 1.5% mensual."},
    {"type":"clause","title":"Confidencialidad","text":"Ambas partes mantendrán confidencial toda información no pública compartida en el marco de este contrato."},
    {"type":"clause","title":"Propiedad intelectual","text":"Los entregables finales pagados en su totalidad serán propiedad del Cliente. La Agencia conserva el derecho de exhibir el trabajo en su portafolio salvo acuerdo en contrario."},
    {"type":"clause","title":"Terminación","text":"Cualquiera de las partes podrá terminar este contrato con un aviso previo por escrito de 30 días."},
    {"type":"clause","title":"Limitación de responsabilidad","text":"La responsabilidad total de la Agencia no excederá el monto pagado por el Cliente en los tres (3) meses previos al reclamo."},
    {"type":"clause","title":"Ley aplicable y jurisdicción","text":"Este contrato se rige por las leyes del Estado de Texas, Estados Unidos."}
  ]'::jsonb)
  returning id
) select 1 from ins;

insert into public.contract_templates (workspace_id, name, service_type, is_active, content)
values ('1e14b4d7-9584-48be-adef-72e97b39d335', 'Contrato — Web Development', 'web', true,
'[
  {"type":"heading","text":"Contrato de Servicios de Desarrollo Web"},
  {"type":"paragraph","text":"Este contrato se celebra entre {{workspace}} (\"la Agencia\") y {{cliente}} (\"el Cliente\") con fecha de inicio {{fecha_inicio}} y fecha de término {{fecha_fin}}, por un monto total de {{precio}} {{moneda}}."},
  {"type":"clause","title":"Alcance de servicios","text":"La Agencia diseñará y desarrollará el sitio web del Cliente según el siguiente alcance: {{alcance}}. Incluye diseño, desarrollo, pruebas y entrega/publicación."},
  {"type":"clause","title":"Plazo y vigencia","text":"Este contrato entra en vigor en la Fecha de Inicio y permanece vigente hasta la entrega final o la Fecha de Término indicada."},
  {"type":"clause","title":"Honorarios y forma de pago","text":"El Cliente pagará a la Agencia {{precio}} {{moneda}} según el cronograma acordado (habitualmente 50% al inicio, 50% a la entrega)."},
  {"type":"clause","title":"Confidencialidad","text":"Ambas partes mantendrán confidencial toda información no pública compartida en el marco de este contrato."},
  {"type":"clause","title":"Propiedad intelectual","text":"El código y entregables finales pagados en su totalidad serán propiedad del Cliente. Librerías y componentes de terceros se rigen por sus propias licencias."},
  {"type":"clause","title":"Terminación","text":"Cualquiera de las partes podrá terminar este contrato con un aviso previo por escrito de 30 días."},
  {"type":"clause","title":"Limitación de responsabilidad","text":"La responsabilidad total de la Agencia no excederá el monto pagado por el Cliente en los tres (3) meses previos al reclamo."},
  {"type":"clause","title":"Ley aplicable y jurisdicción","text":"Este contrato se rige por las leyes del Estado de Texas, Estados Unidos."}
]'::jsonb);

insert into public.contract_templates (workspace_id, name, service_type, is_active, content)
values ('1e14b4d7-9584-48be-adef-72e97b39d335', 'Contrato — Paid Ads', 'ads', true,
'[
  {"type":"heading","text":"Contrato de Servicios de Publicidad Paga (Paid Ads)"},
  {"type":"paragraph","text":"Este contrato se celebra entre {{workspace}} (\"la Agencia\") y {{cliente}} (\"el Cliente\") con fecha de inicio {{fecha_inicio}} y fecha de término {{fecha_fin}}, por un monto total de {{precio}} {{moneda}} (no incluye gasto publicitario/ad spend, que corre por cuenta del Cliente)."},
  {"type":"clause","title":"Alcance de servicios","text":"La Agencia gestionará las campañas publicitarias del Cliente según el siguiente alcance: {{alcance}}. Incluye estrategia, configuración de campañas, optimización y reportes."},
  {"type":"clause","title":"Plazo y vigencia","text":"Este contrato entra en vigor en la Fecha de Inicio y permanece vigente hasta la Fecha de Término indicada, salvo terminación anticipada."},
  {"type":"clause","title":"Honorarios y forma de pago","text":"El Cliente pagará a la Agencia {{precio}} {{moneda}} por gestión, más el gasto publicitario directamente en las plataformas correspondientes."},
  {"type":"clause","title":"Confidencialidad","text":"Ambas partes mantendrán confidencial toda información no pública compartida en el marco de este contrato."},
  {"type":"clause","title":"Propiedad intelectual","text":"Los entregables finales pagados en su totalidad serán propiedad del Cliente. Las cuentas publicitarias permanecen propiedad del Cliente."},
  {"type":"clause","title":"Terminación","text":"Cualquiera de las partes podrá terminar este contrato con un aviso previo por escrito de 30 días."},
  {"type":"clause","title":"Limitación de responsabilidad","text":"La responsabilidad total de la Agencia no excederá el monto pagado por el Cliente en los tres (3) meses previos al reclamo. La Agencia no garantiza resultados específicos de las plataformas publicitarias."},
  {"type":"clause","title":"Ley aplicable y jurisdicción","text":"Este contrato se rige por las leyes del Estado de Texas, Estados Unidos."}
]'::jsonb);

insert into public.contract_templates (workspace_id, name, service_type, is_active, content)
values ('1e14b4d7-9584-48be-adef-72e97b39d335', 'Contrato — Branding', 'branding', true,
'[
  {"type":"heading","text":"Contrato de Servicios de Branding"},
  {"type":"paragraph","text":"Este contrato se celebra entre {{workspace}} (\"la Agencia\") y {{cliente}} (\"el Cliente\") con fecha de inicio {{fecha_inicio}} y fecha de término {{fecha_fin}}, por un monto total de {{precio}} {{moneda}}."},
  {"type":"clause","title":"Alcance de servicios","text":"La Agencia desarrollará la identidad de marca del Cliente según el siguiente alcance: {{alcance}}. Incluye research, moodboard, propuesta de identidad visual y manual de marca."},
  {"type":"clause","title":"Plazo y vigencia","text":"Este contrato entra en vigor en la Fecha de Inicio y permanece vigente hasta la entrega final o la Fecha de Término indicada."},
  {"type":"clause","title":"Honorarios y forma de pago","text":"El Cliente pagará a la Agencia {{precio}} {{moneda}} según el cronograma acordado."},
  {"type":"clause","title":"Confidencialidad","text":"Ambas partes mantendrán confidencial toda información no pública compartida en el marco de este contrato."},
  {"type":"clause","title":"Propiedad intelectual","text":"La identidad de marca final pagada en su totalidad será propiedad del Cliente. La Agencia conserva el derecho de exhibir el trabajo en su portafolio salvo acuerdo en contrario."},
  {"type":"clause","title":"Terminación","text":"Cualquiera de las partes podrá terminar este contrato con un aviso previo por escrito de 30 días."},
  {"type":"clause","title":"Limitación de responsabilidad","text":"La responsabilidad total de la Agencia no excederá el monto pagado por el Cliente en los tres (3) meses previos al reclamo."},
  {"type":"clause","title":"Ley aplicable y jurisdicción","text":"Este contrato se rige por las leyes del Estado de Texas, Estados Unidos."}
]'::jsonb);

insert into public.contract_templates (workspace_id, name, service_type, is_active, content)
values ('1e14b4d7-9584-48be-adef-72e97b39d335', 'Contrato — Bundle de Servicios', 'bundle', true,
'[
  {"type":"heading","text":"Contrato de Servicios (Bundle)"},
  {"type":"paragraph","text":"Este contrato se celebra entre {{workspace}} (\"la Agencia\") y {{cliente}} (\"el Cliente\") con fecha de inicio {{fecha_inicio}} y fecha de término {{fecha_fin}}, por un monto total de {{precio}} {{moneda}}."},
  {"type":"clause","title":"Alcance de servicios","text":"La Agencia prestará al Cliente un conjunto combinado de servicios según el siguiente alcance: {{alcance}}."},
  {"type":"clause","title":"Plazo y vigencia","text":"Este contrato entra en vigor en la Fecha de Inicio y permanece vigente hasta la Fecha de Término indicada, salvo terminación anticipada."},
  {"type":"clause","title":"Honorarios y forma de pago","text":"El Cliente pagará a la Agencia {{precio}} {{moneda}} según el cronograma acordado."},
  {"type":"clause","title":"Confidencialidad","text":"Ambas partes mantendrán confidencial toda información no pública compartida en el marco de este contrato."},
  {"type":"clause","title":"Propiedad intelectual","text":"Los entregables finales pagados en su totalidad serán propiedad del Cliente. La Agencia conserva el derecho de exhibir el trabajo en su portafolio salvo acuerdo en contrario."},
  {"type":"clause","title":"Terminación","text":"Cualquiera de las partes podrá terminar este contrato con un aviso previo por escrito de 30 días."},
  {"type":"clause","title":"Limitación de responsabilidad","text":"La responsabilidad total de la Agencia no excederá el monto pagado por el Cliente en los tres (3) meses previos al reclamo."},
  {"type":"clause","title":"Ley aplicable y jurisdicción","text":"Este contrato se rige por las leyes del Estado de Texas, Estados Unidos."}
]'::jsonb);
