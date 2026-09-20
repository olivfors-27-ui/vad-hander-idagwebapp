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

CREATE POLICY "Anyone can read plans" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Anyone can create plans" ON public.plans FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update plans" ON public.plans FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete plans" ON public.plans FOR DELETE USING (true);

CREATE POLICY "Anyone can read replies" ON public.plan_replies FOR SELECT USING (true);
CREATE POLICY "Anyone can create replies" ON public.plan_replies FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update replies" ON public.plan_replies FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete replies" ON public.plan_replies FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER plans_touch_updated_at BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.plans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_replies;