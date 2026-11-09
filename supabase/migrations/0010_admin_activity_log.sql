-- ===========================================================
-- 0010 — Admin เห็นทั้งหมด + เก็บประวัติการทำงานทั้งหมด
--
-- 1) admin (เช่น TEAMDATA) เห็นใบงานที่ถูกยกเลิกได้ (ดูอย่างเดียว)
--    — หน้ารายการ/Dashboard/Export ในแอปยังกรองใบที่ยกเลิกออกเหมือนเดิม
-- 2) activity_log: trigger บันทึก "ทุก" การเพิ่ม/แก้/ลบ ข้อมูลอัตโนมัติ
--    (ใคร · เมื่อไร · ตารางไหน · ค่าเดิม → ค่าใหม่) — admin อ่านได้คนเดียว
-- 3) audit_log / activity_log: แก้ไขหรือลบประวัติไม่ได้ (เดิมใครก็ลบได้)
-- 4) admin_login_history(): ประวัติการเข้าสู่ระบบ (สำหรับหน้า Log)
--
-- รันครั้งเดียวใน Supabase → SQL Editor (รันซ้ำได้ ไม่เสียหาย)
-- ===========================================================

-- 1) admin เห็นใบที่ยกเลิก -----------------------------------------
drop policy if exists "gr read by role" on gr_documents;
create policy "gr read by role" on gr_documents for select using (
  (
    cancelled_at is null
    and (
      current_role_name() in ('admin', 'admin_sap', 'qc', 'manager')
      or created_by = auth.uid()
    )
  )
  or (cancelled_at is not null and (can_cancel_docs() or current_role_name() = 'admin'))
);

-- 2) activity_log -------------------------------------------------
create table if not exists activity_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  actor       uuid,                 -- null = ระบบ / สคริปต์หลังบ้าน
  actor_role  text,
  tbl         text not null,        -- ตารางที่เปลี่ยน
  op          text not null,        -- INSERT | UPDATE | DELETE
  row_id      text,
  document_id uuid,                 -- ใบงานที่เกี่ยวข้อง (ถ้ามี)
  wh_number   text,
  changes     jsonb                 -- INSERT/DELETE: ทั้งแถว · UPDATE: {field: [เดิม, ใหม่]}
);
create index if not exists activity_log_at_idx  on activity_log (at desc);
create index if not exists activity_log_doc_idx on activity_log (document_id);
create index if not exists activity_log_actor_idx on activity_log (actor);

alter table activity_log enable row level security;
drop policy if exists "activity admin read" on activity_log;
create policy "activity admin read" on activity_log for select using (current_role_name() = 'admin');
-- ไม่มี policy insert/update/delete → เขียนได้จาก trigger เท่านั้น แก้/ลบไม่ได้

create or replace function log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_new   jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old   jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row   jsonb := coalesce(v_new, v_old);
  v_doc   uuid;
  v_wh    text;
  v_chg   jsonb := '{}'::jsonb;
  k       text;
  v_skip  text[] := array['updated_at', 'created_at'];
begin
  -- item_master: บันทึกเฉพาะที่ผู้ใช้แก้ในแอป (ไม่บันทึกการนำเข้า SAP ทีละหลายหมื่นแถวจากสคริปต์)
  if tg_table_name = 'item_master' and auth.uid() is null then
    return null;
  end if;

  if tg_table_name = 'gr_documents' then
    v_doc := (v_row->>'id')::uuid;
    v_wh  := v_row->>'wh_number';
  elsif v_row ? 'document_id' then
    v_doc := nullif(v_row->>'document_id', '')::uuid;
    select wh_number into v_wh from gr_documents where id = v_doc;
  end if;

  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if not (k = any(v_skip)) and (v_new->k) is distinct from (v_old->k) then
        v_chg := v_chg || jsonb_build_object(k, jsonb_build_array(v_old->k, v_new->k));
      end if;
    end loop;
    if v_chg = '{}'::jsonb then
      return null;               -- ไม่มีอะไรเปลี่ยนจริง
    end if;
  else
    v_chg := v_row;
  end if;

  insert into activity_log (actor, actor_role, tbl, op, row_id, document_id, wh_number, changes)
  values (auth.uid(), current_role_name(), tg_table_name, tg_op,
          coalesce(v_row->>'id', v_row->>'item_code', v_row->>'user_id'), v_doc, v_wh, v_chg);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['gr_documents', 'weight_measurements', 'count_grid_entries',
                           'issue_reports', 'weight_photos', 'item_master', 'profiles', 'doc_cancelers'] loop
    execute format('drop trigger if exists trg_activity_log on %I', t);
    execute format('create trigger trg_activity_log after insert or update or delete on %I
                    for each row execute function log_activity()', t);
  end loop;
end $$;

-- 3) ประวัติแก้/ลบไม่ได้ -------------------------------------------
drop policy if exists "audit rw"     on audit_log;
drop policy if exists "audit read"   on audit_log;
drop policy if exists "audit insert" on audit_log;
create policy "audit read"   on audit_log for select using (auth.role() = 'authenticated');
create policy "audit insert" on audit_log for insert
  with check (auth.role() = 'authenticated' and (actor is null or actor = auth.uid()));
-- ไม่มี policy update/delete → ประวัติที่บันทึกแล้วแก้หรือลบไม่ได้

-- 4) ประวัติการเข้าสู่ระบบ (admin เท่านั้น) ------------------------
create or replace function admin_login_history(p_from timestamptz, p_to timestamptz)
returns table (at timestamptz, user_id uuid, email text, ip text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if current_role_name() is distinct from 'admin' then
    raise exception 'เฉพาะผู้ดูแลระบบ';
  end if;
  return query
    select e.created_at,
           nullif(e.payload->>'actor_id', '')::uuid,
           coalesce(e.payload->>'actor_username', u.email)::text,
           e.ip_address::text
      from auth.audit_log_entries e
      left join auth.users u on u.id = nullif(e.payload->>'actor_id', '')::uuid
     where e.payload->>'action' = 'login'
       and e.created_at >= p_from and e.created_at < p_to
     order by e.created_at desc
     limit 1000;
end $$;

revoke all on function admin_login_history(timestamptz, timestamptz) from public, anon;
grant execute on function admin_login_history(timestamptz, timestamptz) to authenticated;
