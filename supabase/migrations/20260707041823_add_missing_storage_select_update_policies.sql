-- storage-api usa INSERT ... RETURNING / ON CONFLICT en uploads (especialmente upsert).
-- Sin política SELECT, la fila nueva no es visible y el insert falla con
-- "new row violates row-level security policy". Añadimos SELECT (y UPDATE en client-media).

create policy "workspace-logos select member"
on storage.objects for select to authenticated
using (
  bucket_id = 'workspace-logos'
  and exists (
    select 1 from public.workspace_members wm
    where wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.workspace_id::text = (storage.foldername(name))[1]
  )
);

create policy "client-media select member"
on storage.objects for select to authenticated
using (
  bucket_id = 'client-media'
  and auth.uid() is not null
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

create policy "client-media update member"
on storage.objects for update to authenticated
using (
  bucket_id = 'client-media'
  and auth.uid() is not null
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'client-media'
  and auth.uid() is not null
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);
