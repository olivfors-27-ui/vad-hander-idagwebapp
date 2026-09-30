-- Kontosystem: profiler kopplade till auth.users + plans ägda av inloggad användare.

-- 1. Profil per konto (visningsnamn + emoji-avatar)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar_emoji text not null default '🙂',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Alla kan läsa profiler (behövs för att visa namn på plans/svar),
-- men varje användare får bara läsa/uppdatera sin egen profilrad.
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Plans får bara ändras av skaparen; läsning förblir öppen (delade länkar).
--    created_by är idag fritext (gamla rader har t.ex. 'du'), därför jämförs den
--    mot auth.uid()::text – nya rader skrivs med användarens uuid som text.
drop policy if exists "Anyone can create plans" on public.plans;
drop policy if exists "Anyone can update plans" on public.plans;
drop policy if exists "Anyone can delete plans" on public.plans;

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
--    inloggad användare kan bara rediga egna svar.
drop policy if exists "Anyone can update replies" on public.plan_replies;
drop policy if exists "Anyone can delete replies" on public.plan_replies;

create policy "Logged in updates own reply" on public.plan_replies
  for update to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);
create policy "Logged in deletes own reply" on public.plan_replies
  for delete to authenticated
  using (auth.uid()::text = user_id);

-- 5. Kolumn som binder svar till kontot (nullable: anon-svar tillåts kvar)
alter table public.plan_replies add column if not exists user_id text;
