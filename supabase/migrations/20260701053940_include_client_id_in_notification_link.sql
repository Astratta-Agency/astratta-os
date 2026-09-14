create or replace function public.notify_post_status_change()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_workspace_id uuid;
  v_client_name text;
  v_post_title text;
begin
  if OLD.status = NEW.status then
    return NEW;
  end if;

  if NEW.status not in ('approved','rejected','changes_requested') then
    return NEW;
  end if;

  select c.workspace_id, c.name into v_workspace_id, v_client_name
  from public.clients c where c.id = NEW.client_id;

  if v_workspace_id is null then
    return NEW;
  end if;

  v_post_title := coalesce(nullif(substr(coalesce(NEW.caption, NEW.title, ''), 1, 80), ''), 'Post sin título');

  insert into public.notifications (workspace_id, recipient_user_id, type, title, body, link, metadata)
  select
    v_workspace_id,
    wm.user_id,
    'post_' || NEW.status,
    case NEW.status
      when 'approved' then coalesce(v_client_name, 'El cliente') || ' aprobó un post'
      when 'rejected' then coalesce(v_client_name, 'El cliente') || ' rechazó un post'
      when 'changes_requested' then coalesce(v_client_name, 'El cliente') || ' solicitó cambios'
      else 'Actualización de post'
    end,
    v_post_title,
    '/app/calendario?post=' || NEW.id::text || '&client_id=' || NEW.client_id::text,
    jsonb_build_object(
      'post_id', NEW.id,
      'client_id', NEW.client_id,
      'new_status', NEW.status,
      'old_status', OLD.status,
      'rejection_reason', NEW.rejection_reason
    )
  from public.workspace_members wm
  where wm.workspace_id = v_workspace_id
    and wm.status = 'active'
    and wm.role in ('owner','team_member');

  return NEW;
end $$;
