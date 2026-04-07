# COMETS GR — Setup Guide

ระบบตรวจรับสินค้าเข้าคลัง (Goods Receiving Web Application)

Built with **Next.js 14** + **TypeScript** + **Tailwind** + **Supabase** + **@react-pdf/renderer** + **Recharts**.

---

## 1. ติดตั้ง Dependencies

```bash
cd app
npm install
```

---

## 2. ตั้งค่า Supabase

1. ไปที่ <https://supabase.com> และสร้างโปรเจกต์ใหม่ (Free tier ใช้ได้)
2. ไปที่ **Settings → API** แล้วคัดลอก:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (เก็บเป็นความลับ — server-only)
3. คัดลอก `.env.local.example` เป็น `.env.local` แล้วใส่ค่า

```bash
cp .env.local.example .env.local
```

### 2.1 รัน SQL Migration

ไปที่ **SQL Editor** ใน Supabase Dashboard → New Query
- คัดลอกเนื้อหาทั้งหมดจาก `supabase/migrations/0001_init.sql`
- กด **Run**

จะได้ตารางต่อไปนี้:
- `profiles` (Roles: operator / qc / manager / admin_sap / admin)
- `gr_documents` (เอกสาร WH-)
- `weight_measurements` (Per Pcs / Per Inner / Per Carton)
- `count_grid_entries` (ใบตรวจนับ)
- `issue_reports` (รายงานปัญหา)
- `weight_photos` (รูปถ่ายแนบ)
- `audit_log` (Submit / Unlock log)
- ฟังก์ชัน `next_wh_number()` สำหรับ Auto-generate WH-YYMM-XXX
- RLS Policies ครบทุกตาราง

### 2.2 สร้าง Storage Buckets

ไปที่ **Storage → Create new bucket**
- ชื่อ: `gr-photos` — เลือก **Public bucket**
- ชื่อ: `sap-attachments` — เลือก **Public bucket**

(หรือใช้ SQL ที่ commented ไว้ท้ายไฟล์ migration)

### 2.3 สร้าง Admin User คนแรก

ที่ **Authentication → Users → Add user** สร้างผู้ใช้ด้วยอีเมล + รหัสผ่าน
จากนั้นที่ **SQL Editor** รัน:

```sql
update profiles set role = 'admin', full_name = 'System Admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL@example.com');
```

ผู้ใช้คนนี้จะสามารถสร้าง user คนอื่นๆ ในแอปได้จากหน้า `/users`

---

## 3. รันโปรเจกต์

```bash
npm run dev
```

เปิด <http://localhost:3000>

---

## 4. โครงสร้างเส้นทาง (Routes)

| Path | Role | คำอธิบาย |
|---|---|---|
| `/login` | public | เข้าสู่ระบบ |
| `/home` | operator/qc | รายการเอกสาร WH- |
| `/new` | operator | สร้างเอกสารใหม่ (auto WH-YYMM-XXX) |
| `/doc/[id]/header` | operator | ฟอร์มข้อมูล Header |
| `/doc/[id]/per-pcs` | operator | ชั่ง Per Pcs (Per 1 / Per 100) |
| `/doc/[id]/per-inner` | operator | ชั่ง Per Inner |
| `/doc/[id]/per-carton` | operator | ชั่ง Per Carton (ไม่จำกัดจำนวน) |
| `/doc/[id]/count` | operator | ใบตรวจนับ Grid |
| `/doc/[id]/issues` | operator | บันทึกปัญหา + รูปภาพ |
| `/doc/[id]/submit` | operator | ส่งงานเข้าคิว SAP |
| `/doc/[id]/pdf` | all | Preview + Download PDF |
| `/admin` | admin_sap | คิวเอกสารรอนำเข้า SAP |
| `/admin/[id]` | admin_sap | กรอกเลข CFSD + Unlock |
| `/admin/completed` | admin_sap | ประวัติงานที่เสร็จแล้ว |
| `/dashboard` | manager | KPI + กราฟ Lead Time |
| `/users` | admin | จัดการผู้ใช้ + Role |
| `/profile` | all | โปรไฟล์ + Logout |

---

## 5. User Stories ที่ครอบคลุม (27 / 27)

### Epic 1 — Running Number & Document
- ✅ US-101 Auto WH-YYMM-XXX (Postgres function)
- ✅ US-102 กรอก SAP ย้อนหลัง
- ✅ US-103 รายการเอกสารพร้อม Search + Tab filter

### Epic 1b — Status Workflow & Admin SAP
- ✅ US-104 ส่งงาน + Confirmation
- ✅ US-105 หน้ารวมงาน "รอนำเข้า SAP"
- ✅ US-106 ดูข้อมูลทั้งหมดเพื่อกรอก SAP + PDF
- ✅ US-107 กรอก CFSD กลับเข้าระบบ + แนบเอกสาร
- ✅ US-108 Unlock เพื่อแก้ไข + audit log

### Epic 2 — ใบชั่งน้ำหนัก
- ✅ US-201 Header (Scale, LOT, PO, Item, Dimensions, Gross/Net, MFG/EXP, QC, Remarks)
- ✅ US-202 Per Pcs (Per 1 / Per 100 toggle + auto Avg/Min/Max)
- ✅ US-202b Per Inner (qty per inner + Avg/Min/Max)
- ✅ US-202c Per Carton (ไม่จำกัด + outlier highlight + counter)
- ✅ US-203 ถ่ายรูปจากกล้องมือถือผ่าน Browser
- ✅ US-204 MFG/EXP/Lot Number + Validation
- ✅ US-205 QC toggle + หมายเหตุ
- ✅ US-206 รูปภาพ thumbnail + ลบได้
- ✅ US-207 บันทึกเวลาเริ่ม/สิ้นสุดอัตโนมัติ

### Epic 3 — ใบตรวจนับ
- ✅ US-301 Grid 10 คอลัมน์ (เพิ่มแถวได้)
- ✅ US-302 Avg/Min/Max real-time
- ✅ US-303 เปรียบเทียบยอด (สีเขียว/แดง)

### Epic 4 — บันทึกปัญหา
- ✅ US-401 ประเภทปัญหา + Defect Code + จำนวน
- ✅ US-402 รูปภาพแนบ

### Epic 5 — Dashboard / รายงาน
- ✅ US-501 Dashboard กราฟ Bar / Line + Filter
- ✅ US-502 Lead Time + KPI alert
- ✅ US-503 Export PDF ใบชั่งน้ำหนัก
- ✅ US-504 Export PDF ใบตรวจนับ

### Epic 6 — User / Permission
- ✅ US-601 จัดการ User + Role + Active toggle
- ✅ US-602 Login + Session

---

## 6. หมายเหตุ Open Items จาก PRD

| OI | สถานะ | หมายเหตุ |
|---|---|---|
| OI-02 Tech Stack | ✅ ใช้ Next.js + Supabase ตามที่ตกลง |
| OI-03 ERP Integration | 🟡 Mock อยู่ใน `src/lib/mock-erp.ts` — เปลี่ยนเป็น API จริงเมื่อพร้อม |
| OI-04 Defect Code List | 🟡 Mock 7 รหัสไว้ใน `mock-erp.ts` — แก้ไข/เพิ่มได้ |
| OI-05 KPI Lead Time | 🟡 ตั้งไว้ที่ 120 นาที ใน `src/app/dashboard/page.tsx` (`KPI_LEAD_TIME_MINUTES`) |
| OI-06 Role Permission | ✅ มี RLS + Middleware + Role redirect ครบ |

---

## 7. Mobile-friendly

- ทุกหน้าออกแบบ Mobile-first ตาม Stitch UI
- ช่อง Numeric input เรียก Numeric Keyboard อัตโนมัติ (`inputMode="decimal"`)
- ปุ่มถ่ายรูปใช้ `<input type="file" accept="image/*" capture="environment">` เปิดกล้องมือถือโดยตรง
- Bottom Navigation Bar + Sticky Top App Bar
- รองรับ iOS Safari / Android Chrome

---

## 8. การพัฒนาต่อ

- เพิ่ม Dark mode (`darkMode: 'class'` พร้อมใน tailwind.config.ts)
- เปลี่ยน Mock ERP เป็น API จริงใน `src/lib/mock-erp.ts`
- ปรับสีหรือ token ใน `tailwind.config.ts`
- รัน `supabase gen types typescript --project-id <id> > src/lib/database.types.ts` เพื่อเอา type จริงแทน stub
