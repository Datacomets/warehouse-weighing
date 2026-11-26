-- ===========================================================
-- ออกเลข WH ตอนกดบันทึก (แทนการออกเลขตอนเปิดหน้า /new)
--  * alloc_wh_number(): ล็อกตามเดือน แล้วให้เลข = เลขสูงสุดที่มีอยู่จริง + 1
--    เดือนใช้เวลาไทย (Asia/Bangkok)
--  * create_gr_document(): ออกเลข + สร้างเอกสารใน transaction เดียว
--    insert ทำด้วยสิทธิ์ผู้ใช้ (RLS เดิมยังคุมอยู่)
-- next_wh_number() เดิมยังเก็บไว้ ให้หน้าเว็บเก่าที่เปิดค้างอยู่ใช้ได้ระหว่าง deploy
-- ===========================================================

create or replace function alloc_wh_number() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_yymm text := to_char(now() at time zone 'Asia/Bangkok', 'YYMM');
  v_seq  int;
begin
  -- คนบันทึกพร้อมกันจะรอคิวกัน (ล็อกถึงจบ transaction)
  perform pg_advisory_xact_lock(hashtext('wh_number:' || v_yymm));

  select coalesce(max(substring(wh_number from 9)::int), 0) + 1
    into v_seq
    from gr_documents
   where wh_number like 'WH-' || v_yymm || '-%'
     and substring(wh_number from 9) ~ '^[0-9]+$';

  insert into running_numbers (yymm, last_seq) values (v_yymm, v_seq)
  on conflict (yymm) do update set last_seq = excluded.last_seq;

  return 'WH-' || v_yymm || '-' || lpad(v_seq::text, 3, '0');
end $$;

create or replace function create_gr_document(
  p_lot text,
  p_po_number text,
  p_item_code text,
  p_description text,
  p_supplier text,
  p_delivery_date date,
  p_sap_inbound_id text,
  p_sap_notification_id text,
  p_created_by uuid
) returns jsonb
language plpgsql as $$
declare
  v_wh text := alloc_wh_number();
  v_id uuid;
begin
  insert into gr_documents (
    wh_number, status, lot, po_number, item_code, description, supplier,
    delivery_date, sap_inbound_id, sap_notification_id, created_by
  ) values (
    v_wh, 'in_progress', p_lot, p_po_number, p_item_code, p_description, p_supplier,
    p_delivery_date, nullif(p_sap_inbound_id, ''), nullif(p_sap_notification_id, ''), p_created_by
  ) returning id into v_id;

  return jsonb_build_object('id', v_id, 'wh_number', v_wh);
end $$;

revoke execute on function alloc_wh_number() from public, anon;
revoke execute on function create_gr_document(text, text, text, text, text, date, text, text, uuid) from public, anon;
grant execute on function alloc_wh_number() to authenticated, service_role;
grant execute on function create_gr_document(text, text, text, text, text, date, text, text, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
