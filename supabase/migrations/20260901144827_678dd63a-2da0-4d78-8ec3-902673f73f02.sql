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
