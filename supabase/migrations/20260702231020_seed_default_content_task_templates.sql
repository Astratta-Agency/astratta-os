insert into public.content_task_templates
  (workspace_id, post_type, subtask_key, title, task_type, default_role, offset_days, sort_order)
select
  w.id, tmpl.post_type, tmpl.subtask_key, tmpl.title, tmpl.task_type, tmpl.default_role, tmpl.offset_days, tmpl.sort_order
from public.workspaces w
cross join (values
  (null::post_type, 'copywriting', 'Copywriting: {{post_title}}', 'produccion'::task_type, 'content_creator', 7, 1),
  (null::post_type, 'design',      'Diseño: {{post_title}}',       'produccion'::task_type, 'designer',        5, 2),
  (null::post_type, 'review',      'Revisión interna: {{post_title}}', 'revision'::task_type, null,            3, 3),
  (null::post_type, 'scheduling',  'Programación: {{post_title}}', 'admin'::task_type,       'content_creator', 1, 4),
  (null::post_type, 'publishing',  'Publicación: {{post_title}}',  'admin'::task_type,       'content_creator', 0, 5)
) as tmpl(post_type, subtask_key, title, task_type, default_role, offset_days, sort_order)
on conflict do nothing;
