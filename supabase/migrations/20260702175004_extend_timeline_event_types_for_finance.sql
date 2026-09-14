alter table public.client_timeline_events drop constraint client_timeline_events_event_type_check;
alter table public.client_timeline_events add constraint client_timeline_events_event_type_check
  check (event_type = any (array[
    'client_created','client_updated','project_created','project_status_changed',
    'contact_added','contact_updated','note_updated','manual',
    'invoice_status_changed','invoice_paid'
  ]));
