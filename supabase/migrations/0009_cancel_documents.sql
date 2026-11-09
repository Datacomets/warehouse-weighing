-- ===========================================================
-- 0009 — ยกเลิกใบงาน (Cancel documents) — soft cancel, กู้คืนได้
--
-- * ใบงานที่ยกเลิก: ข้อมูลและประวัติยังอยู่ครบ แต่ "หายจากทุกหน้า"
--   (รายการงาน, Dashboard, ทีม, Export) เพราะ RLS ซ่อนไว้
-- * เห็น/ยกเลิก/กู้คืน ได้เฉพาะผู้ที่อยู่ในตาราง doc_cancelers
--   (เริ่มต้น: คุณโชติกา 10162) — ตารางนี้แก้ได้ผ่าน SQL / service role เท่านั้น
-- * ยกเลิกได้เฉพาะสถานะ in_progress / pending_sap (ยังไม่นำเข้า SAP)
-- * สคริปต์สำรองข้อมูล (service role) ยังเห็นใบที่ยกเลิกตามปกติ
--
-- รันครั้งเดียวใน Supabase → SQL Editor (รันซ้ำได้ ไม่เสียหาย)
-- ===========================================================

-- 1) คอลัมน์สถานะการยกเลิก (null = ไม่ได้ยกเลิก)
alter table gr_documents add column if not exists cancelled_at  timestamptz;
alter table gr_documents add column if not exists cancelled_by  uuid references profiles(id);
alter table gr_documents add column if not exists cancel_reason text;   -- wrong_entry | duplicate | other
alter table gr_documents add column if not exists cancel_dup_wh text;   -- เลข WH ที่ซ้ำ (เมื่อ reason = duplicate)
alter table gr_documents add column if not exists cancel_note   text;   -- รายละเอียด / เหตุผลอื่น ๆ

-- 2) ผู้มีสิทธิ์ยกเลิกใบงาน
create table if not exists doc_cancelers (
  user_id    uuid primary key references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table doc_cancelers enable row level security;
drop policy if exists "doc_cancelers self read" on doc_cancelers;
create policy "doc_cancelers self read" on doc_cancelers for select using (user_id = auth.uid());
-- ไม่มี policy สำหรับ insert/update/delete → แก้ได้เฉพาะ SQL / service role

insert into doc_cancelers (user_id)
select id from auth.users where email = '10162@comets.local'
on conflict do nothing;

create or replace function can_cancel_docs() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from doc_cancelers where user_id = auth.uid())
$$;

-- 3) ซ่อนใบที่ยกเลิกจากทุกคน ยกเว้นผู้มีสิทธิ์ยกเลิก
--    (เงื่อนไขเดิมของใบปกติ คงไว้เหมือน 0003 ทุกประการ)
drop policy if exists "gr read by role" on gr_documents;
create policy "gr read by role" on gr_documents for select using (
  (
    cancelled_at is null
    and (
      current_role_name() in ('admin', 'admin_sap', 'qc', 'manager')
      or created_by = auth.uid()
    )
  )
  or (cancelled_at is not null and can_cancel_docs())
);

-- 4) ยกเลิกหลายใบในครั้งเดียว — ตรวจทุกเงื่อนไขฝั่งฐานข้อมูล ผลแยกรายใบ
--    p_items = [{ "id": uuid, "reason": "wrong_entry|duplicate|other",
--                 "dup_wh": "WH-2611-073", "note": "..." }, ...]
create or replace function cancel_documents(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  it        jsonb;
  v_id      uuid;
  v_reason  text;
  v_dup     text;
  v_note    text;
  v_doc     gr_documents;
  v_dup_doc gr_documents;
  v_ids     uuid[];
  res       jsonb := '[]'::jsonb;
begin
  if not can_cancel_docs() then
    raise exception 'ไม่มีสิทธิ์ยกเลิกใบงาน';
  end if;

  select coalesce(array_agg((x->>'id')::uuid), '{}') into v_ids
  from jsonb_array_elements(p_items) x;

  for it in select * from jsonb_array_elements(p_items) loop
    v_id     := (it->>'id')::uuid;
    v_reason := it->>'reason';
    v_dup    := upper(nullif(trim(coalesce(it->>'dup_wh', '')), ''));
    v_note   := nullif(trim(coalesce(it->>'note', '')), '');

    select * into v_doc from gr_documents where id = v_id for update;
    if not found then
      res := res || jsonb_build_object('id', v_id, 'ok', false, 'error', 'ไม่พบใบงาน');
      continue;
    end if;
    if v_doc.cancelled_at is not null then
      res := res || jsonb_build_object('id', v_id, 'wh', v_doc.wh_number, 'ok', false, 'error', 'ใบงานนี้ถูกยกเลิกไปแล้ว');
      continue;
    end if;
    if v_doc.status not in ('in_progress', 'pending_sap') then
      res := res || jsonb_build_object('id', v_id, 'wh', v_doc.wh_number, 'ok', false,
                                       'error', 'ใบงานนี้นำเข้า SAP แล้ว (มีเลข CFSD) ยกเลิกไม่ได้');
      continue;
    end if;
    if v_reason is null or v_reason not in ('wrong_entry', 'duplicate', 'other') then
      res := res || jsonb_build_object('id', v_id, 'wh', v_doc.wh_number, 'ok', false, 'error', 'เหตุผลไม่ถูกต้อง');
      continue;
    end if;
    if v_reason = 'duplicate' then
      if v_dup is null then
        res := res || jsonb_build_object('id', v_id, 'wh', v_doc.wh_number, 'ok', false, 'error', 'ต้องระบุเลข WH ของใบที่ซ้ำ');
        continue;
      end if;
      select * into v_dup_doc from gr_documents where wh_number = v_dup;
      if not found or v_dup_doc.cancelled_at is not null then
        res := res || jsonb_build_object('id', v_id, 'wh', v_doc.wh_number, 'ok', false, 'error', 'ไม่พบใบงาน ' || v_dup || ' ในระบบ');
        continue;
      end if;
      if v_dup_doc.id = v_id or v_dup_doc.id = any(v_ids) then
        res := res || jsonb_build_object('id', v_id, 'wh', v_doc.wh_number, 'ok', false,
                                         'error', 'ใบที่ซ้ำต้องเป็นใบที่เก็บไว้ ไม่ใช่ใบที่กำลังยกเลิก');
        continue;
      end if;
    end if;
    if v_reason = 'other' and v_note is null then
      res := res || jsonb_build_object('id', v_id, 'wh', v_doc.wh_number, 'ok', false, 'error', 'ต้องระบุเหตุผล');
      continue;
    end if;

    update gr_documents
       set cancelled_at  = now(),
           cancelled_by  = auth.uid(),
           cancel_reason = v_reason,
           cancel_dup_wh = case when v_reason = 'duplicate' then v_dup end,
           cancel_note   = v_note
     where id = v_id;

    insert into audit_log (document_id, actor, action, detail)
    values (v_id, auth.uid(), 'cancel_doc',
            jsonb_build_object('reason', v_reason, 'dup_wh', case when v_reason = 'duplicate' then v_dup end,
                               'note', v_note, 'status', v_doc.status));

    res := res || jsonb_build_object('id', v_id, 'wh', v_doc.wh_number, 'ok', true);
  end loop;

  return res;
end $$;

-- 5) กู้คืนใบที่ยกเลิก
create or replace function restore_documents(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id  uuid;
  v_doc gr_documents;
  res   jsonb := '[]'::jsonb;
begin
  if not can_cancel_docs() then
    raise exception 'ไม่มีสิทธิ์กู้คืนใบงาน';
  end if;
  foreach v_id in array p_ids loop
    select * into v_doc from gr_documents where id = v_id for update;
    if not found or v_doc.cancelled_at is null then
      res := res || jsonb_build_object('id', v_id, 'wh', v_doc.wh_number, 'ok', false, 'error', 'ใบงานนี้ไม่ได้ถูกยกเลิก');
      continue;
    end if;
    update gr_documents
       set cancelled_at = null, cancelled_by = null, cancel_reason = null, cancel_dup_wh = null, cancel_note = null
     where id = v_id;
    insert into audit_log (document_id, actor, action, detail)
    values (v_id, auth.uid(), 'restore_doc',
            jsonb_build_object('reason', v_doc.cancel_reason, 'dup_wh', v_doc.cancel_dup_wh, 'note', v_doc.cancel_note));
    res := res || jsonb_build_object('id', v_id, 'wh', v_doc.wh_number, 'ok', true);
  end loop;
  return res;
end $$;

revoke all on function cancel_documents(jsonb)    from public, anon;
revoke all on function restore_documents(uuid[])  from public, anon;
grant execute on function cancel_documents(jsonb)   to authenticated;
grant execute on function restore_documents(uuid[]) to authenticated;
