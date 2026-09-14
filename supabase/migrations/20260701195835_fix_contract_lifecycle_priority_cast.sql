create or replace function public.process_contract_lifecycle()
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_contract record;
  v_days_left integer;
begin
  update public.contracts
  set status = 'active', updated_at = now()
  where status = 'countersigned'
    and (start_date is null or start_date <= current_date);

  update public.contracts
  set status = 'expired', updated_at = now()
  where status = 'active'
    and end_date is not null
    and end_date < current_date;

  for v_contract in
    select * from public.contracts
    where status = 'active' and end_date is not null and end_date >= current_date
  loop
    v_days_left := v_contract.end_date - current_date;
    if v_days_left in (30, 15, 7) then
      if not exists (
        select 1 from public.contract_alerts_log
        where contract_id = v_contract.id and threshold_days = v_days_left
      ) then
        insert into public.contract_alerts_log (contract_id, threshold_days)
        values (v_contract.id, v_days_left);

        insert into public.tasks (workspace_id, client_id, project_id, contract_id, title, description, type, priority, due_date, created_by)
        values (
          v_contract.workspace_id, v_contract.client_id, v_contract.project_id, v_contract.id,
          'Renovación de contrato: ' || v_contract.title,
          'El contrato vence el ' || to_char(v_contract.end_date, 'DD/MM/YYYY') || ' (' || v_days_left || ' días). Coordinar renovación con el cliente.',
          'admin'::public.task_type,
          (case when v_days_left <= 7 then 'p0' else 'p1' end)::public.task_priority,
          current_date, v_contract.created_by
        );

        perform public.notify_workspace_members(
          v_contract.workspace_id,
          'contract_expiring',
          'Contrato próximo a vencer: ' || v_contract.title,
          'Vence en ' || v_days_left || ' días (' || to_char(v_contract.end_date, 'DD/MM/YYYY') || ').',
          '/app/contratos?contract=' || v_contract.id::text
        );
      end if;
    end if;
  end loop;
end;
$$;

revoke execute on function public.process_contract_lifecycle() from public, anon, authenticated;
