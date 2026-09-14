-- Habilitar el nuevo tipo de notificación de contratos
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'post_approved','post_rejected','post_changes_requested','invite_accepted',
    'payment_received','contract_expiring','new_lead','proposal_signed',
    'task_assigned','contract_signed'
  ]));

-- Retirar el trigger de onboarding que vivía en "propuesta firmada" (sustituto temporal)
drop trigger if exists trg_proposals_create_onboarding_tasks on public.proposals;
drop function if exists public.trg_create_onboarding_tasks();

-- RPC: contrafirma de la agencia. SECURITY DEFINER porque contract_signatures
-- no tiene policy de insert (solo se escribe vía edge function de service role
-- para la firma del cliente, o vía este RPC para la firma de la agencia).
create or replace function public.countersign_contract(
  p_contract_id uuid,
  p_signer_name text,
  p_signature_data_url text
)
returns public.contracts
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_contract public.contracts;
begin
  select * into v_contract from public.contracts where id = p_contract_id;
  if v_contract.id is null then
    raise exception 'Contract not found';
  end if;
  if not public.can_write_workspace(v_contract.workspace_id) then
    raise exception 'Not authorized';
  end if;
  if v_contract.status <> 'signed_by_client' then
    raise exception 'Contract must be signed by client before countersigning';
  end if;

  insert into public.contract_signatures (contract_id, signer_role, signer_name, signature_data_url, consent_text, signed_at)
  values (p_contract_id, 'agency', p_signer_name, p_signature_data_url, 'Firma electrónica en representación de la agencia.', now());

  update public.contracts
  set status = 'countersigned', countersigned_at = now(), updated_at = now()
  where id = p_contract_id
  returning * into v_contract;

  return v_contract;
end;
$$;

revoke execute on function public.countersign_contract(uuid, text, text) from public;
grant execute on function public.countersign_contract(uuid, text, text) to authenticated;

-- Nuevo trigger de onboarding: se dispara cuando el contrato queda contrasignado
-- (firmado por ambas partes). Usa client_id (los contratos siempre tienen cliente real).
create or replace function public.trg_contract_countersigned_onboarding()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_client record;
begin
  if NEW.status = 'countersigned' and (OLD.status is distinct from 'countersigned') then
    select id, name into v_client from public.clients where id = NEW.client_id;
    if v_client.id is not null then
      insert into public.tasks (workspace_id, client_id, project_id, contract_id, title, description, type, priority, due_date, created_by)
      values
        (NEW.workspace_id, NEW.client_id, NEW.project_id, NEW.id, 'Enviar bienvenida a ' || v_client.name, 'Mandar email/mensaje de bienvenida tras la firma del contrato.', 'admin', 'p1', current_date + 1, NEW.created_by),
        (NEW.workspace_id, NEW.client_id, NEW.project_id, NEW.id, 'Solicitar accesos y credenciales', 'Pedir accesos a redes sociales, sitio web y demás plataformas necesarias.', 'admin', 'p1', current_date + 2, NEW.created_by),
        (NEW.workspace_id, NEW.client_id, NEW.project_id, NEW.id, 'Agendar llamada de kickoff', 'Coordinar la primera reunión de arranque del proyecto.', 'reunion', 'p1', current_date + 3, NEW.created_by),
        (NEW.workspace_id, NEW.client_id, NEW.project_id, NEW.id, 'Crear carpeta compartida (Drive)', 'Crear y compartir la carpeta de archivos del cliente.', 'admin', 'p2', current_date + 1, NEW.created_by),
        (NEW.workspace_id, NEW.client_id, NEW.project_id, NEW.id, 'Configurar pilares de contenido', 'Definir los pilares de contenido iniciales para el cliente (si aplica).', 'produccion', 'p2', current_date + 5, NEW.created_by);
    end if;

    perform public.notify_workspace_members(
      NEW.workspace_id,
      'contract_signed',
      'Contrato contrafirmado: ' || NEW.title,
      'El contrato quedó firmado por ambas partes y las tareas de onboarding se crearon automáticamente.',
      '/app/contratos?contract=' || NEW.id::text
    );
  end if;
  return NEW;
end;
$$;

revoke execute on function public.trg_contract_countersigned_onboarding() from public, anon, authenticated;

create trigger trg_contracts_countersigned_onboarding
after update on public.contracts
for each row execute function public.trg_contract_countersigned_onboarding();

-- Notificación cuando el cliente firma (falta contrafirma)
create or replace function public.trg_notify_contract_signed_by_client()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if NEW.status = 'signed_by_client' and (OLD.status is distinct from 'signed_by_client') then
    perform public.notify_workspace_members(
      NEW.workspace_id,
      'contract_signed',
      'Cliente firmó el contrato: ' || NEW.title,
      'Falta la contrafirma de la agencia para activar el contrato.',
      '/app/contratos?contract=' || NEW.id::text
    );
  end if;
  return NEW;
end;
$$;

revoke execute on function public.trg_notify_contract_signed_by_client() from public, anon, authenticated;

create trigger trg_contracts_notify_signed_by_client
after update on public.contracts
for each row execute function public.trg_notify_contract_signed_by_client();
