
-- Enums
create type public.app_role as enum ('client','engineer','admin');
create type public.service_type as enum ('electrical','plumbing','landscaping','painting','property_management','tank_cleaning');
create type public.project_status as enum ('requested','inspected','quoted','approved','scheduled','in_progress','completed','rejected');
create type public.quotation_status as enum ('draft','sent','approved','rejected');
create type public.task_status as enum ('pending','in_progress','done','blocked');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  company text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.get_my_roles()
returns setof app_role language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid()
$$;

create policy "Users see own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Admins manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Auto-create profile + default client role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.raw_user_meta_data->>'phone',''));
  insert into public.user_roles (user_id, role)
  values (new.id, coalesce((new.raw_user_meta_data->>'role')::app_role, 'client'::app_role));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Updated_at trigger fn
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  engineer_id uuid references auth.users(id) on delete set null,
  service service_type not null,
  title text not null,
  description text,
  location text,
  image_urls text[] not null default '{}',
  status project_status not null default 'requested',
  scheduled_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create policy "Project read access" on public.projects for select to authenticated using (
  client_id = auth.uid() or engineer_id = auth.uid()
  or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'engineer')
);
create policy "Clients create own projects" on public.projects for insert to authenticated with check (client_id = auth.uid());
create policy "Engineers/admins update projects" on public.projects for update to authenticated using (
  public.has_role(auth.uid(),'engineer') or public.has_role(auth.uid(),'admin') or client_id = auth.uid()
);
create policy "Admins delete projects" on public.projects for delete to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

-- Quotations
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  engineer_id uuid not null references auth.users(id),
  vat_rate numeric(5,2) not null default 5.0,
  notes text,
  status quotation_status not null default 'draft',
  subtotal numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quotations to authenticated;
grant all on public.quotations to service_role;
alter table public.quotations enable row level security;
create policy "Quotation read" on public.quotations for select to authenticated using (
  exists(select 1 from public.projects p where p.id = project_id and (p.client_id = auth.uid() or p.engineer_id = auth.uid()))
  or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'engineer')
);
create policy "Engineers manage quotations" on public.quotations for all to authenticated using (
  public.has_role(auth.uid(),'engineer') or public.has_role(auth.uid(),'admin')
) with check (public.has_role(auth.uid(),'engineer') or public.has_role(auth.uid(),'admin'));
create policy "Clients update status" on public.quotations for update to authenticated using (
  exists(select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
);
create trigger quotations_touch before update on public.quotations for each row execute function public.touch_updated_at();

-- Quotation items
create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  description text not null,
  qty numeric(12,2) not null default 1,
  unit_cost numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  actual_cost numeric(12,2),
  sort_order int not null default 0
);
grant select, insert, update, delete on public.quotation_items to authenticated;
grant all on public.quotation_items to service_role;
alter table public.quotation_items enable row level security;
create policy "Item read" on public.quotation_items for select to authenticated using (
  exists(select 1 from public.quotations q join public.projects p on p.id=q.project_id
         where q.id = quotation_id and (p.client_id = auth.uid() or p.engineer_id = auth.uid()))
  or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'engineer')
);
create policy "Engineers manage items" on public.quotation_items for all to authenticated using (
  public.has_role(auth.uid(),'engineer') or public.has_role(auth.uid(),'admin')
) with check (public.has_role(auth.uid(),'engineer') or public.has_role(auth.uid(),'admin'));

-- Inspections
create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  engineer_id uuid not null references auth.users(id),
  stage text not null default 'initial',
  checklist jsonb not null default '[]'::jsonb,
  remarks text,
  image_urls text[] not null default '{}',
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.inspections to authenticated;
grant all on public.inspections to service_role;
alter table public.inspections enable row level security;
create policy "Inspection read" on public.inspections for select to authenticated using (
  exists(select 1 from public.projects p where p.id = project_id and (p.client_id = auth.uid() or p.engineer_id = auth.uid()))
  or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'engineer')
);
create policy "Engineers manage inspections" on public.inspections for all to authenticated using (
  public.has_role(auth.uid(),'engineer') or public.has_role(auth.uid(),'admin')
) with check (public.has_role(auth.uid(),'engineer') or public.has_role(auth.uid(),'admin'));

-- Work tasks
create table public.work_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  assignee uuid references auth.users(id) on delete set null,
  start_date date,
  end_date date,
  status task_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.work_tasks to authenticated;
grant all on public.work_tasks to service_role;
alter table public.work_tasks enable row level security;
create policy "Task read" on public.work_tasks for select to authenticated using (
  exists(select 1 from public.projects p where p.id = project_id and (p.client_id = auth.uid() or p.engineer_id = auth.uid()))
  or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'engineer')
);
create policy "Engineers manage tasks" on public.work_tasks for all to authenticated using (
  public.has_role(auth.uid(),'engineer') or public.has_role(auth.uid(),'admin')
) with check (public.has_role(auth.uid(),'engineer') or public.has_role(auth.uid(),'admin'));

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  channel text not null default 'internal',
  body text not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "Message read" on public.messages for select to authenticated using (
  exists(select 1 from public.projects p where p.id = project_id and (p.client_id = auth.uid() or p.engineer_id = auth.uid()))
  or public.has_role(auth.uid(),'admin')
);
create policy "Message insert" on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and exists(
    select 1 from public.projects p where p.id = project_id
      and (p.client_id = auth.uid() or p.engineer_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  )
);

-- Storage bucket for project images (created via SQL not allowed; rely on bucket tool separately if needed)
