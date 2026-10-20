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
