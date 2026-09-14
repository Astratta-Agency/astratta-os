-- Eliminar creación automática de tareas al crear/publicar una publicación
drop trigger if exists tl_generate_content_subtasks on public.social_posts;
