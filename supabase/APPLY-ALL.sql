-- ═══════════════════════════════════════════════════════════════════
-- HÄNDER – ALLT I ETT: klistra in hela filen i Supabase SQL Editor.
--
-- Skapad genom att sammanställa migrationerna i supabase/migrations/ i
-- filnamnsordning. Säker att köra på ett projekt som redan har plans,
-- och säker att köra flera gånger (idempotent).
--
-- Innehåller: plans/plan_replies, profiles (med användarnamn och trigger),
-- private_events + inbjudnings-RPC:er, follows, public_events med
-- granskning och sponsor_status, samt moderatorlistan.
-- ═══════════════════════════════════════════════════════════════════


-- ===================== 20260901144827_678dd63a-2da0-4d78-8ec3-902673f73f02.sql =====================

-- Delade planer. Idempotent: kan köras om på ett projekt där plans redan finns.
create table if not exists public.plans (
  id text primary key,
  code text not null unique,
  title text not null,
  note text not null default '',
  created_by text not null default '',
  options jsonb not null default '[]'::jsonb,
  slots jsonb not null default '[]'::jsonb,
  emoji text,
  gradient text,
  place text,
  event_id text,
  decided_option_id text,
  decided_slot_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_replies (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.plans(id) on delete cascade,
  name text not null,
  option_ids jsonb not null default '[]'::jsonb,
  slot_ids jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  comment text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists plan_replies_plan_name_idx
  on public.plan_replies (plan_id, lower(btrim(name)));
create index if not exists plan_replies_plan_idx on public.plan_replies (plan_id);

grant select, insert, update, delete on public.plans to anon, authenticated;
grant all on public.plans to service_role;
grant select, insert, update, delete on public.plan_replies to anon, authenticated;
grant all on public.plan_replies to service_role;

alter table public.plans enable row level security;
alter table public.plan_replies enable row level security;

drop policy if exists "Anyone can read plans" on public.plans;
drop policy if exists "Anyone can create plans" on public.plans;
drop policy if exists "Anyone can update plans" on public.plans;
drop policy if exists "Anyone can delete plans" on public.plans;

create policy "Anyone can read plans" on public.plans for select using (true);
create policy "Anyone can create plans" on public.plans for insert with check (true);
create policy "Anyone can update plans" on public.plans for update using (true) with check (true);
create policy "Anyone can delete plans" on public.plans for delete using (true);

drop policy if exists "Anyone can read replies" on public.plan_replies;
drop policy if exists "Anyone can create replies" on public.plan_replies;
drop policy if exists "Anyone can update replies" on public.plan_replies;
drop policy if exists "Anyone can delete replies" on public.plan_replies;

create policy "Anyone can read replies" on public.plan_replies for select using (true);
create policy "Anyone can create replies" on public.plan_replies for insert with check (true);
create policy "Anyone can update replies" on public.plan_replies for update using (true) with check (true);
create policy "Anyone can delete replies" on public.plan_replies for delete using (true);

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists plans_touch_updated_at on public.plans;
create trigger plans_touch_updated_at before update on public.plans
for each row execute function public.touch_updated_at();

-- Realtime är valfritt: lägg bara till tabellerna om de inte redan är med.
do $$
begin
  alter publication supabase_realtime add table public.plans;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.plan_replies;
exception when duplicate_object then null;
end $$;

-- ===================== 20260930120000_auth_profiles.sql =====================

-- Kontosystem: profiler kopplade till auth.users + plans ägda av inloggad användare.

-- 1. Profil per konto (visningsnamn + emoji-avatar)
--    Idempotent: filen ska kunna köras på ett projekt där plans redan finns
--    (t.ex. efter SETUP-NYTT-PROJEKT.sql) utan att rulla tillbaka allt.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar_emoji text not null default '🙂',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Alla kan läsa profiler (behövs för att visa namn på plans/svar),
-- men varje användare får bara läsa/uppdatera sin egen profilrad.
drop policy if exists "Profiles are public" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;

create policy "Profiles are public" on public.profiles
  for select using (true);
create policy "Users insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 2. Skapa profil automatiskt när ett konto registreras
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar_emoji)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    '🙂'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Plans får bara ändras av skaparen; läsning förblir öppen (delade länkar).
--    created_by är idag fritext (gamla rader har t.ex. 'du'), därför jämförs den
--    mot auth.uid()::text – nya rader skrivs med användarens uuid som text.
drop policy if exists "Anyone can create plans" on public.plans;
drop policy if exists "Anyone can update plans" on public.plans;
drop policy if exists "Anyone can delete plans" on public.plans;

drop policy if exists "Anyone can read plans" on public.plans;
drop policy if exists "Logged in can create plans" on public.plans;
drop policy if exists "Creator updates plan" on public.plans;
drop policy if exists "Creator deletes plan" on public.plans;

create policy "Anyone can read plans" on public.plans
  for select using (true);
create policy "Logged in can create plans" on public.plans
  for insert to authenticated with check (auth.uid()::text = created_by);
create policy "Creator updates plan" on public.plans
  for update to authenticated
  using (auth.uid()::text = created_by)
  with check (auth.uid()::text = created_by);
create policy "Creator deletes plan" on public.plans
  for delete to authenticated
  using (auth.uid()::text = created_by);

-- 4. Svar på plans: alla (även anon) kan svara på delade planer, men en
--    inloggad användare kan bara redigera egna svar.
--    user_id måste finnas innan policyn nedan refererar till den (äldre
--    plan_replies saknar kolumnen).
alter table public.plan_replies add column if not exists user_id text;

drop policy if exists "Anyone can update replies" on public.plan_replies;
drop policy if exists "Anyone can delete replies" on public.plan_replies;

drop policy if exists "Logged in updates own reply" on public.plan_replies;
drop policy if exists "Logged in deletes own reply" on public.plan_replies;

create policy "Logged in updates own reply" on public.plan_replies
  for update to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);
create policy "Logged in deletes own reply" on public.plan_replies
  for delete to authenticated
  using (auth.uid()::text = user_id);

-- 5. Kolumnen user_id binder svar till kontot (nullable: anon-svar tillåts kvar).
--    Skapas i steg 4 ovan, före policyn som använder den.

-- ===================== 20261015090000_private_event_invites.sql =====================

create table if not exists public.private_events (
  id text primary key,
  invite_code text not null unique,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.private_event_replies (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.private_events(id) on delete cascade,
  guest_key text not null,
  guest_name text not null,
  response_token_hash bytea,
  status text not null check (status in ('accepted', 'maybe', 'declined')),
  updated_at timestamptz not null default now(),
  unique (event_id, guest_key)
);

alter table public.private_events enable row level security;
alter table public.private_event_replies enable row level security;
alter table public.private_event_replies
  add column if not exists response_token_hash bytea;

grant select, insert, update, delete on public.private_events to authenticated;
grant all on public.private_events to service_role;
grant all on public.private_event_replies to service_role;

drop policy if exists "Organizers manage their private events" on public.private_events;
create policy "Organizers manage their private events"
  on public.private_events for all to authenticated
  using (auth.uid() = organizer_id)
  with check (auth.uid() = organizer_id);

-- Replace the old public RPC, which exposed every guest response by invite code.
-- Den äldre publika varianten (utan token) tas bort. Den slutgiltiga
-- definitionen av get_private_event_invite finns i
-- 20261019090000_profiles_moderation_sponsorship.sql, som också fyller på
-- inbjudarens namn från profilen när payloaden saknar organizerName.
drop function if exists public.get_private_event_invite(text);
drop function if exists public.get_private_event_invite(text, text);

create or replace function public.list_private_event_invites(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pe public.private_events%rowtype;
begin
  select * into pe from public.private_events
  where upper(invite_code) = upper(trim(p_code));
  if not found or auth.uid() is null or auth.uid() <> pe.organizer_id then
    raise exception 'Not authorized to view this guest list' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', guest_key, 'name', guest_name, 'status', status
    ) order by updated_at)
    from public.private_event_replies where event_id = pe.id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.list_private_event_invites(text) from public;
grant execute on function public.list_private_event_invites(text) to authenticated;

drop function if exists public.reply_to_private_event_invite(text, text, text, text);
create or replace function public.reply_to_private_event_invite(
  p_code text,
  p_response_token text,
  p_guest_name text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id text;
  guest_key text := case when auth.uid() is null then 'anon:' || gen_random_uuid()::text else auth.uid()::text end;
  safe_name text := left(trim(p_guest_name), 100);
  result jsonb;
  new_token text;
  token_hash bytea;
begin
  if p_status not in ('accepted', 'maybe', 'declined') then
    raise exception 'Invalid invite response' using errcode = '22023';
  end if;
  if length(safe_name) = 0 then
    raise exception 'A guest name is required' using errcode = '22023';
  end if;
  select id into target_id from public.private_events
  where upper(invite_code) = upper(trim(p_code));
  if target_id is null then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  if auth.uid() is null then
    if p_response_token is null then
      new_token := encode(gen_random_bytes(32), 'hex');
      token_hash := digest(new_token, 'sha256');
    else
      if length(p_response_token) <> 64 or p_response_token !~ '^[0-9a-f]{64}$' then
        raise exception 'Invalid guest response token' using errcode = '42501';
      end if;
      token_hash := digest(p_response_token, 'sha256');
      select r.guest_key into guest_key from public.private_event_replies r
        where r.event_id = target_id and r.response_token_hash = token_hash;
      if guest_key is null then
        raise exception 'Invalid guest response token' using errcode = '42501';
      end if;
    end if;
  end if;

  insert into public.private_event_replies
    (event_id, guest_key, guest_name, status, response_token_hash)
  values (target_id, guest_key, safe_name, p_status, token_hash)
  on conflict (event_id, guest_key) do update
    set guest_name = excluded.guest_name,
        status = excluded.status,
        response_token_hash = coalesce(excluded.response_token_hash, private_event_replies.response_token_hash),
        updated_at = now();

  select jsonb_build_object(
    'reply', jsonb_build_object('userId', guest_key, 'name', guest_name, 'status', status),
    'responseToken', new_token
  ) into result from public.private_event_replies
    where event_id = target_id and private_event_replies.guest_key = guest_key;
  return result;
end;
$$;
revoke all on function public.reply_to_private_event_invite(text, text, text, text) from public;
grant execute on function public.reply_to_private_event_invite(text, text, text, text) to anon, authenticated;

-- ===================== 20261019090000_profiles_moderation_sponsorship.sql =====================

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

-- ═══════════════════════════════════════════════════════════════════

-- ===================== 20261020120000_event_interests_limits_delete.sql =====================

-- Gästintressen, gästlista för alla som är med, hårda gränser och radering av
-- event. Allt som ska gå att lita på ligger i databasen – UI:t speglar bara
-- samma regler så att användaren får ett tydligt meddelande i tid.
--
--  * private_event_replies.interests: vad gästen anger för intressen.
--  * list_private_event_guests: gästlista (namn + intressen) för arrangören
--    och för gäster som redan svarat – inte för vem som helst med länken.
--  * max 10 deltagare (accepted/maybe) per privat event.
--  * max 5 event (privata + publika) per konto.
--  * delete_event: bara skaparen, och gästsvaren följer med via cascade.

-- ------------------------------------------------------------- intressen

alter table public.private_event_replies
  add column if not exists interests text[] not null default '{}'::text[];

-- Trimmar, tar bort tomma värden och begränsar listan så att en gäst inte kan
-- spara en oändlig mängd text.
create or replace function public.normalize_interests(p_interests text[])
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(x order by x), '{}'::text[])
  from (
    select distinct left(btrim(value), 40) as x
    from unnest(coalesce(p_interests, '{}'::text[])) as value
    where btrim(value) <> ''
    limit 8
  ) cleaned;
$$;

-- --------------------------------------------------- gästlista för medlemmar

-- Ersätter den tidigare listan så att den även innehåller intressen.
drop function if exists public.list_private_event_invites(text);
create or replace function public.list_private_event_invites(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pe public.private_events%rowtype;
begin
  select * into pe from public.private_events
  where upper(invite_code) = upper(trim(p_code));
  if not found or auth.uid() is null or auth.uid() <> pe.organizer_id then
    raise exception 'Not authorized to view this guest list' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', r.guest_key,
      'name', r.guest_name,
      'status', r.status,
      'interests', to_jsonb(r.interests)
    ) order by r.updated_at)
    from public.private_event_replies r where r.event_id = pe.id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.list_private_event_invites(text) from public;
grant execute on function public.list_private_event_invites(text) to authenticated;

-- Gästlistan som gäster ser. Kräver att man är arrangör eller redan har
-- svarat (inloggad via konto, anonym via sin hemliga response-token).
create or replace function public.list_private_event_guests(
  p_code text,
  p_response_token text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pe public.private_events%rowtype;
  viewer_key text;
  is_member boolean := false;
begin
  select * into pe from public.private_events
  where upper(invite_code) = upper(trim(p_code));
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  if auth.uid() is not null then
    viewer_key := auth.uid()::text;
    if auth.uid() = pe.organizer_id then
      is_member := true;
    end if;
  elsif p_response_token is not null
        and length(p_response_token) = 64 and p_response_token ~ '^[0-9a-f]{64}$' then
    select r.guest_key into viewer_key from public.private_event_replies r
    where r.event_id = pe.id and r.response_token_hash = digest(p_response_token, 'sha256');
  end if;

  if not is_member and viewer_key is not null then
    is_member := exists (
      select 1 from public.private_event_replies r
      where r.event_id = pe.id and r.guest_key = viewer_key
    );
  end if;

  if not is_member then
    raise exception 'Join the event to see the guest list' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', r.guest_key,
      'name', r.guest_name,
      'status', r.status,
      'interests', to_jsonb(r.interests),
      'isMe', r.guest_key = viewer_key
    ) order by r.updated_at)
    from public.private_event_replies r
    where r.event_id = pe.id and r.status in ('accepted', 'maybe')
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.list_private_event_guests(text, text) from public;
grant execute on function public.list_private_event_guests(text, text) to anon, authenticated;

-- -------------------------------------------------------- max 10 deltagare

-- Räknar "kommer" och "kanske" som deltagare. En gäst som redan står med
-- räknas inte mot sig själv, så att byta från kanske till kommer alltid går.
create or replace function public.enforce_private_event_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  taken integer;
  max_guests constant integer := 10;
begin
  if new.status not in ('accepted', 'maybe') then
    return new;
  end if;

  select count(*) into taken
  from public.private_event_replies r
  where r.event_id = new.event_id
    and r.status in ('accepted', 'maybe')
    and r.guest_key <> new.guest_key;

  if taken >= max_guests then
    raise exception 'event_full' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists private_event_replies_capacity on public.private_event_replies;
create trigger private_event_replies_capacity
  before insert or update on public.private_event_replies
  for each row execute function public.enforce_private_event_capacity();

-- --------------------------------------------- max 5 event per konto

create or replace function public.enforce_event_creation_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
  max_events constant integer := 5;
begin
  select
    (select count(*) from public.private_events where organizer_id = new.organizer_id)
    + (select count(*) from public.public_events where organizer_id = new.organizer_id)
  into used;

  if used >= max_events then
    raise exception 'event_limit_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists private_events_creation_limit on public.private_events;
create trigger private_events_creation_limit
  before insert on public.private_events
  for each row execute function public.enforce_event_creation_limit();

drop trigger if exists public_events_creation_limit on public.public_events;
create trigger public_events_creation_limit
  before insert on public.public_events
  for each row execute function public.enforce_event_creation_limit();

-- ------------------------------------------------------------- radering

-- Raderar eventet och allt som hänger på det (gästsvar via cascade). Bara
-- skaparen kan radera, och bara från sitt eget konto.
create or replace function public.delete_event(p_event_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  removed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  delete from public.private_events
  where id = p_event_id and organizer_id = auth.uid();
  removed := found;

  delete from public.public_events
  where id = p_event_id and organizer_id = auth.uid();
  if found then
    removed := true;
  end if;

  if not removed then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  return true;
end;
$$;
revoke all on function public.delete_event(text) from public;
grant execute on function public.delete_event(text) to authenticated;

-- --------------------------------------- inbjudan: egna svar + deltagarantal

-- Samma svar som förut, men egna svaret innehåller nu intressen och svaret
-- talar om hur många som redan är med (så att UI:t kan visa "Eventet är fullt"
-- redan innan gästen försöker svara).
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
  guest_count integer;
begin
  select * into pe from public.private_events
  where upper(invite_code) = upper(trim(p_code));
  if not found then return null; end if;

  organizer_name := coalesce(
    nullif(pe.payload ->> 'organizerName', ''),
    (select p.name from public.profiles p where p.id = pe.organizer_id)
  );

  select count(*) into guest_count
  from public.private_event_replies r
  where r.event_id = pe.id and r.status in ('accepted', 'maybe');

  if auth.uid() is not null then
    select jsonb_build_object(
      'userId', r.guest_key, 'name', r.guest_name, 'status', r.status,
      'interests', to_jsonb(r.interests)
    )
      into own_reply from public.private_event_replies r
      where r.event_id = pe.id and r.guest_key = auth.uid()::text;
  elsif p_response_token is not null
        and length(p_response_token) = 64 and p_response_token ~ '^[0-9a-f]{64}$' then
    select jsonb_build_object(
      'userId', r.guest_key, 'name', r.guest_name, 'status', r.status,
      'interests', to_jsonb(r.interests)
    )
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
      'distance', 0, 'inviteCode', pe.invite_code, 'invites', '[]'::jsonb,
      'guestCount', guest_count
    ),
    'ownReply', own_reply,
    'guestCount', guest_count
  );
end;
$$;
revoke all on function public.get_private_event_invite(text, text) from public;
grant execute on function public.get_private_event_invite(text, text) to anon, authenticated;

-- -------------------------------------------------- svara på inbjudan

drop function if exists public.reply_to_private_event_invite(text, text, text, text);
create or replace function public.reply_to_private_event_invite(
  p_code text,
  p_response_token text,
  p_guest_name text,
  p_status text,
  p_interests text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id text;
  -- Variabelnamnen är prefixade med v_ med flit: private_event_replies har
  -- kolumner som heter guest_key, guest_name och status, och utan prefix
  -- kastar PL/pgSQL "column reference is ambiguous" när svaret sparas.
  v_guest_key text := case when auth.uid() is null then 'anon:' || gen_random_uuid()::text else auth.uid()::text end;
  v_name text := left(trim(p_guest_name), 100);
  v_interests text[] := public.normalize_interests(p_interests);
  v_result jsonb;
  v_token text;
  v_token_hash bytea;
begin
  if p_status not in ('accepted', 'maybe', 'declined') then
    raise exception 'Invalid invite response' using errcode = '22023';
  end if;
  if length(v_name) = 0 then
    raise exception 'A guest name is required' using errcode = '22023';
  end if;
  select id into v_event_id from public.private_events
  where upper(invite_code) = upper(trim(p_code));
  if v_event_id is null then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  if auth.uid() is null then
    if p_response_token is null then
      v_token := encode(gen_random_bytes(32), 'hex');
      v_token_hash := digest(v_token, 'sha256');
    else
      if length(p_response_token) <> 64 or p_response_token !~ '^[0-9a-f]{64}$' then
        raise exception 'Invalid guest response token' using errcode = '42501';
      end if;
      v_token_hash := digest(p_response_token, 'sha256');
      select r.guest_key into v_guest_key from public.private_event_replies r
        where r.event_id = v_event_id and r.response_token_hash = v_token_hash;
      if v_guest_key is null then
        raise exception 'Invalid guest response token' using errcode = '42501';
      end if;
    end if;
  end if;

  insert into public.private_event_replies
    (event_id, guest_key, guest_name, status, interests, response_token_hash)
  values (v_event_id, v_guest_key, v_name, p_status, v_interests, v_token_hash)
  on conflict (event_id, guest_key) do update
    set guest_name = excluded.guest_name,
        status = excluded.status,
        interests = excluded.interests,
        response_token_hash = coalesce(excluded.response_token_hash, private_event_replies.response_token_hash),
        updated_at = now();

  select jsonb_build_object(
    'reply', jsonb_build_object(
      'userId', r.guest_key,
      'name', r.guest_name,
      'status', r.status,
      'interests', to_jsonb(r.interests)
    ),
    'responseToken', v_token
  )
  into v_result
  from public.private_event_replies r
  where r.event_id = v_event_id and r.guest_key = v_guest_key;
  return v_result;
end;
$$;
revoke all on function public.reply_to_private_event_invite(text, text, text, text, text[]) from public;
grant execute on function public.reply_to_private_event_invite(text, text, text, text, text[]) to anon, authenticated;
-- KONTROLL: förväntat resultat står i kommentaren efter varje fråga.

-- ═══════════════════════════════════════════════════════════════════



select table_name

from information_schema.tables

where table_schema = 'public'

order by 1;

-- 8 rader: follows, moderators, plan_replies, plans, private_event_replies,

--          private_events, profiles, public_events



select distinct proname as funktion

from pg_proc

where proname in ('get_private_event_invite','list_private_event_invites',

                  'reply_to_private_event_invite','moderate_public_event',

                  'sponsor_public_event','is_moderator','handle_new_user')

order by 1;

-- 7 rader



select column_name

from information_schema.columns

where table_schema = 'public' and table_name = 'public_events'

  and column_name in ('sponsor_status','status','sponsored')

order by 1;

-- sponsor_status + status (inte sponsored)



select username, is_moderator from public.profiles where is_moderator;

-- 0 rader innan Oliver/William finns, annars 2
