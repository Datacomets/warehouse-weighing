-- ============================================================
-- COMETS GR — Bootstrap Schema for New Supabase Project
-- ============================================================
-- Run this ONCE on the new WarehouseWeighing project via SQL Editor.
-- It will:
--   1. Drop any leftover test schema (profiles, weight_records)
--   2. Apply all production migrations 0001 → 0007 in order
--
-- After running, the project will have the full COMETS GR schema
-- ready to receive migrated data from the old prod project.
-- ============================================================

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  PHASE 0: Cleanup old test schema (safe — empty/test only) ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Drop leftover test tables from earlier prototype
drop table if exists weight_records cascade;
drop table if exists profiles cascade;

-- Drop any leftover types/functions from prototype
drop type if exists user_role cascade;
drop type if exists doc_status cascade;
drop type if exists weight_kind cascade;
drop function if exists handle_new_user() cascade;
drop function if exists next_wh_number() cascade;
drop function if exists current_role_name() cascade;
drop function if exists set_updated_at() cascade;

-- Wipe existing auth users (will be re-created via migration script)
-- (Service role can do this via Dashboard SQL Editor)
delete from auth.users;

-- Drop leftover tables
drop table if exists running_numbers cascade;
drop table if exists gr_documents cascade;
drop table if exists weight_measurements cascade;
drop table if exists count_grid_entries cascade;
drop table if exists issue_reports cascade;
drop table if exists weight_photos cascade;
drop table if exists audit_log cascade;
drop table if exists item_master cascade;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  MIGRATION 0001 — initial schema                            ║
-- ╚═══════════════════════════════════════════════════════════╝

create extension if not exists "pgcrypto";

create type user_role as enum ('operator', 'qc', 'manager', 'admin_sap', 'admin');

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

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

create type doc_status as enum ('in_progress', 'pending_sap', 'completed');

create table if not exists gr_documents (
  id uuid primary key default gen_random_uuid(),
  wh_number text unique not null,
  status doc_status not null default 'in_progress',
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
  qc_status text,
  remarks text,
  sap_inbound_id text,
  sap_notification_id text,
  sap_attachment_url text,
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

create type weight_kind as enum ('per_pcs', 'per_inner', 'per_carton');

create table if not exists weight_measurements (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references gr_documents(id) on delete cascade,
  kind weight_kind not null,
  seq int not null,
  value numeric not null,
  per_100 boolean not null default false,
  qty_per_inner int,
  created_at timestamptz not null default now()
);

create index if not exists weight_measurements_doc_kind_idx
  on weight_measurements(document_id, kind);

create table if not exists count_grid_entries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references gr_documents(id) on delete cascade,
  row_index int not null,
  col_index int not null,
  value numeric not null,
  created_at timestamptz not null default now(),
  unique(document_id, row_index, col_index)
);

create table if not exists issue_reports (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references gr_documents(id) on delete cascade,
  issue_type text not null,
  defect_code text,
  quantity numeric,
  notes text,
  photos text[] default '{}',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists weight_photos (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references gr_documents(id) on delete cascade,
  kind weight_kind,
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references gr_documents(id) on delete cascade,
  actor uuid references profiles(id),
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_gr_documents_updated_at on gr_documents;
create trigger trg_gr_documents_updated_at
before update on gr_documents
for each row execute function set_updated_at();

alter table profiles            enable row level security;
alter table gr_documents        enable row level security;
alter table weight_measurements enable row level security;
alter table count_grid_entries  enable row level security;
alter table issue_reports       enable row level security;
alter table weight_photos       enable row level security;
alter table audit_log           enable row level security;

create or replace function current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role::text from profiles where id = auth.uid()
$$;

drop policy if exists "profiles read"  on profiles;
create policy "profiles read"  on profiles for select using (auth.role() = 'authenticated');
drop policy if exists "profiles self update" on profiles;
create policy "profiles self update" on profiles for update using (id = auth.uid());
drop policy if exists "profiles admin all" on profiles;
create policy "profiles admin all" on profiles for all
  using (current_role_name() = 'admin')
  with check (current_role_name() = 'admin');

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

-- Storage bucket policies (assumes buckets exist — create via Dashboard if not)
drop policy if exists "gr-photos read"   on storage.objects;
create policy "gr-photos read"   on storage.objects for select using (bucket_id = 'gr-photos');
drop policy if exists "gr-photos insert" on storage.objects;
create policy "gr-photos insert" on storage.objects for insert with check (bucket_id = 'gr-photos' and auth.role() = 'authenticated');
drop policy if exists "gr-photos update" on storage.objects;
create policy "gr-photos update" on storage.objects for update using (bucket_id = 'gr-photos' and auth.role() = 'authenticated');
drop policy if exists "gr-photos delete" on storage.objects;
create policy "gr-photos delete" on storage.objects for delete using (bucket_id = 'gr-photos' and auth.role() = 'authenticated');

drop policy if exists "sap-attachments read"   on storage.objects;
create policy "sap-attachments read"   on storage.objects for select using (bucket_id = 'sap-attachments');
drop policy if exists "sap-attachments insert" on storage.objects;
create policy "sap-attachments insert" on storage.objects for insert with check (bucket_id = 'sap-attachments' and auth.role() = 'authenticated');
drop policy if exists "sap-attachments update" on storage.objects;
create policy "sap-attachments update" on storage.objects for update using (bucket_id = 'sap-attachments' and auth.role() = 'authenticated');
drop policy if exists "sap-attachments delete" on storage.objects;
create policy "sap-attachments delete" on storage.objects for delete using (bucket_id = 'sap-attachments' and auth.role() = 'authenticated');


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  MIGRATION 0002 — item_master                              ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists item_master (
  item_code           text primary key,
  description         text not null,
  product_category    text,
  purchased           boolean not null default false,
  in_house_production boolean not null default false,
  obsolete            boolean not null default false,
  source_updated_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists item_master_desc_idx     on item_master (description);
create index if not exists item_master_category_idx on item_master (product_category);

drop trigger if exists trg_item_master_updated_at on item_master;
create trigger trg_item_master_updated_at
before update on item_master
for each row execute function set_updated_at();

alter table item_master enable row level security;

drop policy if exists "item_master read" on item_master;
create policy "item_master read" on item_master for select
  using (auth.role() = 'authenticated');

drop policy if exists "item_master admin write" on item_master;
create policy "item_master admin write" on item_master for all
  using (current_role_name() in ('admin','admin_sap'))
  with check (current_role_name() in ('admin','admin_sap'));

-- (Seed rows from 0002 omitted — data migration will populate item_master)


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  MIGRATION 0003 — restrict operator read                   ║
-- ╚═══════════════════════════════════════════════════════════╝

drop policy if exists "gr read all" on gr_documents;
create policy "gr read by role" on gr_documents for select using (
  current_role_name() in ('admin', 'admin_sap', 'qc', 'manager')
  or created_by = auth.uid()
);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  MIGRATION 0004 — remainder_pcs                            ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table gr_documents add column if not exists remainder_pcs int;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  MIGRATION 0005 — weight_unit                              ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table gr_documents add column if not exists weight_unit text not null default 'kg';


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  MIGRATION 0006 — skip sections                            ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table gr_documents
  add column if not exists skip_per_pcs     boolean not null default false,
  add column if not exists skip_per_inner   boolean not null default false,
  add column if not exists skip_per_carton  boolean not null default false,
  add column if not exists skip_reason_per_pcs    text,
  add column if not exists skip_reason_per_inner  text,
  add column if not exists skip_reason_per_carton text;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  MIGRATION 0007 — manager joins update roles               ║
-- ╚═══════════════════════════════════════════════════════════╝

drop policy if exists "gr update by role" on gr_documents;
create policy "gr update by role" on gr_documents for update
  using (
    current_role_name() in ('admin', 'admin_sap', 'qc', 'manager')
    or (created_by = auth.uid() and status = 'in_progress')
  )
  with check (
    current_role_name() in ('admin', 'admin_sap', 'qc', 'manager')
    or created_by = auth.uid()
  );


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  DONE — schema is ready for data migration                 ║
-- ╚═══════════════════════════════════════════════════════════╝

-- After this completes, switch to your local machine and run:
--   node scripts/migrate-data.mjs
-- with OLD_* and NEW_* env vars set.
