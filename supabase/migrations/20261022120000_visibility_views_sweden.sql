-- Avslutade event, unika besökare, Sverige- och tidsvalidering – samt rättade
-- inbjudningsfunktioner (pgcrypto låg utanför funktionernas search_path).
--
-- Allt här är idempotent och kan köras om.

-- ═══════════════════════════════════════════════════ 1. pgcrypto
--
-- Inbjudningsfunktionerna använder digest() och gen_random_bytes() för
-- gästernas svars-tokens. pgcrypto installeras av Supabase i schemat
-- "extensions", men funktionerna pinnade search_path = public. Då hittades
-- aldrig funktionerna och varje gästsvar föll på
--   function digest(text, unknown) does not exist
-- vilket i appen blev "Svaret kunde inte sparas".
create extension if not exists pgcrypto;

-- ═══════════════════════════════════════════════ 2. avslutade event
--
-- Ett event syns till 3 timmar efter sluttiden. Saknas sluttid gäller 4
-- timmar efter starttiden. Tiderna tolkas som svensk wall-clock-tid
-- (Europe/Stockholm), oavsett var servern står.
--
-- Returnerar NULL när datum/tid saknas eller är o läsbart – då döljs inget,
-- eftersom vi inte kan avgöra om eventet pågår.
create or replace function public.event_visible_until(payload jsonb)
returns timestamptz
language plpgsql
stable
as $$
declare
  d text := nullif(btrim(coalesce(payload ->> 'date', '')), '');
  s text := nullif(btrim(coalesce(payload ->> 'start', '')), '');
  e text := nullif(btrim(coalesce(payload ->> 'end', '')), '');
  starts timestamptz;
  ends timestamptz;
begin
  if payload is null or d is null or s is null then
    return null;
  end if;
  if d !~ '^\d{4}-\d{2}-\d{2}$' or s !~ '^\d{2}:\d{2}$' then
    return null;
  end if;

  begin
    starts := (d || ' ' || s)::timestamp at time zone 'Europe/Stockholm';

    -- Utan sluttid gäller 4 timmar efter start.
    if e is null or e !~ '^\d{2}:\d{2}$' then
      return starts + interval '4 hours';
    end if;

    ends := (d || ' ' || e)::timestamp at time zone 'Europe/Stockholm';
    -- Slut före start = eventet gick över midnatt.
    if e < s then
      ends := ends + interval '1 day';
    end if;

    return ends + interval '3 hours';
  exception when others then
    -- Trasigt datum/tid i payloaden: dölj inget.
    return null;
  end;
end;
$$;

-- Publika event som fortfarande ska synas. security_invoker = RLS på
-- public_events gäller precis som förut (godkända, egna, moderatorer).
drop view if exists public.visible_public_events;
create view public.visible_public_events
with (security_invoker = true) as
select
  e.id,
  e.organizer_id,
  e.organizer_name,
  e.payload,
  e.status,
  e.rejection_reason,
  e.sponsor_status,
  e.sponsored_at,
  e.created_at,
  e.updated_at
from public.public_events e
where public.event_visible_until(e.payload) is null
   or public.event_visible_until(e.payload) > now();

grant select on public.visible_public_events to anon, authenticated;

-- ═══════════════════════════════════════════ 3. unika besökare
--
-- En rad per event och besökare. Primärnyckeln gör dubbletter omöjliga, även
-- om appen skulle skicka samma besökare flera gånger.
create table if not exists public.event_views (
  event_id text not null,
  viewer_key text not null check (length(viewer_key) between 3 and 120),
  created_at timestamptz not null default now(),
  primary key (event_id, viewer_key)
);

alter table public.event_views enable row level security;
-- Ingen direkt åtkomst från klienten: bara funktionerna nedan.
revoke all on public.event_views from anon, authenticated;
grant all on public.event_views to service_role;

-- Loggar en unik besökare och returnerar antalet unika besökare.
-- Inloggade identifieras av sitt konto; utloggade av ett persistent id från
-- localStorage (bästa möjliga approximation).
create or replace function public.record_event_view(
  p_event_id text,
  p_anonymous_id text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_count integer;
begin
  if p_event_id is null or length(btrim(p_event_id)) = 0 then
    return 0;
  end if;

  -- Bara riktiga event i databasen räknas (inte externa API-event).
  if not exists (select 1 from public.public_events where id = p_event_id)
     and not exists (select 1 from public.private_events where id = p_event_id) then
    return 0;
  end if;

  if auth.uid() is not null then
    v_key := 'user:' || auth.uid()::text;
  else
    if p_anonymous_id is null
       or p_anonymous_id !~ '^[0-9a-zA-Z-]{8,64}$' then
      return 0;
    end if;
    v_key := 'anon:' || lower(p_anonymous_id);
  end if;

  insert into public.event_views (event_id, viewer_key)
  values (p_event_id, v_key)
  on conflict (event_id, viewer_key) do nothing;

  select count(*)::integer into v_count
  from public.event_views
  where event_id = p_event_id;

  return v_count;
end;
$$;
revoke all on function public.record_event_view(text, text) from public;
grant execute on function public.record_event_view(text, text) to anon, authenticated;

-- Antal unika besökare per event för inloggad arrangör (och moderatorer).
create or replace function public.event_view_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_moderator boolean;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  v_moderator := public.is_moderator(v_uid);

  select coalesce(jsonb_object_agg(v.event_id, v.cnt), '{}'::jsonb)
    into v_result
  from (
    select w.event_id, count(*)::integer as cnt
    from public.event_views w
    where exists (
      select 1 from public.public_events e
      where e.id = w.event_id
        and (e.organizer_id = v_uid or v_moderator)
    )
    or exists (
      select 1 from public.private_events e
      where e.id = w.event_id
        and (e.organizer_id = v_uid or v_moderator)
    )
    group by w.event_id
  ) v;

  return v_result;
end;
$$;
revoke all on function public.event_view_counts() from public;
grant execute on function public.event_view_counts() to authenticated;

-- ═══════════════════════════════════════════ 4. radering av event
--
-- Tidigare kastade funktionen P0002 när eventet bara fanns lokalt i appen
-- (t.ex. skapat innan private_events fanns, eller när sparningen fallerat).
-- Det gav "Eventet kunde inte tas bort" trots att raderingen var ofarlig.
-- Nu returneras false i stället, så klienten kan städa bort sin lokala kopia.
-- Besöksstatistiken följer med.
create or replace function public.delete_event(p_event_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_removed boolean := false;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  delete from public.private_events
  where id = p_event_id and organizer_id = v_uid;
  if found then
    v_removed := true;
  end if;

  delete from public.public_events
  where id = p_event_id and organizer_id = v_uid;
  if found then
    v_removed := true;
  end if;

  if v_removed then
    delete from public.event_views where event_id = p_event_id;
  end if;

  return v_removed;
end;
$$;
revoke all on function public.delete_event(text) from public;
grant execute on function public.delete_event(text) to authenticated;

-- ═════════════════════════════ 5. inbjudningar med pgcrypto i search_path

create or replace function public.get_private_event_invite(p_code text, p_response_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
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
      'lat', pe.payload->'lat', 'lng', pe.payload->'lng',
      'guestCount', guest_count
    ),
    'ownReply', own_reply,
    'guestCount', guest_count
  );
end;
$$;
revoke all on function public.get_private_event_invite(text, text) from public;
grant execute on function public.get_private_event_invite(text, text) to anon, authenticated;

create or replace function public.list_private_event_invites(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
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

create or replace function public.list_private_event_guests(
  p_code text,
  p_response_token text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
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
set search_path = public, extensions
as $$
declare
  v_event_id text;
  -- Prefixade variabelnamn: private_event_replies har kolumner som heter
  -- guest_key, guest_name och status, annars blir referenserna tvetydiga.
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
  if length(coalesce(v_name, '')) = 0 then
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

-- ═══════════════════════ 6. tidsordning och Sverige i databasen
--
-- Appen validerar samma sak innan den skickar, men databasen ska inte kunna
-- fyllas med ett event som slutar före det börjar eller som ligger utanför
-- Sverige. NOT VALID: befintliga rader rörs inte, nya och uppdaterade
-- kontrolleras.

create or replace function public.event_time_order_ok(payload jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  s text := nullif(btrim(coalesce(payload ->> 'start', '')), '');
  e text := nullif(btrim(coalesce(payload ->> 'end', '')), '');
begin
  if s is null or e is null then
    return true;
  end if;
  if s !~ '^\d{2}:\d{2}$' or e !~ '^\d{2}:\d{2}$' then
    return true;
  end if;
  return e > s;
end;
$$;

create or replace function public.event_location_in_sweden(payload jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_lat double precision;
  v_lng double precision;
begin
  if payload is null then
    return true;
  end if;
  begin
    v_lat := (payload ->> 'lat')::double precision;
    v_lng := (payload ->> 'lng')::double precision;
  exception when others then
    return true;
  end;
  if v_lat is null or v_lng is null then
    return true;
  end if;
  -- Sverige ungefär: lat 55.0–69.1, lng 10.3–24.4.
  return v_lat between 55.0 and 69.1 and v_lng between 10.3 and 24.4;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.public_events'::regclass
      and conname = 'public_events_time_order_check'
  ) then
    alter table public.public_events
      add constraint public_events_time_order_check
      check (public.event_time_order_ok(payload)) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.public_events'::regclass
      and conname = 'public_events_location_sweden_check'
  ) then
    alter table public.public_events
      add constraint public_events_location_sweden_check
      check (public.event_location_in_sweden(payload)) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.private_events'::regclass
      and conname = 'private_events_time_order_check'
  ) then
    alter table public.private_events
      add constraint private_events_time_order_check
      check (public.event_time_order_ok(payload)) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.private_events'::regclass
      and conname = 'private_events_location_sweden_check'
  ) then
    alter table public.private_events
      add constraint private_events_location_sweden_check
      check (public.event_location_in_sweden(payload)) not valid;
  end if;
end
$$;
