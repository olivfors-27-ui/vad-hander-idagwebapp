-- Max 5 event per konto och dag i stället för 5 totalt.
--
-- Räknaren utgår från eventets created_at och nollställs vid midnatt svensk
-- tid, oavsett var databasen står. Gamla event räknas alltså inte längre, så
-- ett konto som redan har fem event kan skapa nya nästa dag.

create or replace function public.enforce_event_creation_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
  max_events_per_day constant integer := 5;
  day_start timestamptz :=
    date_trunc('day', now() at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm';
begin
  select
    (select count(*) from public.private_events
      where organizer_id = new.organizer_id and created_at >= day_start)
    + (select count(*) from public.public_events
      where organizer_id = new.organizer_id and created_at >= day_start)
  into used;

  if used >= max_events_per_day then
    raise exception 'event_limit_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Triggers already exist from 20261020120000; recreate them so this file also
-- works on a database where only this migration added the function.
drop trigger if exists private_events_creation_limit on public.private_events;
create trigger private_events_creation_limit
  before insert on public.private_events
  for each row execute function public.enforce_event_creation_limit();

drop trigger if exists public_events_creation_limit on public.public_events;
create trigger public_events_creation_limit
  before insert on public.public_events
  for each row execute function public.enforce_event_creation_limit();
