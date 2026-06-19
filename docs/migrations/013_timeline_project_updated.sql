-- Allow 'project_updated' event_type in client_timeline_events
alter table public.client_timeline_events
  drop constraint if exists client_timeline_events_event_type_check;

alter table public.client_timeline_events
  add constraint client_timeline_events_event_type_check
  check (event_type in (
    'client_created','client_updated','project_created','project_status_changed',
    'project_updated','contact_added','contact_updated','note_updated','manual'
  ));
