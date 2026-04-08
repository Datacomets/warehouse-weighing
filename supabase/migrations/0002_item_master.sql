-- ===========================================================
-- COMETS GR — Item master (mirrors SAP "Materials (All Materials)" export)
--
-- Source format (SAP export):
--   Material ID | Material Description | Product Category | Purchased | In-House Production
--
-- We keep column names `item_code` / `description` so the rest of the
-- app (which already uses these names on gr_documents) stays in sync,
-- and add the SAP metadata columns alongside.
-- ===========================================================

create table if not exists item_master (
  item_code           text primary key,                 -- "Material ID"
  description         text not null,                    -- "Material Description"
  product_category    text,                             -- "Product Category Description"
  purchased           boolean not null default false,   -- "Purchased"
  in_house_production boolean not null default false,   -- "In-House Production"
  obsolete            boolean not null default false,   -- inferred from "*Obsolete*" prefix in description
  source_updated_at   timestamptz,                      -- "Last Updated On" from the SAP export
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

-- Seed rows taken from the SAP "Materials (All Materials)" sample export
-- so /new can be tested immediately.
insert into item_master
  (item_code, description, product_category, purchased, in_house_production, obsolete)
values
  ('40026',   '*Obsolete - ยกเลิก รหัสผิด*',           'Alcohol',    false, false, true ),
  ('421145',  '*Obsolete - ยกเลิก รหัสผิด*',           'Lips',       false, false, true ),
  ('1110001', 'beW,ALL DAY,FOUNDATION,01LATTE,1*12*6', 'Foundation', true,  true,  false),
  ('1110002', 'beW,ALL DAY,FOUNDATION,02CAPPU,1*12*6', 'Foundation', true,  true,  false),
  ('1110003', 'beW,ANGEL,VOLUME MASCARA,10BLACK,1*12*6','Mascara',   true,  true,  false),
  ('1110004', 'beW,DAY TO NIGHT,EYELINER,10BLACK,1*12*6','Eye Liner',true,  true,  false),
  ('1110005', 'beW,EXOTIQUE,POWDER IN PUFF,WHIT,1*12*12','Powder',   true,  true,  false),
  ('1110006', 'beW,PERFECTIONIST,EYEBROW,03MOCCA,1*12*6','Eyebrow',  true,  true,  false),
  ('1110007', 'beW,PERFECTIONIST,EYEBROW,04ESP,1*12*6','Eyebrow',    true,  true,  false),
  ('1110008', 'beW,XS,SLIMBROW P/C,01TOFFEE NUT,1*12*6','Eyebrow',   true,  true,  false)
on conflict (item_code) do nothing;
