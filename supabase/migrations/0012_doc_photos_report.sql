-- ===========================================================
-- 0012 — รูปสินค้าผูกกับใบงาน (สูงสุด 4 รูป/ใบ) · ค้นหาสินค้าแบบรายการแนะนำ · ข้อมูลหน้า Report
-- (เท่ากับ 0013 + 0014 ของเวอร์ชัน Mac)
-- เพิ่มอย่างเดียว ไม่แก้/ไม่ลบข้อมูลเดิม · รันซ้ำได้
-- ===========================================================

-- 1) รูปสินค้าของใบงาน ------------------------------------------------
create table if not exists doc_item_photos (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references gr_documents(id) on delete cascade,
  path        text not null,                 -- path ใน bucket gr-photos
  url         text not null,
  is_primary  boolean not null default false,
  created_by  uuid references profiles(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists doc_item_photos_doc_idx on doc_item_photos(document_id);

alter table doc_item_photos enable row level security;

-- รูปสินค้าเป็นรูปอ้างอิง ทุกคนที่ล็อกอินดูได้
drop policy if exists "dip read" on doc_item_photos;
create policy "dip read" on doc_item_photos for select using (auth.role() = 'authenticated');

drop policy if exists "dip insert" on doc_item_photos;
create policy "dip insert" on doc_item_photos for insert
  with check (auth.role() = 'authenticated' and created_by = auth.uid());

-- ลบ/แก้: คนถ่ายเอง · admin · admin_wh · manager · TEAMDATA (log_viewers)
create or replace function can_manage_doc_photo(p_created_by uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_created_by = auth.uid()
      or current_role_name() in ('admin', 'admin_wh', 'manager')
      or exists (select 1 from log_viewers where user_id = auth.uid())
$$;

drop policy if exists "dip update" on doc_item_photos;
create policy "dip update" on doc_item_photos for update using (can_manage_doc_photo(created_by));
drop policy if exists "dip delete" on doc_item_photos;
create policy "dip delete" on doc_item_photos for delete using (can_manage_doc_photo(created_by));

-- สูงสุด 4 รูปต่อใบงาน · รูปแรกเป็นรูปหลักอัตโนมัติ
create or replace function doc_photo_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from doc_item_photos where document_id = new.document_id;
  if n >= 4 then
    raise exception 'รูปครบ 4 รูปแล้ว — ลบรูปเดิมก่อนจึงเพิ่มใหม่ได้' using errcode = 'P0001';
  end if;
  if n = 0 then new.is_primary := true; end if;
  return new;
end $$;
drop trigger if exists doc_photo_before_insert on doc_item_photos;
create trigger doc_photo_before_insert before insert on doc_item_photos
  for each row execute function doc_photo_before_insert();

-- ลบรูปหลัก → รูปเก่าสุดที่เหลือขึ้นเป็นรูปหลัก
create or replace function doc_photo_after_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_primary then
    update doc_item_photos set is_primary = true
     where id = (select id from doc_item_photos where document_id = old.document_id order by created_at limit 1);
  end if;
  return old;
end $$;
drop trigger if exists doc_photo_after_delete on doc_item_photos;
create trigger doc_photo_after_delete after delete on doc_item_photos
  for each row execute function doc_photo_after_delete();

-- ตั้งรูปหลัก (ทุกคนที่ล็อกอินตั้งได้ — ไม่ลบข้อมูล)
create or replace function set_primary_doc_photo(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select document_id into d from doc_item_photos where id = p_id;
  if d is null then raise exception 'ไม่พบรูป'; end if;
  update doc_item_photos set is_primary = (id = p_id) where document_id = d;
end $$;

-- รูปหลักของสินค้า (จากใบงานล่าสุดที่มีรูป) — ใช้ได้ทุก role
create or replace function item_cover_url(p_code text) returns text
language sql stable security definer set search_path = public as $$
  select p.url from doc_item_photos p join gr_documents d on d.id = p.document_id
   where d.item_code = p_code and d.cancelled_at is null
   order by d.created_at desc, p.is_primary desc, p.created_at
   limit 1
$$;

-- รูปของสินค้า แยกตามใบงาน — ใบที่ผู้ใช้ไม่มีสิทธิ์เปิด จะซ่อนเลข WH/LOT
create or replace function item_photo_groups(p_code text)
returns table (document_id uuid, wh_number text, lot text, status text, created_at timestamptz, can_open boolean, photos jsonb)
language sql stable security definer set search_path = public as $$
  with me as (select current_role_name() r, auth.uid() u)
  select d.id,
         case when ok then d.wh_number else 'ใบงานอื่น' end,
         case when ok then d.lot end,
         d.status::text, d.created_at, ok,
         (select jsonb_agg(jsonb_build_object('id', p.id, 'url', p.url, 'is_primary', p.is_primary, 'created_by', p.created_by)
                           order by p.is_primary desc, p.created_at)
            from doc_item_photos p where p.document_id = d.id)
    from gr_documents d, me,
         lateral (select (me.r in ('admin','admin_sap','qc','manager','admin_wh') or d.created_by = me.u) as ok) v
   where d.item_code = p_code and d.cancelled_at is null
   order by d.created_at desc
$$;

-- 2) ค้นหาสินค้าจากรหัสบางส่วน/ชื่อ (รายการแนะนำ) -------------------------
create or replace function search_items(q text)
returns table (item_code text, description text, product_category text, obsolete boolean, doc_count int, cover_url text, total int)
language sql stable security invoker set search_path = public as $$
  with m as (
    select im.item_code, im.description, im.product_category, coalesce(im.obsolete, false) obsolete,
           (im.item_code ilike q || '%') starts
      from item_master im
     where length(trim(q)) >= 2
       and (im.item_code ilike '%' || q || '%' or im.description ilike '%' || q || '%')
  ), c as (
    select m.*, (select count(*) from gr_documents d where d.item_code = m.item_code and d.cancelled_at is null)::int doc_count,
           count(*) over ()::int total
      from m
  )
  select c.item_code, c.description, c.product_category, c.obsolete, c.doc_count, item_cover_url(c.item_code), c.total
    from c
   order by c.starts desc, (c.doc_count > 0) desc, c.doc_count desc, c.item_code
   limit 8
$$;

-- 3) ข้อมูลหน้า Report (1 แถว/ใบงาน) — ใช้สิทธิ์ของผู้ดู (RLS เดิม) -------------
-- abnormal = มีค่าชั่งที่ต่างจากค่าเฉลี่ยของกลุ่มเดียวกันเกิน 10%
drop view if exists report_docs;
create view report_docs with (security_invoker = true) as
select d.id, d.wh_number, d.status::text status, d.cancelled_at, d.created_at, d.submitted_at, d.closed_at,
       d.started_at, d.ended_at, d.delivery_date, d.po_number, d.lot, d.item_code, d.description, d.supplier,
       d.qty_per_carton, d.remainder_pcs, d.weight_unit::text weight_unit, d.qc_status::text qc_status,
       d.sap_inbound_id, d.created_by, d.cartons_per_pallet,
       m.product_category,
       pr.full_name created_by_name,
       coalesce(g.full_cartons, 0) full_cartons, g.avg_carton, g.min_carton, g.max_carton,
       w.avg_pcs, w.avg_inner,
       coalesce(i.issue_count, 0) issue_count, i.issue_types,
       coalesce(ph.photo_count, 0) photo_count,
       coalesce(g.full_cartons, 0) * coalesce(d.qty_per_carton, 0) + coalesce(d.remainder_pcs, 0) total_pcs,
       (coalesce(g.abn, false) or coalesce(w.abn, false)) abnormal
  from gr_documents d
  left join item_master m on m.item_code = d.item_code
  left join profiles pr on pr.id = d.created_by
  left join lateral (
    select count(*)::int full_cartons, avg(v) avg_carton, min(v) min_carton, max(v) max_carton,
           coalesce(bool_or(a > 0 and abs(v - a) / a > 0.10), false) abn
      from (select c.value::numeric v, avg(c.value::numeric) over () a, max(c.value::numeric) over () mx, min(c.value::numeric) over () mn
              from count_grid_entries c where c.document_id = d.id) s
  ) g on true
  left join lateral (
    select avg(v) filter (where kind = 'per_pcs') avg_pcs, avg(v) filter (where kind = 'per_inner') avg_inner,
           coalesce(bool_or(a > 0 and abs(v - a) / a > 0.10), false) abn
      from (select wm.kind, wm.value::numeric v,
                   avg(wm.value::numeric) over (partition by wm.kind) a,
                   max(wm.value::numeric) over (partition by wm.kind) mx,
                   min(wm.value::numeric) over (partition by wm.kind) mn,
                   count(*) over (partition by wm.kind) cnt
              from weight_measurements wm where wm.document_id = d.id) s
  ) w on true
  left join lateral (
    select count(*)::int issue_count, string_agg(distinct r.issue_type::text, ',') issue_types
      from issue_reports r where r.document_id = d.id
  ) i on true
  left join lateral (select count(*)::int photo_count from doc_item_photos p where p.document_id = d.id) ph on true;

notify pgrst, 'reload schema';

-- 4) ตัวเลือกใน Dropdown หน้า Report (ตามสิทธิ์ของผู้ดู) ---------------------
create or replace function report_options() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('v', c, 'n', n) order by n desc), '[]'::jsonb)
                     from (select product_category c, count(*)::int n from report_docs
                            where cancelled_at is null and product_category is not null group by 1) x),
    'suppliers',  (select coalesce(jsonb_agg(s order by s), '[]'::jsonb)
                     from (select distinct trim(supplier) s from report_docs where coalesce(trim(supplier), '') <> '') x),
    'operators',  (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'n', n) order by name), '[]'::jsonb)
                     from (select created_by id, max(created_by_name) name, count(*)::int n from report_docs
                            where created_by is not null group by 1) x)
  )
$$;

notify pgrst, 'reload schema';

-- ---- 0014: คอลัมน์เพิ่มของ Report (แทนปุ่ม Export Report เดิม) ----
create or replace view report_docs with (security_invoker = true) as
select d.id, d.wh_number, d.status::text status, d.cancelled_at, d.created_at, d.submitted_at, d.closed_at,
       d.started_at, d.ended_at, d.delivery_date, d.po_number, d.lot, d.item_code, d.description, d.supplier,
       d.qty_per_carton, d.remainder_pcs, d.weight_unit::text weight_unit, d.qc_status::text qc_status,
       d.sap_inbound_id, d.created_by, d.cartons_per_pallet,
       m.product_category,
       pr.full_name created_by_name,
       coalesce(g.full_cartons, 0) full_cartons, g.avg_carton, g.min_carton, g.max_carton,
       w.avg_pcs, w.avg_inner,
       coalesce(i.issue_count, 0) issue_count, i.issue_types,
       coalesce(ph.photo_count, 0) photo_count,
       coalesce(g.full_cartons, 0) * coalesce(d.qty_per_carton, 0) + coalesce(d.remainder_pcs, 0) total_pcs,
       (coalesce(g.abn, false) or coalesce(w.abn, false)) abnormal,
       -- 0014: คอลัมน์เพิ่มเพื่อแทนปุ่ม Export Report เดิม
       d.mfg_date, d.exp_date, d.lot_number, d.scale_name,
       d.width_cm, d.length_cm, d.height_cm, d.gross_weight, d.net_weight,
       d.remarks, d.sap_notification_id, d.unlock_reason,
       d.skip_per_pcs, d.skip_reason_per_pcs, d.skip_per_inner, d.skip_reason_per_inner,
       d.skip_per_carton, d.skip_reason_per_carton,
       w.min_pcs, w.max_pcs, w.min_inner, w.max_inner
  from gr_documents d
  left join item_master m on m.item_code = d.item_code
  left join profiles pr on pr.id = d.created_by
  left join lateral (
    select count(*)::int full_cartons, avg(v) avg_carton, min(v) min_carton, max(v) max_carton,
           coalesce(bool_or(a > 0 and abs(v - a) / a > 0.10), false) abn
      from (select c.value::numeric v, avg(c.value::numeric) over () a, max(c.value::numeric) over () mx, min(c.value::numeric) over () mn
              from count_grid_entries c where c.document_id = d.id) s
  ) g on true
  left join lateral (
    select avg(v) filter (where kind = 'per_pcs') avg_pcs, avg(v) filter (where kind = 'per_inner') avg_inner,
           min(v) filter (where kind = 'per_pcs') min_pcs, max(v) filter (where kind = 'per_pcs') max_pcs,
           min(v) filter (where kind = 'per_inner') min_inner, max(v) filter (where kind = 'per_inner') max_inner,
           coalesce(bool_or(a > 0 and abs(v - a) / a > 0.10), false) abn
      from (select wm.kind, wm.value::numeric v,
                   avg(wm.value::numeric) over (partition by wm.kind) a,
                   max(wm.value::numeric) over (partition by wm.kind) mx,
                   min(wm.value::numeric) over (partition by wm.kind) mn,
                   count(*) over (partition by wm.kind) cnt
              from weight_measurements wm where wm.document_id = d.id) s
  ) w on true
  left join lateral (
    select count(*)::int issue_count, string_agg(distinct r.issue_type::text, ',') issue_types
      from issue_reports r where r.document_id = d.id
  ) i on true
  left join lateral (select count(*)::int photo_count from doc_item_photos p where p.document_id = d.id) ph on true;

notify pgrst, 'reload schema';

-- สิทธิ์ (Supabase ให้อยู่แล้วโดยปริยาย — ระบุไว้ให้ชัด; RLS ยังคุมทุกแถว)
grant select, insert, update, delete on doc_item_photos to authenticated;
grant select on report_docs to authenticated;
grant execute on function set_primary_doc_photo(uuid), item_cover_url(text), item_photo_groups(text), search_items(text), report_options(), can_manage_doc_photo(uuid) to authenticated;
