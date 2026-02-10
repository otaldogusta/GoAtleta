# GoAtleta Multi-Workspace Implementation Backlog

**Status:** Ready for implementation (Feb 2026)  
**Objective:** Separate data by organization (workspace), not by location or teacher  
**Real Schema Integration:** Customized for existing Supabase + SQLite tables

---

## Overview: Architecture

```
Organization (Workspace)
├── Organization Members (with roles: 10=professor, 5=estagiário, 50=admin)
├── Locations (physical courts, optional per-org)
├── Classes (turmas)
│   ├── Class Staff (professor/estagiário per turma)
│   └── Students (alunos)
│       └── Attendance Logs (chamada)
├── Training Plans & Templates
├── Session Logs (relatório)
├── Class Plans (periodization)
├── Events (torneios/eventos)
├── Scouting Logs (by class & student)
└── Absence Notices (avisos de falta)
```

**Isolation:** Each `organization_id` is completely isolated. User switching orgs = instant filter change.

---

## PR 1 — Base Multi-Workspace (Organizations + Memberships)

### Objective
Separate data by "owner" (workspace/organization), not by location or teacher.

### Deliverables

1. **Supabase tables:**
   - `organizations` (id, name, created_by, created_at)
   - `organization_members` (organization_id, user_id, role_level, created_at)
   - RLS policies for both

2. **RPC functions:**
   - `get_my_organizations()` → returns orgs where user is member + role
   - `get_active_org_id()` → retrieves user's cached active org (stored client-side)

3. **App changes:**
   - `OrganizationProvider` (context + hooks)
   - Persist `activeOrganizationId` to AsyncStorage
   - If user has 1 org: auto-select; if >1: show selector on home
   - Hook: `useOrganization()` returns `{ activeOrganizationId, organizations, setActiveOrganizationId }`

### DoD
- ✅ User can have 2+ workspaces and toggle between them
- ✅ Active org saved to AsyncStorage (survives app restart)
- ✅ Org selector shows on home if >1 org
- ✅ RLS blocks cross-org data leaks

### Prompt for Codex

```text
Implement multi-workspace (multi-tenant) foundation in GoAtleta.

**Back-end (Supabase):**

1) Create migration SQL:

```sql
-- organizations table
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- organization_members table (roles: 10=professor, 5=estagiário, 50=admin)
create table if not exists public.organization_members (
  organization_id uuid not null references organizations on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_level int not null default 10,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- indices
create index if not exists organization_members_user_id on organization_members(user_id);
create index if not exists organization_members_role on organization_members(organization_id, role_level);
```

2) RLS Policies:

```sql
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- organizations: members can see their own orgs
drop policy if exists "organizations select member" on public.organizations;
create policy "organizations select member" on public.organizations
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organizations.id
        and om.user_id = auth.uid()
    )
  );

-- organizations: only creator can update (optional)
drop policy if exists "organizations update creator" on public.organizations;
create policy "organizations update creator" on public.organizations
  for update
  using (created_by = auth.uid() or
    (exists (select 1 from organization_members om where om.organization_id = organizations.id and om.user_id = auth.uid() and om.role_level >= 50))
  );

-- organization_members: members of same org can see all members
drop policy if exists "organization_members select" on public.organization_members;
create policy "organization_members select" on public.organization_members
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
        and om.user_id = auth.uid()
    )
  );

-- organization_members: only org admin (role_level >= 50) can insert/update/delete
drop policy if exists "organization_members insert" on public.organization_members;
create policy "organization_members insert" on public.organization_members
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

drop policy if exists "organization_members update" on public.organization_members;
create policy "organization_members update" on public.organization_members
  for update
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

drop policy if exists "organization_members delete" on public.organization_members;
create policy "organization_members delete" on public.organization_members
  for delete
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );
```

3) RPC functions (or views):

```sql
create or replace function public.get_my_organizations()
returns table(id uuid, name text, role_level int, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.name, om.role_level, o.created_at
  from organizations o
  join organization_members om on o.id = om.organization_id
  where om.user_id = auth.uid()
  order by o.created_at desc;
$$;

-- Grant access
revoke all on function public.get_my_organizations() from anon;
grant execute on function public.get_my_organizations() to authenticated;
```

**App (React Native/Expo):**

1) Create `src/providers/OrganizationProvider.tsx`:
- State: `activeOrganizationId`, `organizations`
- Methods: `setActiveOrganizationId()`, `fetchOrganizations()`
- Persist activeOrganizationId to AsyncStorage (key: "active-org-id")
- On mount: fetch orgs from RPC get_my_organizations(); if 1 org, auto-select; if 0, show placeholder

2) Create hook `src/hooks/useOrganization.ts`:
- Returns `{ activeOrganizationId, organizations, setActiveOrganizationId, isLoading }`

3) Wrap app in provider (app/_layout.tsx after AuthProvider).

4) Create org selector UI (modal / dropdown) on home screen when >1 org available.

**Testing (manual steps):**
- Sign up user A, create org "Pinhais", add themselves as admin
- Sign in user B, invite them with code (when PR 4 is done)
- Switch to org B on app and verify different data
- Force-kill app and reopen: active org persists

**Documentation:**
- Add section to README: "Multi-Workspace Setup"
- Steps: Create org via admin → add members via invite codes → verify isolation
```

---

## PR 2 — Separate "Location (court)" from "Organization"

### Objective
Model "Rede Esperança" as a physical location, not as data owner.

### Deliverables

- **Supabase table:** `locations` (id, organization_id, name, address)
- **Classes.location_id** (nullable FK to locations)
- **App UI:** Location selector in class create/edit form
- **Display:** Show location on class detail + daily agenda

### DoD
- ✅ Classes can have optional location
- ✅ Same physical location (Rede Esperança) used by multiple orgs without data mixing

### Prompt for Codex

```text
Add Location entity (physical court) separate from Organization.

**Back-end (Supabase):**

1) Migration:

```sql
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create index if not exists locations_org_id on locations(organization_id);

alter table public.classes
  add column if not exists location_id uuid references locations on delete set null;
```

2) RLS on locations:

```sql
alter table public.locations enable row level security;

drop policy if exists "locations select member" on public.locations;
create policy "locations select member" on public.locations
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = locations.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "locations insert admin" on public.locations;
create policy "locations insert admin" on public.locations
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = locations.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

-- update/delete similar to insert
```

**App (React Native/Expo):**

1) Create location CRUD screens:
- List: GET /locations?org_id=X
- Create/Edit: Form with name + address
- Only admin can create/delete

2) In class create/edit form (app/class/[id].tsx):
- Add optional location selector (dropdown)
- Call location API on mount

3) Display location:
- Class detail screen: show "📍 Rede Esperança, Av. X"
- Daily agenda: location badge if set

Keep existing patterns (hooks, context, expo-router).
```

---

## PR 3 — Migrate to `organization_id` on Core Tables (Multi-Tenant Foundation)

### Objective
Ensure ALL data belongs to an organization. RLS enforces org-level isolation.

### Deliverables

Add `organization_id` to:
- ✅ `classes`
- ✅ `students`
- ✅ `attendance_logs`
- ✅ `session_logs`
- ✅ `training_plans`
- ✅ `training_templates`
- ✅ `training_template_hides`
- ✅ `class_plans`
- ✅ `exercises`
- ✅ `scouting_logs`
- ✅ `student_scouting_logs`
- ✅ `absence_notices`

**Migrate existing data** → Create default org "Default" or assign by owner's membership.

**Update RLS** → All policies check `organization_id` membership.

**Update App queries** → Filter by `activeOrganizationId` everywhere.

### DoD
- ✅ User in org A sees zero data from org B
- ✅ Switching org instantly filters all lists/details
- ✅ Tests: Create 2 orgs, add data to each, verify isolation

### Prompt for Codex

```text
Migrate GoAtleta to full multi-tenant architecture by adding organization_id to all core tables.

**Back-end (Supabase):**

**Step 1: Add organization_id columns**

```sql
-- classes
alter table public.classes
  add column if not exists organization_id uuid references organizations on delete cascade;

-- students
alter table public.students
  add column if not exists organization_id uuid references organizations on delete cascade;

-- attendance_logs
alter table public.attendance_logs
  add column if not exists organization_id uuid references organizations on delete cascade;

-- session_logs
alter table public.session_logs
  add column if not exists organization_id uuid references organizations on delete cascade;

-- training_plans
alter table public.training_plans
  add column if not exists organization_id uuid references organizations on delete cascade;

-- training_templates
alter table public.training_templates
  add column if not exists organization_id uuid references organizations on delete cascade;

-- training_template_hides
alter table public.training_template_hides
  add column if not exists organization_id uuid references organizations on delete cascade;

-- class_plans
alter table public.class_plans
  add column if not exists organization_id uuid references organizations on delete cascade;

-- exercises
alter table public.exercises
  add column if not exists organization_id uuid references organizations on delete cascade;

-- scouting_logs
alter table public.scouting_logs
  add column if not exists organization_id uuid references organizations on delete cascade;

-- student_scouting_logs
alter table public.student_scouting_logs
  add column if not exists organization_id uuid references organizations on delete cascade;

-- absence_notices
alter table public.absence_notices
  add column if not exists organization_id uuid references organizations on delete cascade;
```

**Step 2: Migrate existing data to default organization**

```sql
-- Create a default organization if not exists
insert into organizations (id, name, created_by)
select 'default-org-uuid'::uuid, 'Default Organization', '00000000-0000-0000-0000-000000000000'::uuid
where not exists (select 1 from organizations where name = 'Default Organization');

-- For existing trainers, create org membership + assign to default org
with trainer_orgs as (
  select distinct owner_id from classes where owner_id is not null
  union select distinct owner_id from students where owner_id is not null
  union select distinct owner_id from training_plans where owner_id is not null
)
insert into organization_members (organization_id, user_id, role_level)
select 'default-org-uuid'::uuid, owner_id, 50
from trainer_orgs
on conflict do nothing;

-- Assign default org to all existing records
update classes set organization_id = 'default-org-uuid'::uuid where organization_id is null;
update students set organization_id = 'default-org-uuid'::uuid where organization_id is null;
update attendance_logs set organization_id = 'default-org-uuid'::uuid where organization_id is null;
update session_logs set organization_id = 'default-org-uuid'::uuid where organization_id is null;
update training_plans set organization_id = 'default-org-uuid'::uuid where organization_id is null;
update training_templates set organization_id = 'default-org-uuid'::uuid where organization_id is null;
update training_template_hides set organization_id = 'default-org-uuid'::uuid where organization_id is null;
update class_plans set organization_id = 'default-org-uuid'::uuid where organization_id is null;
update exercises set organization_id = 'default-org-uuid'::uuid where organization_id is null;
update scouting_logs set organization_id = 'default-org-uuid'::uuid where organization_id is null;
update student_scouting_logs set organization_id = 'default-org-uuid'::uuid where organization_id is null;
update absence_notices set organization_id = 'default-org-uuid'::uuid where organization_id is null;

-- Make columns NOT NULL after migration
alter table public.classes alter column organization_id set not null;
alter table public.students alter column organization_id set not null;
alter table public.attendance_logs alter column organization_id set not null;
alter table public.session_logs alter column organization_id set not null;
alter table public.training_plans alter column organization_id set not null;
alter table public.training_templates alter column organization_id set not null;
alter table public.training_template_hides alter column organization_id set not null;
alter table public.class_plans alter column organization_id set not null;
alter table public.exercises alter column organization_id set not null;
alter table public.scouting_logs alter column organization_id set not null;
alter table public.student_scouting_logs alter column organization_id set not null;
alter table public.absence_notices alter column organization_id set not null;
```

**Step 3: Create indices**

```sql
create index if not exists classes_org_id on classes(organization_id);
create index if not exists classes_org_id_owner on classes(organization_id, owner_id);
create index if not exists students_org_id on students(organization_id);
create index if not exists students_org_id_classid on students(organization_id, classid);
create index if not exists attendance_logs_org_id on attendance_logs(organization_id);
create index if not exists session_logs_org_id on session_logs(organization_id);
create index if not exists training_plans_org_id on training_plans(organization_id);
create index if not exists training_templates_org_id on training_templates(organization_id);
create index if not exists class_plans_org_id on class_plans(organization_id);
create index if not exists exercises_org_id on exercises(organization_id);
create index if not exists scouting_logs_org_id on scouting_logs(organization_id);
create index if not exists student_scouting_logs_org_id on student_scouting_logs(organization_id);
```

**Step 4: Rewrite RLS policies**

For each table, replace existing owner_id checks with organization membership check.

Example pattern (apply to all 12 tables above):

```sql
-- OLD (example: classes)
drop policy if exists "classes select trainer" on public.classes;
-- DELETE THIS: using (is_trainer() and owner_id = auth.uid());

-- NEW
create policy "classes select trainer" on public.classes
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = classes.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 10
    )
  );

-- Similar for insert/update/delete, with role checks (admin = 50+, staff = 10+)
```

Detailed RLS for each table:

```sql
-- ===== CLASSES =====
alter table public.classes enable row level security;

drop policy if exists "classes select trainer" on public.classes;
create policy "classes select trainer" on public.classes
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = classes.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "classes select student" on public.classes;
create policy "classes select student" on public.classes
  for select
  using (
    exists (
      select 1 from students s
      where s.student_user_id = auth.uid()
        and s.classid = classes.id
    )
  );

drop policy if exists "classes insert trainer" on public.classes;
create policy "classes insert trainer" on public.classes
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = classes.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "classes update trainer" on public.classes;
create policy "classes update trainer" on public.classes
  for update
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = classes.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 10
    )
  );

drop policy if exists "classes delete trainer" on public.classes;
create policy "classes delete trainer" on public.classes
  for delete
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = classes.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

-- ===== STUDENTS =====
alter table public.students enable row level security;

drop policy if exists "students select trainer" on public.students;
create policy "students select trainer" on public.students
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = students.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "students select self" on public.students;
create policy "students select self" on public.students
  for select
  using (student_user_id = auth.uid());

drop policy if exists "students insert trainer" on public.students;
create policy "students insert trainer" on public.students
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = students.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "students update trainer" on public.students;
create policy "students update trainer" on public.students
  for update
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = students.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "students delete trainer" on public.students;
create policy "students delete trainer" on public.students
  for delete
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = students.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

-- ===== ATTENDANCE_LOGS =====
alter table public.attendance_logs enable row level security;

drop policy if exists "attendance_logs select trainer" on public.attendance_logs;
create policy "attendance_logs select trainer" on public.attendance_logs
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = attendance_logs.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "attendance_logs insert trainer" on public.attendance_logs;
create policy "attendance_logs insert trainer" on public.attendance_logs
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = attendance_logs.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "attendance_logs update trainer" on public.attendance_logs;
create policy "attendance_logs update trainer" on public.attendance_logs
  for update
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = attendance_logs.organization_id
        and om.user_id = auth.uid()
    )
  );

-- ===== SESSION_LOGS =====
alter table public.session_logs enable row level security;

drop policy if exists "session_logs select trainer" on public.session_logs;
create policy "session_logs select trainer" on public.session_logs
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = session_logs.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "session_logs insert trainer" on public.session_logs;
create policy "session_logs insert trainer" on public.session_logs
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = session_logs.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "session_logs update trainer" on public.session_logs;
create policy "session_logs update trainer" on public.session_logs
  for update
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = session_logs.organization_id
        and om.user_id = auth.uid()
    )
  );

-- ===== TRAINING_PLANS =====
alter table public.training_plans enable row level security;

drop policy if exists "training_plans select trainer" on public.training_plans;
create policy "training_plans select trainer" on public.training_plans
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = training_plans.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "training_plans insert trainer" on public.training_plans;
create policy "training_plans insert trainer" on public.training_plans
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = training_plans.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "training_plans update trainer" on public.training_plans;
create policy "training_plans update trainer" on public.training_plans
  for update
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = training_plans.organization_id
        and om.user_id = auth.uid()
    )
  );

-- ===== TRAINING_TEMPLATES =====
alter table public.training_templates enable row level security;

drop policy if exists "training_templates select trainer" on public.training_templates;
create policy "training_templates select trainer" on public.training_templates
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = training_templates.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "training_templates insert trainer" on public.training_templates;
create policy "training_templates insert trainer" on public.training_templates
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = training_templates.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "training_templates update trainer" on public.training_templates;
create policy "training_templates update trainer" on public.training_templates
  for update
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = training_templates.organization_id
        and om.user_id = auth.uid()
    )
  );

-- ===== TRAINING_TEMPLATE_HIDES =====
alter table public.training_template_hides enable row level security;

drop policy if exists "training_template_hides select trainer" on public.training_template_hides;
create policy "training_template_hides select trainer" on public.training_template_hides
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = training_template_hides.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "training_template_hides insert trainer" on public.training_template_hides;
create policy "training_template_hides insert trainer" on public.training_template_hides
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = training_template_hides.organization_id
        and om.user_id = auth.uid()
    )
  );

-- ===== CLASS_PLANS =====
alter table public.class_plans enable row level security;

drop policy if exists "class_plans select trainer" on public.class_plans;
create policy "class_plans select trainer" on public.class_plans
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = class_plans.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "class_plans insert trainer" on public.class_plans;
create policy "class_plans insert trainer" on public.class_plans
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = class_plans.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "class_plans update trainer" on public.class_plans;
create policy "class_plans update trainer" on public.class_plans
  for update
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = class_plans.organization_id
        and om.user_id = auth.uid()
    )
  );

-- ===== EXERCISES =====
alter table public.exercises enable row level security;

drop policy if exists "exercises select trainer" on public.exercises;
create policy "exercises select trainer" on public.exercises
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = exercises.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "exercises insert trainer" on public.exercises;
create policy "exercises insert trainer" on public.exercises
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = exercises.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "exercises update trainer" on public.exercises;
create policy "exercises update trainer" on public.exercises
  for update
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = exercises.organization_id
        and om.user_id = auth.uid()
    )
  );

-- ===== SCOUTING_LOGS =====
alter table public.scouting_logs enable row level security;

drop policy if exists "scouting_logs select trainer" on public.scouting_logs;
create policy "scouting_logs select trainer" on public.scouting_logs
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = scouting_logs.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "scouting_logs insert trainer" on public.scouting_logs;
create policy "scouting_logs insert trainer" on public.scouting_logs
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = scouting_logs.organization_id
        and om.user_id = auth.uid()
    )
  );

-- ===== STUDENT_SCOUTING_LOGS =====
alter table public.student_scouting_logs enable row level security;

drop policy if exists "student_scouting_logs select trainer" on public.student_scouting_logs;
create policy "student_scouting_logs select trainer" on public.student_scouting_logs
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = student_scouting_logs.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "student_scouting_logs insert trainer" on public.student_scouting_logs;
create policy "student_scouting_logs insert trainer" on public.student_scouting_logs
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = student_scouting_logs.organization_id
        and om.user_id = auth.uid()
    )
  );

-- ===== ABSENCE_NOTICES =====
-- Keep existing student + trainer policies, BUT add org check:
drop policy if exists "absence_notices select trainer" on public.absence_notices;
create policy "absence_notices select trainer" on public.absence_notices
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = absence_notices.organization_id
        and om.user_id = auth.uid()
    )
    and exists (
      select 1 from classes c
      where c.id = absence_notices.class_id
        and c.organization_id = absence_notices.organization_id
    )
  );

drop policy if exists "absence_notices select student" on public.absence_notices;
create policy "absence_notices select student" on public.absence_notices
  for select
  using (
    exists (
      select 1 from students s
      where s.id = absence_notices.student_id
        and s.student_user_id = auth.uid()
    )
  );

drop policy if exists "absence_notices insert student" on public.absence_notices;
create policy "absence_notices insert student" on public.absence_notices
  for insert
  with check (
    exists (
      select 1 from students s
      where s.id = absence_notices.student_id
        and s.student_user_id = auth.uid()
    )
  );
```

**App (React Native/Expo):**

1) Update `src/db/sqlite.ts`:
   - Add `organization_id TEXT NOT NULL DEFAULT ''` to all local sync tables (classes, students, etc.)
   - Add indices for (organization_id, classid), etc.

2) Update Supabase queries in `src/api/`:
   - Always filter by `organization_id = activeOrganizationId`
   - Example: `const classes = await supabase.from('classes').select('*').eq('organization_id', activeOrganizationId).order('name')`

3) Sync local DB:
   - On org switch, clear cached tables and refetch
   - Or partition local DB tables by org_id (optional: more memory-efficient)

4) Update hooks (e.g., `useClasses()`, `useStudents()`):
   - Inject `activeOrganizationId` into queries
   - Hooks already use `useOrganization()` to get active org

**Manual Testing:**
- Create 2 orgs ("Pinhais", "Social")
- Add classes/students to each
- Switch org on home screen
- Verify:
  - Classes list filters instantly
  - Student counts match org
  - No data from other org appears
  - Switch back: data reappears correctly
  - Force-kill app, reopen, org persists

**Rollback Plan:**
- All migration updates use `if not exists` / `if exists`
- RLS policies are dropped before recreating (no harm if run twice)
- Old `owner_id` columns left intact (not deleted); can be removed in cleanup PR later
```

---

## PR 4 — Invites by Organization (Trainer/Estagiário Roles)

### Objective
Invites become "Join organization X with role Y" (professor/estagiário/admin).

### Deliverables

- **Update `trainer_invites`:** Add `organization_id`, `role_level_granted`
- **Edge function `claim-trainer-invite`:** Create membership in org with role
- **App UI:** Admin generates invite with role selector

### DoD
- ✅ Pinhais invite code doesn't access personal workspace
- ✅ Admin can generate professor/estagiário/admin invites
- ✅ Code is org-specific

### Prompt for Codex

```text
Transform trainer invites into organization membership invites with roles.

**Back-end (Supabase):**

1) Alter trainer_invites table:

```sql
alter table public.trainer_invites
  add column if not exists organization_id uuid references organizations on delete cascade,
  add column if not exists role_level_granted int not null default 10;

create index if not exists trainer_invites_org_id on trainer_invites(organization_id);
```

2) RLS on trainer_invites:

```sql
alter table public.trainer_invites enable row level security;

drop policy if exists "trainer_invites select own" on public.trainer_invites;
create policy "trainer_invites select own" on public.trainer_invites
  for select
  using (created_by = auth.uid());

drop policy if exists "trainer_invites insert admin" on public.trainer_invites;
create policy "trainer_invites insert admin" on public.trainer_invites
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = trainer_invites.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

drop policy if exists "trainer_invites update admin" on public.trainer_invites;
create policy "trainer_invites update admin" on public.trainer_invites
  for update
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = trainer_invites.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

revoke all on table public.trainer_invites from anon;
grant select, insert, update on table public.trainer_invites to authenticated;
```

3) Update edge function `claim-trainer-invite`:

```javascript
// After validating invite (code_hash, expiry, max_uses, revoked):
// 1. Check org exists
// 2. Insert organization_members row with role_level = role_level_granted
// 3. Mark invite as used

const { data: invite } = await supabase
  .from('trainer_invites')
  .select('*')
  .eq('code_hash', hashedCode)
  .single();

if (!invite || invite.revoked || invite.uses >= invite.max_uses) {
  throw new Error('Invalid or expired invite');
}

// Check org exists
const { data: org } = await supabase
  .from('organizations')
  .select('id')
  .eq('id', invite.organization_id)
  .single();

if (!org) throw new Error('Organization not found');

// Insert membership
const { error: memberError } = await supabase
  .from('organization_members')
  .insert({
    organization_id: invite.organization_id,
    user_id: user.id,
    role_level: invite.role_level_granted,
  })
  .on('*', () => {})
  .select();

if (memberError && !memberError.message.includes('unique')) throw memberError;

// Mark as used
await supabase
  .from('trainer_invites')
  .update({ uses: invite.uses + 1 })
  .eq('id', invite.id);

return { message: 'Joined organization', org_id: org.id };
```

**App (React Native/Expo):**

1) Create invite generator UI (admin only):
   - Input: invite description (optional), role selector (professor / estagiário / admin, with role_level 10/5/50)
   - Output: 8-char code, expiry date, max uses
   - Call: POST to edge function or Supabase stored procedure

2) Update claim-invite screen (app/invite/[code].tsx or app/auth-callback.tsx):
   - When claiming code, user joins organization from invite
   - If user not signed up: show sign-up flow first, then claim
   - On success: auto-select org from invite and redirect to home

3) Add "Invites" management tab (at /invites or nested admin):
   - List active invites for org
   - Show: code, role, uses/max_uses, created_by, expiry
   - Admin can revoke invites

**Testing:**
- Admin creates invite with role "Professor"
- Share code with new user
- New user signs up + claims code
- Verify membership created with role_level=10 in correct org
- Test max_uses limit
- Test expiry
- Test revoke
```

---

## PR 5 — Class Staff Roles (Professor can have Multiple Classes)

### Objective
Solve "professor can have many turmas" + estagiário as assistant, without mixing.

### Deliverables

- **Supabase table:** `class_staff` (organization_id, class_id, user_id, staff_role)
- **RLS policies:** Professor sees only their classes (unless admin)
- **App UI:** Admin assigns professor/estagiário to class in "Team" section

### DoD
- ✅ Professor doesn't see other professors' classes
- ✅ Admin (role ≥50) sees all classes
- ✅ Estagiário can assist multiple professors (staff_role = "assistant")

### Prompt for Codex

```text
Implement class-staff relationships (professor/estagiário ↔ class mapping).

**Back-end (Supabase):**

1) Create class_staff table:

```sql
create table if not exists public.class_staff (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  class_id text not null references classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  staff_role text not null, -- 'head' | 'assistant' | 'intern'
  created_at timestamptz not null default now(),
  unique(class_id, user_id)
);

create index if not exists class_staff_org_id on class_staff(organization_id);
create index if not exists class_staff_class_id on class_staff(class_id);
create index if not exists class_staff_user_id on class_staff(user_id);
```

2) Update classes RLS (add view permission for staff):

```sql
drop policy if exists "classes select trainer" on public.classes;
create policy "classes select trainer" on public.classes
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = classes.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
    or exists (
      select 1 from class_staff cs
      where cs.class_id = classes.id
        and cs.user_id = auth.uid()
    )
  );
```

3) RLS on class_staff:

```sql
alter table public.class_staff enable row level security;

drop policy if exists "class_staff select" on public.class_staff;
create policy "class_staff select" on public.class_staff
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = class_staff.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "class_staff insert admin" on public.class_staff;
create policy "class_staff insert admin" on public.class_staff
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = class_staff.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

drop policy if exists "class_staff delete admin" on public.class_staff;
create policy "class_staff delete admin" on public.class_staff
  for delete
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = class_staff.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );
```

4) Migrate existing data (assign creators as "head"):

```sql
insert into class_staff (organization_id, class_id, user_id, staff_role)
select distinct
  c.organization_id,
  c.id,
  c.owner_id,
  'head'
from classes c
where c.owner_id is not null
  and not exists (
    select 1 from class_staff cs
    where cs.class_id = c.id and cs.user_id = c.owner_id
  )
on conflict do nothing;
```

**App (React Native/Expo):**

1) Update classes list to filter by staff membership:
   - Default: show "My classes" (where user is in class_staff)
   - Admin: toggle "All classes" (for org management)
   - Hook: `useMyClasses()` filters by activeOrganizationId + user_id

2) Add "Team" section in class detail (app/class/[id].tsx):
   - Show: head professor, assistants, interns
   - Admin: CRUD buttons to assign/remove staff
   - Dropdown to select user + role (head/assistant/intern)
   - Call: POST class_staff when assigning; DELETE when removing

3) Update UI labels:
   - "Head Coach" = staff_role: head
   - "Assistant" = staff_role: assistant
   - "Intern" = staff_role: intern

**Testing:**
- Create class with admin user A
- Assign professor B as "head"
- Sign in as B: only sees that class
- Admin A: sees all classes in org
- Assign estagiário C as "assistant"
- C logsin: sees the class
- Remove C from class: C can't see it anymore
```

---

## PR 6 — Events/Tournaments (Org Calendar + Per-Class)

### Objective
Chronogram of tournaments/events that coordinators create; teachers see them.

### Deliverables

- **Supabase tables:** `events` (org-level), `event_classes` (event↔class mapping, optional)
- **App UI:** Month/week calendar, admin creation, teacher viewing
- **Display:** Events in home feed (next 7 days)

### DoD
- ✅ Admin creates event visible to all org members
- ✅ Optional: Link events to specific classes
- ✅ Event shows location if set

### Prompt for Codex

```text
Create Events/Tournaments module with org-level calendar.

**Back-end (Supabase):**

1) Create events table:

```sql
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  title text not null,
  type text, -- 'tournament' | 'friendly' | 'training' | 'meeting'
  sport text not null, -- 'volleyball' | 'futsal' | etc.
  start_at timestamptz not null,
  end_at timestamptz not null,
  location_id uuid references locations on delete set null,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists events_org_id on events(organization_id);
create index if not exists events_start on events(start_at);

-- Optional: link events to classes
create table if not exists public.event_classes (
  event_id uuid not null references events on delete cascade,
  class_id text not null references classes(id) on delete cascade,
  organization_id uuid not null references organizations on delete cascade,
  unique(event_id, class_id)
);

create index if not exists event_classes_event_id on event_classes(event_id);
create index if not exists event_classes_class_id on event_classes(class_id);
```

2) RLS:

```sql
alter table public.events enable row level security;

drop policy if exists "events select member" on public.events;
create policy "events select member" on public.events
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = events.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "events insert admin" on public.events;
create policy "events insert admin" on public.events
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = events.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

drop policy if exists "events update admin" on public.events;
create policy "events update admin" on public.events
  for update
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = events.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

drop policy if exists "events delete admin" on public.events;
create policy "events delete admin" on public.events
  for delete
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = events.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

alter table public.event_classes enable row level security;

drop policy if exists "event_classes select" on public.event_classes;
create policy "event_classes select" on public.event_classes
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = event_classes.organization_id
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "event_classes insert admin" on public.event_classes;
create policy "event_classes insert admin" on public.event_classes
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = event_classes.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );
```

**App (React Native/Expo):**

1) Create event CRUD screens:
   - /events: month/week calendar view with filter (sport, type)
   - /events/[id]: detail view with location + notes
   - Admin: create/edit event (form with title, date, time, location, class links)

2) Home feed:
   - Show next 7 days of events as cards
   - Tap to view detail

3) Class detail:
   - Show linked events (if any)

Keep existing patterns.
```

---

## PR 7 — Minimal Audit + Coordination Reports

### Objective
Coordinators see "who did attendance/report and when" + pending tasks by class/teacher.

### Deliverables

- **Columns:** Add `created_by`, `updated_by`, `updated_at` to core tables
- **Reports UI:** Cards for pending attendance, pending reports, past activity
- **Export:** CSV/PDF (optional)

### DoD
- ✅ Admin sees "classes without attendance today"
- ✅ Admin sees "pending reports by period"
- ✅ Audit logs author + timestamp

### Prompt for Codex

```text
Add minimal audit trail and coordination reports.

**Back-end (Supabase):**

1) Add audit columns:

```sql
-- Add to these tables: attendance_logs, session_logs, classes, events, absence_notices
alter table public.attendance_logs
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz;

alter table public.session_logs
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz;

alter table public.classes
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz;

alter table public.events
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz;

alter table public.absence_notices
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz;
```

2) Triggers to auto-populate created_by, updated_by, updated_at:

```sql
create or replace function public.set_audit_fields()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    new.updated_at := now();
  elsif tg_op = 'UPDATE' then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- Apply to tables
drop trigger if exists attendance_logs_audit on public.attendance_logs;
create trigger attendance_logs_audit before insert or update on public.attendance_logs
  for each row execute function public.set_audit_fields();

drop trigger if exists session_logs_audit on public.session_logs;
create trigger session_logs_audit before insert or update on public.session_logs
  for each row execute function public.set_audit_fields();

drop trigger if exists classes_audit on public.classes;
create trigger classes_audit before insert or update on public.classes
  for each row execute function public.set_audit_fields();

drop trigger if exists events_audit on public.events;
create trigger events_audit before insert or update on public.events
  for each row execute function public.set_audit_fields();

drop trigger if exists absence_notices_audit on public.absence_notices;
create trigger absence_notices_audit before insert or update on public.absence_notices
  for each row execute function public.set_audit_fields();
```

3) View for pending attendance:

```sql
create or replace view public.v_pending_attendance as
select
  c.id class_id,
  c.name class_name,
  c.owner_id teacher_id,
  c.organization_id,
  current_date as session_date,
  (select count(*) from students s where s.classid = c.id) as student_count,
  (select count(*) from attendance_logs al where al.classid = c.id and al.date_key = to_char(current_date, 'YYYY-MM-DD')) as attendance_recorded
from classes c
where not exists (
  select 1 from attendance_logs al
  where al.classid = c.id
    and al.date_key = to_char(current_date, 'YYYY-MM-DD')
);

grant select on public.v_pending_attendance to authenticated;
```

4) View for pending session logs (reports):

```sql
create or replace view public.v_pending_session_logs as
select
  c.id class_id,
  c.name class_name,
  c.owner_id teacher_id,
  c.organization_id,
  current_date - interval '7 days' as period_start,
  (
    select count(*) from session_logs sl
    where sl.classid = c.id
      and sl.createdAt::date >= current_date - interval '7 days'
  ) as reports_in_period
from classes c
where (
  select count(*) from session_logs sl
  where sl.classid = c.id
    and sl.createdAt::date >= current_date - interval '7 days'
) < 3; -- less than 3 reports in last 7 days
```

**App (React Native/Expo):**

1) Create reports screen (admin only, /reports or nested):
   - Tab 1: "Pending Attendance"
     - List from v_pending_attendance
     - Show: class name, pending indicator
     - Tap: open attendance log UI for that class
   - Tab 2: "Pending Session Logs"
     - List from v_pending_session_logs
     - Show: class name, reports count this week
     - Tap: open session log form
   - Tab 3: "Activity" (optional)
     - Recent actions: created_by, created_at, action type

2) CSV export (optional):
   - Export pending attendance/reports as CSV
   - Include: class name, teacher, date, status

3) Home dashboard:
   - Add card "Pending Actions" (admin only)
   - Show count of pending items

**Testing:**
- Create class with session but no attendance for today
- Query v_pending_attendance: should show that class
- Trigger v_pending_session_logs with <3 reports in last week
- Filter reports screen by date range
- Force org switch: reports per-org
```

---

## PR 8 — Multi-Sport Consistency (normalize `sport` field)

### Objective
Support volleyball / futsal / etc. without "3 separate apps".

### Deliverables

- **Add `sport` column** to `classes`, `events`
- **UI:** Sport selector in class/event forms
- **Display:** Sport badge in lists + agenda

### DoD
- ✅ Can filter agenda by sport
- ✅ Classes show sport icon/badge

### Prompt for Codex

```text
Add normalized multi-sport support (volleyball, futsal, basketball, etc.).

**Back-end (Supabase):**

1) Add sport columns:

```sql
alter table public.classes
  add column if not exists sport text not null default 'volleyball';

alter table public.events
  add column if not exists sport text not null default 'volleyball';

-- Optional: create enum
create type public.sport_type as enum ('volleyball', 'futsal', 'basketball', 'handball');
-- Then change columns to: alter table classes alter column sport set data type sport_type using sport::sport_type;
```

**App (React Native/Expo):**

1) Update class create/edit form:
   - Add sport selector (dropdown/radio)
   - Options: Volleyball, Futsal, Basketball, Handball

2) Update event create/edit form:
   - Same sport selector

3) Display:
   - Class list: show sport badge (🏐 / ⚽ / 🏀 etc.)
   - Agenda: filter by sport (optional)
   - Event list: filter by sport

4) Sync to local DB:
   - Add `sport TEXT DEFAULT 'volleyball'` to local classes table

Keep existing patterns.
```

---

# Final Checklist (Use Every PR)

```text
MUST-HAVES FOR EVERY PR:
- ✅ No pattern breaks (expo-router, hooks, providers still work)
- ✅ 1 PR = 1 feature batch
- ✅ RLS + migrations with safe rollback (use if not exists / on conflict)
- ✅ Provide manual test steps
- ✅ Ensure full org_id isolation (no data leaks between orgs)
- ✅ Handle user with 2+ workspaces toggling orgs
- ✅ Update README with feature docs (optional, can be PR 9)

EXTRA:
- Run `npm run lint` after code edits
- Test on web + mobile if possible
- Commit migrations separately if multiple
```

---

## How This Fits Your Real Case

**Workspace "Rede Esportes Pinhais":**
- Admins: Alessandro / Mariah / Rosangela (role_level = 50)
- Teachers: invited with coach code (role_level = 10)
- Assistants / Interns: role_level = 5
- Classes: turmas do Pinhais with location "Quadra Rede Esperança"
- Local: Quadra Rede Esperança managed by location_id (org-scoped)

**Workspace "Gustavo – Projeto Social":**
- You = admin (role_level = 50)
- Single org, zero members except you
- Classes: your social program
- Local: can also use "Rede Esperança" location without data mixing (different org_id)

**Data Isolation Guarantee:**
- Classes in Pinhais org have `organization_id = pinhais-org-uuid`
- Classes in Social org have `organization_id = social-org-uuid`
- RLS queries all check org membership
- Even if both use same location_id, classes are filtered by organization_id

---

**You're ready to start!**
Pick PR 1 and post in Codex whenever you're ready. I'll track progress here.
