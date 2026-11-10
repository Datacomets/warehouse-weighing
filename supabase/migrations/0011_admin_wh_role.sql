-- ===========================================================
-- 0011 — บทบาทใหม่ AdminWH (admin_wh)
--
-- * AdminWH มีสิทธิ์เท่ากับ "ผู้จัดการ" ทุกอย่าง (ดู Dashboard, ทีม,
--   เอกสารทุกใบ, Export, แก้ไขเอกสารที่เสร็จแล้ว)
-- * และ "ยกเลิกใบงาน / กู้คืน" ได้ — สิทธิ์ยกเลิกผูกกับบทบาท AdminWH
--   (ทุกคนที่เป็น AdminWH ยกเลิกได้; ตาราง doc_cancelers ยังใช้เพิ่มรายคนได้)
--
-- รันใน Supabase → SQL Editor **2 ครั้ง** (Postgres ไม่ให้ใช้ค่าบทบาทใหม่
-- ในการรันเดียวกับที่สร้าง):
--   ครั้งที่ 1: รันส่วน STEP 1 (ตั้งแต่บรรทัดนี้ถึงก่อน STEP 2)
--   ครั้งที่ 2: รันส่วน STEP 2
-- รันซ้ำได้ ไม่เสียหาย
-- ===========================================================

-- ======================= STEP 1 =======================
alter type user_role add value if not exists 'admin_wh' after 'admin_sap';

-- AdminWH อ่านเอกสารได้เหมือนผู้จัดการ (คงเงื่อนไขเดิมจาก 0010 ทุกประการ)
drop policy if exists "gr read by role" on gr_documents;
create policy "gr read by role" on gr_documents for select using (
  (
    cancelled_at is null
    and (
      current_role_name() in ('admin', 'admin_sap', 'admin_wh', 'qc', 'manager')
      or created_by = auth.uid()
    )
  )
  or (cancelled_at is not null and (can_cancel_docs() or can_view_logs()))
);

-- AdminWH แก้ไขเอกสารได้เหมือนผู้จัดการ (คงเงื่อนไขเดิมจาก 0007)
drop policy if exists "gr update by role" on gr_documents;
create policy "gr update by role" on gr_documents for update
  using (
    current_role_name() in ('admin', 'admin_sap', 'admin_wh', 'qc', 'manager')
    or (created_by = auth.uid() and status = 'in_progress')
  )
  with check (
    current_role_name() in ('admin', 'admin_sap', 'admin_wh', 'qc', 'manager')
    or created_by = auth.uid()
  );

-- สิทธิ์ยกเลิกใบงาน: บทบาท AdminWH หรืออยู่ในตาราง doc_cancelers
create or replace function can_cancel_docs() returns boolean
language sql stable security definer set search_path = public as $$
  select current_role_name() = 'admin_wh'
      or exists (select 1 from doc_cancelers where user_id = auth.uid())
$$;
grant execute on function can_cancel_docs() to authenticated;

-- ======================= STEP 2 =======================
-- (รันแยกหลัง STEP 1 สำเร็จ)
-- เปลี่ยนบทบาทคุณโชติกา (10162) จากผู้จัดการ → AdminWH
-- update profiles set role = 'admin_wh'
--  where id = (select id from auth.users where email = '10162@comets.local');
-- สิทธิ์ยกเลิกมาจากบทบาทแล้ว จึงเอารายชื่อรายคนออก
-- delete from doc_cancelers
--  where user_id = (select id from auth.users where email = '10162@comets.local');
