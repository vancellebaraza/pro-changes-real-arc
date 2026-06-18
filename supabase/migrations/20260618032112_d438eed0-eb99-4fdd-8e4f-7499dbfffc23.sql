
-- 1. Extend inspections + quotations with structured form metadata
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS signatures jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS labour numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_no text;

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS unit text;

-- 2. Worksheets ("Document 2") table
CREATE TABLE IF NOT EXISTS public.worksheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  engineer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name text,
  job_no text,
  job_location text,
  job_date date,
  job_type text,
  technician text,
  person_in_charge text,
  job_description text,
  observations jsonb NOT NULL DEFAULT '[]'::jsonb,
  images_before jsonb NOT NULL DEFAULT '[]'::jsonb,
  signatures jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worksheets TO authenticated;
GRANT ALL ON public.worksheets TO service_role;
ALTER TABLE public.worksheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Engineers and admins manage worksheets" ON public.worksheets
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'engineer'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'engineer'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Clients can view their worksheets" ON public.worksheets
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = worksheets.project_id AND p.client_id = auth.uid())
  );

CREATE TRIGGER trg_worksheets_updated_at BEFORE UPDATE ON public.worksheets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. WhatsApp activity log
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient text,
  recipient_phone text,
  message_type text,
  meta jsonb,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.whatsapp_logs TO authenticated;
GRANT ALL ON public.whatsapp_logs TO service_role;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert their own WA logs" ON public.whatsapp_logs
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Admins and senders view WA logs" ON public.whatsapp_logs
  FOR SELECT TO authenticated USING (
    sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 4. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "System inserts notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Update handle_new_user to map fixed emails to roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  assigned_role app_role;
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.raw_user_meta_data->>'phone',''));

  if lower(new.email) = 'admin.operations@fusionpro.realarc.co.ke' then
    assigned_role := 'admin'::app_role;
  elsif lower(new.email) = 'eng.fieldservices@fusionpro.realarc.co.ke' then
    assigned_role := 'engineer'::app_role;
  else
    assigned_role := 'client'::app_role;
  end if;

  insert into public.user_roles (user_id, role) values (new.id, assigned_role)
    on conflict (user_id, role) do nothing;
  return new;
end;
$function$;

-- 6. Notification triggers
CREATE OR REPLACE FUNCTION public.notify_project_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if TG_OP = 'INSERT' then
    insert into public.notifications (user_id, project_id, title, body, link)
    select ur.user_id, new.id, 'New project request', new.title, '/admin'
    from public.user_roles ur where ur.role = 'admin'::app_role;
  elsif TG_OP = 'UPDATE' and new.status <> old.status then
    insert into public.notifications (user_id, project_id, title, body, link)
    values (new.client_id, new.id, 'Project status: ' || new.status, new.title, '/client/' || new.id::text);
    if new.engineer_id is not null then
      insert into public.notifications (user_id, project_id, title, body, link)
      values (new.engineer_id, new.id, 'Project status: ' || new.status, new.title, '/engineer/' || new.id::text);
    end if;
  end if;
  return new;
end; $$;

DROP TRIGGER IF EXISTS trg_notify_project_change ON public.projects;
CREATE TRIGGER trg_notify_project_change
  AFTER INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_change();
