-- ===========================================================
-- COMETS GR — Goods Receiving database schema
-- Run this in Supabase SQL Editor (or via Supabase CLI)
-- ===========================================================

-- Extensions
create extension if not exists "pgcrypto";

-- =========================
-- 1. PROFILES (Roles)
-- =========================
create type user_role as enum ('operator', 'qc', 'manager', 'admin_sap', 'admin');

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Auto-create profile when an auth user is created
create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'operator')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- =========================
-- 2. RUNNING NUMBER (WH-YYMM-XXX)
-- =========================
create table if not exists running_numbers (
  yymm text primary key,
  last_seq int not null default 0
);

create or replace function next_wh_number() returns text
language plpgsql security definer as $$
declare
  v_yymm text := to_char(now(), 'YYMM');
  v_seq int;
begin
  insert into running_numbers (yymm, last_seq)
  values (v_yymm, 1)
  on conflict (yymm) do update set last_seq = running_numbers.last_seq + 1
  returning last_seq into v_seq;

  return 'WH-' || v_yymm || '-' || lpad(v_seq::text, 3, '0');
end $$;

-- =========================
-- 3. GR DOCUMENTS
-- =========================
create type doc_status as enum ('in_progress', 'pending_sap', 'completed');

create table if not exists gr_documents (
  id uuid primary key default gen_random_uuid(),
  wh_number text unique not null,
  status doc_status not null default 'in_progress',

  -- Header / ERP fields
  scale_name text,
  lot text,
  po_number text,
  item_code text,
  description text,
  supplier text,
  delivery_date date,

  qty_per_carton numeric,
  actual_count numeric,
  width_cm numeric,
  length_cm numeric,
  height_cm numeric,
  gross_weight numeric,
  net_weight numeric,
  mfg_date date,
  exp_date date,
  lot_number text,
  qc_status text,             -- 'reimburse' | 'no_reimburse'
  remarks text,

  -- SAP linkage
  sap_inbound_id text,        -- CFSD-XXXX
  sap_notification_id text,   -- INV26-CWZ014#7
  sap_attachment_url text,

  -- Lifecycle
  created_by uuid references profiles(id),
  submitted_by uuid references profiles(id),
  submitted_at timestamptz,
  closed_by uuid references profiles(id),
  closed_at timestamptz,
  unlock_reason text,

  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gr_documents_status_idx on gr_documents(status);
create index if not exists gr_documents_created_by_idx on gr_documents(created_by);

-- =========================
-- 4. WEIGHT MEASUREMENTS (per pcs / inner / carton)
-- =========================
create type weight_kind as enum ('per_pcs', 'per_inner', 'per_carton');

create table if not exists weight_measurements (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references gr_documents(id) on delete cascade,
  kind weight_kind not null,
  seq int not null,
  value numeric not null,
  -- per_pcs metadata
  per_100 boolean not null default false,
  -- per_inner metadata
  qty_per_inner int,
  created_at timestamptz not null default now()
);

create index if not exists weight_measurements_doc_kind_idx
  on weight_measurements(document_id, kind);

-- =========================
-- 5. COUNT VERIFICATION GRID
-- =========================
create table if not exists count_grid_entries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references gr_documents(id) on delete cascade,
  row_index int not null,
  col_index int not null,
  value numeric not null,
  created_at timestamptz not null default now(),
  unique(document_id, row_index, col_index)
);

-- =========================
-- 6. ISSUE REPORTS
-- =========================
create table if not exists issue_reports (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references gr_documents(id) on delete cascade,
  issue_type text not null,    -- missing | damaged | label_mismatch | other
  defect_code text,
  quantity numeric,
  notes text,
  photos text[] default '{}',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- =========================
-- 7. PHOTOS attached to weight readings
-- =========================
create table if not exists weight_photos (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references gr_documents(id) on delete cascade,
  kind weight_kind,
  url text not null,
  created_at timestamptz not null default now()
);

-- =========================
-- 8. AUDIT LOG (unlock, status changes etc.)
-- =========================
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references gr_documents(id) on delete cascade,
  actor uuid references profiles(id),
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- =========================
-- updated_at trigger
-- =========================
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_gr_documents_updated_at on gr_documents;
create trigger trg_gr_documents_updated_at
before update on gr_documents
for each row execute function set_updated_at();

-- =========================
-- ROW LEVEL SECURITY
-- =========================
alter table profiles            enable row level security;
alter table gr_documents        enable row level security;
alter table weight_measurements enable row level security;
alter table count_grid_entries  enable row level security;
alter table issue_reports       enable row level security;
alter table weight_photos       enable row level security;
alter table audit_log           enable row level security;

-- Helper: current user role
create or replace function current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role::text from profiles where id = auth.uid()
$$;

-- Profiles: everyone authenticated can read; only self can update; admin can manage all
drop policy if exists "profiles read"  on profiles;
create policy "profiles read"  on profiles for select using (auth.role() = 'authenticated');
drop policy if exists "profiles self update" on profiles;
create policy "profiles self update" on profiles for update using (id = auth.uid());
drop policy if exists "profiles admin all" on profiles;
create policy "profiles admin all" on profiles for all
  using (current_role_name() = 'admin')
  with check (current_role_name() = 'admin');

-- GR documents: any authenticated user can read; operator can insert/update own in_progress
drop policy if exists "gr read all" on gr_documents;
create policy "gr read all" on gr_documents for select using (auth.role() = 'authenticated');

drop policy if exists "gr insert authenticated" on gr_documents;
create policy "gr insert authenticated" on gr_documents for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "gr update by role" on gr_documents;
create policy "gr update by role" on gr_documents for update
  using (
    current_role_name() in ('admin','admin_sap','qc')
    or (created_by = auth.uid() and status = 'in_progress')
  )
  with check (
    current_role_name() in ('admin','admin_sap','qc')
    or created_by = auth.uid()
  );

drop policy if exists "gr delete admin" on gr_documents;
create policy "gr delete admin" on gr_documents for delete using (current_role_name() = 'admin');

-- Child tables — allow if user can update parent doc
drop policy if exists "wm rw" on weight_measurements;
create policy "wm rw" on weight_measurements for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "cg rw" on count_grid_entries;
create policy "cg rw" on count_grid_entries for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "ir rw" on issue_reports;
create policy "ir rw" on issue_reports for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "wp rw" on weight_photos;
create policy "wp rw" on weight_photos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "audit rw" on audit_log;
create policy "audit rw" on audit_log for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- =========================
-- STORAGE buckets for photos / SAP attachments
-- (Create the buckets first via Dashboard → Storage → New bucket, then run these policies)
-- =========================
-- insert into storage.buckets (id, name, public) values ('gr-photos','gr-photos', true) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('sap-attachments','sap-attachments', true) on conflict do nothing;

-- gr-photos bucket policies
drop policy if exists "gr-photos read"   on storage.objects;
create policy "gr-photos read"   on storage.objects for select using (bucket_id = 'gr-photos');
drop policy if exists "gr-photos insert" on storage.objects;
create policy "gr-photos insert" on storage.objects for insert with check (bucket_id = 'gr-photos' and auth.role() = 'authenticated');
drop policy if exists "gr-photos update" on storage.objects;
create policy "gr-photos update" on storage.objects for update using (bucket_id = 'gr-photos' and auth.role() = 'authenticated');
drop policy if exists "gr-photos delete" on storage.objects;
create policy "gr-photos delete" on storage.objects for delete using (bucket_id = 'gr-photos' and auth.role() = 'authenticated');

-- sap-attachments bucket policies
drop policy if exists "sap-attachments read"   on storage.objects;
create policy "sap-attachments read"   on storage.objects for select using (bucket_id = 'sap-attachments');
drop policy if exists "sap-attachments insert" on storage.objects;
create policy "sap-attachments insert" on storage.objects for insert with check (bucket_id = 'sap-attachments' and auth.role() = 'authenticated');
drop policy if exists "sap-attachments update" on storage.objects;
create policy "sap-attachments update" on storage.objects for update using (bucket_id = 'sap-attachments' and auth.role() = 'authenticated');
drop policy if exists "sap-attachments delete" on storage.objects;
create policy "sap-attachments delete" on storage.objects for delete using (bucket_id = 'sap-attachments' and auth.role() = 'authenticated');
