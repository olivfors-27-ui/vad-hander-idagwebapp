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
