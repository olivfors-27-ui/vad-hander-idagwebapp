-- Profiler med användarnamn, moderatorroll, publika event med granskning,
-- följningar och sponsring.
--
-- Allt som rör behörighet ligger i databasen: en användare kan inte göra sig
-- själv till moderator, inte publicera ett event utan granskning och inte
-- sponsra ett event som inte är godkänt.

-- ---------------------------------------------------------------- profiler

alter table public.profiles
  add column if not exists username text,
  add column if not exists is_moderator boolean not null default false;

-- Sökning mot profiler kräver läsrättighet på hela tabellen (endast namn,
-- användarnamn och emoji finns där – aldrig mejl eller lösenordsdata).
grant select on public.profiles to anon, authenticated;

-- Backfill: befintliga konton får ett användarnamn byggt från visningsnamnet.
do $$
declare
  row_record record;
  base text;
  candidate text;
  counter int;
begin
  for row_record in
    select id, name from public.profiles where username is null or btrim(username) = ''
  loop
    base := lower(regexp_replace(coalesce(nullif(row_record.name, ''), 'user'), '[^a-zA-Z0-9_]', '', 'g'));
    base := left(coalesce(nullif(base, ''), 'user'), 24);
    candidate := base;
    counter := 0;
    while exists (select 1 from public.profiles where lower(username) = candidate) loop
      counter := counter + 1;
      candidate := left(base, 24) || counter::text;
    end loop;
    update public.profiles set username = candidate where id = row_record.id;
  end loop;
end
$$;

alter table public.profiles
  alter column username set not null,
  alter column username set default 'user';

create unique index if not exists profiles_username_key on public.profiles (lower(username));

-- Nytt konto = ny profilrad med användarnamn och display name. Användarnamnet
-- kommer från registreringen, annars från namnet/mejladressen, och görs unikt.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base text;
  candidate text;
  counter int := 0;
begin
  base := lower(regexp_replace(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, 'user'), '@', 1),
      'user'
    ),
    '[^a-zA-Z0-9_]', '', 'g'
  ));
  base := left(coalesce(nullif(base, ''), 'user'), 24);
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = candidate) loop
    counter := counter + 1;
    candidate := left(base, 24) || counter::text;
  end loop;

  insert into public.profiles (id, name, username, avatar_emoji)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    candidate,
    '🙂'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Bara service_role (trigger) får skapa profiler. Inloggade får uppdatera
-- namn, emoji och användarnamn – aldrig is_moderator.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant insert (id, name, username, avatar_emoji) on public.profiles to authenticated;
grant update (name, username, avatar_emoji) on public.profiles to authenticated;

-- Endast Oliver och William är moderatorer.
--
-- Rollen pinnas på konto-id i public.moderators, inte på användarnamn. Att bara
-- matcha på username skulle innebära att den som registrerar "oliver" innan
-- det riktiga kontot finns får rollen nästa gång filen körs.
create table if not exists public.moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.moderators enable row level security;
-- Ingen klient får läsa, lägga till eller ta bort moderatorer. Endast
-- security-definer-funktionerna nedan och service_role kommer åt tabellen.
revoke all on public.moderators from anon, authenticated;
grant all on public.moderators to service_role;

-- Engångsseedning: första körningen fångar de två kontona. Därefter är listan
-- stängd – nya konton med samma användarnamn påverkar aldrig rollen.
insert into public.moderators (user_id)
select p.id from public.profiles p
where lower(btrim(p.username)) in ('oliver', 'william')
  and not exists (select 1 from public.moderators)
on conflict (user_id) do nothing;

-- profiles.is_moderator är en spegling för UI:t; sanningen är moderators-tabellen.
create or replace function public.sync_moderator_flag()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles p
  set is_moderator = exists (
    select 1 from public.moderators m where m.user_id = p.id
  )
  where p.id = coalesce(new.user_id, old.user_id);
  return null;
end;
$$;

drop trigger if exists moderators_sync_flag on public.moderators;
create trigger moderators_sync_flag
  after insert or delete on public.moderators
  for each row execute function public.sync_moderator_flag();

-- Städa bort gamla flaggor och spegla den pinnade listan.
update public.profiles p
set is_moderator = exists (select 1 from public.moderators m where m.user_id = p.id);
-- Kontroll: select p.username, p.is_moderator from public.profiles p
--           join public.moderators m on m.user_id = p.id;

create or replace function public.is_moderator(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.moderators m where m.user_id = p_user);
$$;
revoke all on function public.is_moderator(uuid) from public;
grant execute on function public.is_moderator(uuid) to anon, authenticated;

-- ------------------------------------------------------------- följningar

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

alter table public.follows enable row level security;
-- Följningar är bara läsbara för inloggade, inte för anonyma besökare.
grant select on public.follows to authenticated;
grant insert, delete on public.follows to authenticated;

drop policy if exists "Follows are public" on public.follows;
create policy "Follows are public" on public.follows
  for select to authenticated using (true);

drop policy if exists "Users follow as themselves" on public.follows;
create policy "Users follow as themselves" on public.follows
  for insert to authenticated with check (follower_id = auth.uid());

drop policy if exists "Users unfollow as themselves" on public.follows;
create policy "Users unfollow as themselves" on public.follows
  for delete to authenticated using (follower_id = auth.uid());

-- ----------------------------------------------------------- publika event

create table if not exists public.public_events (
  id text primary key,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  organizer_name text not null default '',
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  -- Sponsringsstatus i databasen: 'none' eller 'sponsored'. Ändras bara via
  -- RPC:n sponsor_public_event, aldrig av klienten.
  sponsor_status text not null default 'none'
    check (sponsor_status in ('none', 'sponsored')),
  sponsored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabellen kan redan finnas i en äldre form: `create table if not exists`
-- hoppar då över hela skapandet, så varje kolumn läggs till för sig. Utan det
-- här stupar policyn nedan på en databas där sponsring hette `sponsored`
-- i stället för `sponsor_status`.
alter table public.public_events
  add column if not exists organizer_name text not null default '',
  add column if not exists payload jsonb,
  add column if not exists status text not null default 'pending',
  add column if not exists rejection_reason text,
  add column if not exists sponsor_status text not null default 'none',
  add column if not exists sponsored_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Behåll gamla sponsringsflaggor: `sponsored = true` blir 'sponsored'.
-- Policyer som nämner den gamla kolumnen måste bort först, annars vägrar
-- Postgres att ta bort kolumnen (2BP01: "other objects depend on it").
-- De återskapas längre ned i filen, mot sponsor_status i stället.
do $$
declare
  p record;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_events'
      and column_name = 'sponsored'
  ) then
    execute $mig$
      update public.public_events
      set sponsor_status = case when sponsored then 'sponsored' else 'none' end
    $mig$;
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'public_events'
        and (coalesce(qual, '') like '%sponsored%'
          or coalesce(with_check, '') like '%sponsored%')
    loop
      execute format('drop policy %I on public.public_events', p.policyname);
    end loop;
    execute 'alter table public.public_events drop column sponsored';
  end if;
end
$$;

-- Samma kontroller som create table ovan ger; äldre tabeller saknar dem.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.public_events'::regclass
      and conname = 'public_events_status_check'
  ) then
    alter table public.public_events
      add constraint public_events_status_check
      check (status in ('pending', 'approved', 'rejected'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.public_events'::regclass
      and conname = 'public_events_sponsor_status_check'
  ) then
    alter table public.public_events
      add constraint public_events_sponsor_status_check
      check (sponsor_status in ('none', 'sponsored'));
  end if;
end
$$;

create index if not exists public_events_status_idx on public.public_events (status);
create index if not exists public_events_organizer_idx on public.public_events (organizer_id);

alter table public.public_events enable row level security;

grant select on public.public_events to anon, authenticated;
grant insert on public.public_events to authenticated;
-- Uppdatering är kolumnbegränsad: ägaren får ändra innehållet, men aldrig
-- status eller sponsor_status. Det sker bara via RPC:erna nedan.
grant update (payload, organizer_name) on public.public_events to authenticated;
grant delete on public.public_events to authenticated;

drop policy if exists "Approved events are public" on public.public_events;
create policy "Approved events are public" on public.public_events
  for select using (
    status = 'approved'
    or organizer_id = auth.uid()
    or public.is_moderator(auth.uid())
  );

drop policy if exists "Logged in creates own events" on public.public_events;
create policy "Logged in creates own events" on public.public_events
  for insert to authenticated
  with check (
    organizer_id = auth.uid()
    and status = 'pending'
    and sponsor_status = 'none'
  );

drop policy if exists "Organizers update own events" on public.public_events;
create policy "Organizers update own events" on public.public_events
  for update to authenticated
  using (organizer_id = auth.uid())
  with check (organizer_id = auth.uid());

drop policy if exists "Moderators update any event" on public.public_events;
create policy "Moderators update any event" on public.public_events
  for update to authenticated
  using (public.is_moderator(auth.uid()))
  with check (public.is_moderator(auth.uid()));

drop policy if exists "Organizers delete own events" on public.public_events;
create policy "Organizers delete own events" on public.public_events
  for delete to authenticated using (organizer_id = auth.uid());

drop trigger if exists public_events_touch_updated_at on public.public_events;
create trigger public_events_touch_updated_at
  before update on public.public_events
  for each row execute function public.touch_updated_at();

-- Granskning: endast moderatorer. RPC:n körs som ägaren och kan därför ändra
-- status trots att den kolumnen saknar update-privilegium för klienten.
create or replace function public.moderate_public_event(
  p_event_id text,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.public_events%rowtype;
begin
  if not public.is_moderator(auth.uid()) then
    raise exception 'Only moderators can review events' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Invalid review status' using errcode = '22023';
  end if;

  update public.public_events
  set status = p_status,
      rejection_reason = case when p_status = 'rejected' then coalesce(p_reason, 'Uppfyller inte riktlinjerna.') else null end,
      updated_at = now()
  where id = p_event_id
  returning * into updated;

  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', updated.id,
    'status', updated.status,
    'rejectionReason', updated.rejection_reason,
    'sponsorStatus', updated.sponsor_status
  );
end;
$$;
revoke all on function public.moderate_public_event(text, text, text) from public;
grant execute on function public.moderate_public_event(text, text, text) to authenticated;

-- Sponsring: bara ägaren, bara efter godkännande, och bara en gång.
create or replace function public.sponsor_public_event(p_event_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.public_events%rowtype;
begin
  select * into target from public.public_events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if target.organizer_id <> auth.uid() then
    raise exception 'Only the organizer can sponsor this event' using errcode = '42501';
  end if;
  if target.status <> 'approved' then
    raise exception 'The event must be approved before it can be sponsored' using errcode = '22023';
  end if;

  update public.public_events
  set sponsor_status = 'sponsored',
      sponsored_at = coalesce(sponsored_at, now()),
      updated_at = now()
  where id = p_event_id
  returning * into target;

  return jsonb_build_object(
    'id', target.id,
    'status', target.status,
    'sponsorStatus', target.sponsor_status,
    'sponsoredAt', target.sponsored_at
  );
end;
$$;
revoke all on function public.sponsor_public_event(text) from public;
grant execute on function public.sponsor_public_event(text) to authenticated;

-- Inbjudnings-RPC:n: fall tillbaka på profilens namn om payloaden saknar
-- organizerName, så att inbjudaren aldrig visas som okänd.
create or replace function public.get_private_event_invite(p_code text, p_response_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pe public.private_events%rowtype;
  own_reply jsonb;
  organizer_name text;
begin
  select * into pe from public.private_events
  where upper(invite_code) = upper(trim(p_code));
  if not found then return null; end if;

  organizer_name := coalesce(
    nullif(pe.payload ->> 'organizerName', ''),
    (select p.name from public.profiles p where p.id = pe.organizer_id)
  );

  if auth.uid() is not null then
    select jsonb_build_object('userId', r.guest_key, 'name', r.guest_name, 'status', r.status)
      into own_reply from public.private_event_replies r
      where r.event_id = pe.id and r.guest_key = auth.uid()::text;
  elsif p_response_token is not null
        and length(p_response_token) = 64 and p_response_token ~ '^[0-9a-f]{64}$' then
    select jsonb_build_object('userId', r.guest_key, 'name', r.guest_name, 'status', r.status)
      into own_reply from public.private_event_replies r
      where r.event_id = pe.id
        and r.response_token_hash = digest(p_response_token, 'sha256');
  end if;

  return jsonb_build_object(
    'event', jsonb_build_object(
      'id', pe.payload->'id', 'name', pe.payload->'name',
      'category', pe.payload->'category', 'date', pe.payload->'date',
      'start', pe.payload->'start', 'end', pe.payload->'end',
      'place', pe.payload->'place', 'address', pe.payload->'address',
      'description', pe.payload->'description', 'image', pe.payload->'image',
      'organizerId', pe.organizer_id, 'organizerName', organizer_name,
      'visibility', 'private', 'status', 'approved', 'interested', '[]'::jsonb,
      'distance', 0, 'inviteCode', pe.invite_code, 'invites', '[]'::jsonb
    ),
    'ownReply', own_reply
  );
end;
$$;
revoke all on function public.get_private_event_invite(text, text) from public;
grant execute on function public.get_private_event_invite(text, text) to anon, authenticated;
