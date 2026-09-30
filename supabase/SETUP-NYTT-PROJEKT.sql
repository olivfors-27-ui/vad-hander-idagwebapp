-- ═══════════════════════════════════════════════════════════════════
-- HÄNDER – komplett uppsättning för ett NYTT Supabase-projekt
-- Klistra in HELA filen i SQL Editor och kör en gång. Klart.
-- (Innehåller både plans/plan_replies och kontosystemet/profiler.)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Delade planer ────────────────────────────────────────────────
CREATE TABLE public.plans (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  emoji text,
  gradient text,
  place text,
  event_id text,
  decided_option_id text,
  decided_slot_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  option_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  slot_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment text NOT NULL DEFAULT '',
  user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX plan_replies_plan_name_idx ON public.plan_replies (plan_id, lower(btrim(name)));
CREATE INDEX plan_replies_plan_idx ON public.plan_replies (plan_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_replies TO anon, authenticated;
GRANT ALL ON public.plan_replies TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_replies ENABLE ROW LEVEL SECURITY;

-- Plans: läsning öppen (delade länkar), skrivning bara för inloggad skapare.
-- created_by sparas som text och jämförs mot auth.uid()::text.
CREATE POLICY "Anyone can read plans" ON public.plans
  FOR SELECT USING (true);
CREATE POLICY "Logged in can create plans" ON public.plans
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = created_by);
CREATE POLICY "Creator updates plan" ON public.plans
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = created_by)
  WITH CHECK (auth.uid()::text = created_by);
CREATE POLICY "Creator deletes plan" ON public.plans
  FOR DELETE TO authenticated
  USING (auth.uid()::text = created_by);

-- Svar: alla kan svara på delade planer; inloggade redigerar bara egna svar.
CREATE POLICY "Anyone can read replies" ON public.plan_replies
  FOR SELECT USING (true);
CREATE POLICY "Anyone can create replies" ON public.plan_replies
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Logged in updates own reply" ON public.plan_replies
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Logged in deletes own reply" ON public.plan_replies
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER plans_touch_updated_at BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.plans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_replies;

-- ── 2. Kontosystem: profiler per konto ─────────────────────────────
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  avatar_emoji text NOT NULL DEFAULT '🙂',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Alla kan läsa profiler (namn på planer/svar), var och en redigerar bara sin egen.
CREATE POLICY "Profiles are public" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Skapa profilen automatiskt när ett konto registreras.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_emoji)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    '🙂'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
