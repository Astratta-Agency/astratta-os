-- El equipo puede marcar una publicación como Programado/Publicado sin pasar
-- por la aprobación del cliente. Ese salto se registra en el historial con la
-- acción `approval_skipped`. Solo la inserta el equipo (workspace); la policy
-- de inserción del cliente del portal no cambia.
alter table public.content_approval_history drop constraint content_approval_history_action_check;
alter table public.content_approval_history add constraint content_approval_history_action_check
  check (action = any (array['sent_for_approval'::text,'approved'::text,'rejected'::text,'changes_requested'::text,'resent'::text,'auto_expired'::text,'approval_skipped'::text]));
