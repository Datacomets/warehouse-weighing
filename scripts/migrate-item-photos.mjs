#!/usr/bin/env node
/**
 * COMETS GR — ผูกรูปสินค้าแบบเดิม (gr-photos/items/<รหัส>/...) เข้ากับ "ใบงานล่าสุด" ของรหัสนั้น
 * ในตาราง doc_item_photos (migration 0012) — ไม่ย้าย ไม่ลบ ไม่แก้ไฟล์ แค่สร้างแถวอ้างอิง
 * รันซ้ำได้ (ข้ามรูปที่ผูกแล้ว) · สูงสุด 4 รูปต่อใบงาน (รูปใหม่สุดเป็นรูปหลัก ★)
 *
 * Usage (รันในโฟลเดอร์ app ที่มี .env.local):
 *   node scripts/migrate-item-photos.mjs            # ตรวจและรายงาน ไม่เขียนอะไร (ค่าเริ่มต้น)
 *   node scripts/migrate-item-photos.mjs --confirm  # ผูกจริง
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CONFIRM = process.argv.includes("--confirm");
const BUCKET = "gr-photos";
const envFile = join(process.cwd(), ".env.local");
if (existsSync(envFile))
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("ไม่พบ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local)");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

// โฟลเดอร์ใช้ชื่อรหัสที่แปลงอักขระพิเศษเป็น _<hex> (ดู src/lib/itemPhoto.ts → itemPhotoFolder)
const decode = (f) => f.replace(/_([0-9a-f]{1,4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

async function list(prefix) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const folders = (await list("items")).filter((e) => !e.id); // entries without id are folders
let linked = 0, skipped = 0, noDoc = 0, full = 0;
for (const f of folders) {
  const files = (await list(`items/${f.name}`)).filter((e) => e.id && !e.name.startsWith(".")).map((e) => e.name).sort().reverse();
  if (!files.length) continue;
  const code = decode(f.name);
  const { data: docs, error } = await sb
    .from("gr_documents")
    .select("id, wh_number, created_by")
    .eq("item_code", code)
    .is("cancelled_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`gr_documents ${code}: ${error.message}`);
  if (!docs.length) {
    noDoc++;
    console.log(`  - ${code}: ยังไม่มีใบงาน ข้าม`);
    continue;
  }
  const doc = docs[0];
  const { count } = await sb.from("doc_item_photos").select("id", { count: "exact", head: true }).eq("document_id", doc.id);
  let room = 4 - (count || 0);
  for (const name of files) {
    const path = `items/${f.name}/${name}`;
    const { data: ex } = await sb.from("doc_item_photos").select("id").eq("path", path).limit(1);
    if (ex?.length) { skipped++; continue; }
    if (room <= 0) { full++; continue; }
    const publicUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    console.log(`  ${CONFIRM ? "+" : "·"} ${code} → ${doc.wh_number}  ${name}`);
    if (CONFIRM) {
      const { error: e2 } = await sb.from("doc_item_photos").insert({ document_id: doc.id, path, url: publicUrl, created_by: doc.created_by });
      if (e2) throw new Error(`insert ${path}: ${e2.message}`);
    }
    linked++;
    room--;
  }
}
console.log(
  `${CONFIRM ? "✅ ผูกแล้ว" : "ตรวจแล้ว (ยังไม่เขียน) — จะผูก"} ${linked} รูป · ผูกไว้แล้ว ${skipped} · รหัสที่ไม่มีใบงาน ${noDoc} · เกิน 4 รูป ${full}` +
    (CONFIRM ? "" : "\nรันอีกครั้งพร้อม --confirm เพื่อผูกจริง")
);
