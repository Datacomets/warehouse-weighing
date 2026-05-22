# Product Requirements Document (PRD)
## ระบบตรวจรับสินค้าเข้าคลัง (Goods Receiving Web Application)

---

| รายการ | รายละเอียด |
|---|---|
| **เลขที่เอกสาร** | DATA-REQ-2604001 |
| **วันที่ยื่น** | 04 เมษายน 2569 |
| **ประเภทระบบ** | Web Application |
| **แผนก / ฝ่าย** | คลังสินค้าและการขนส่ง |
| **Business Owner** | นายธนโชค ปาปะไน (ธุรการคลังสินค้า) |
| **Priority** | TBD |
| **เวอร์ชัน PRD** | 2.5 |
| **อัปเดตล่าสุด** | 21 พฤษภาคม 2569 |

---

## Changelog

### 21 พฤษภาคม 2569 (v2.5) — Date/Timezone, Export, Reopen, Audit Trail

**Localization & Display**
- **วันที่และเวลา** — บังคับใช้ปี ค.ศ. (Gregorian) + รูปแบบ 24-ชั่วโมง + GMT+7 (Asia/Bangkok) ใน `fmtDate` / `fmtDateTime` ทุกหน้า รวม PDF เพื่อให้แสดงผลตรงกันทุก runtime (Vercel UTC server / browser ที่ TZ ใดก็ตาม)
  - ก่อนหน้า: บางหน้าโชว์ `21/05/2569 02:45` (พ.ศ. + UTC) → ตอนนี้ `21/05/2026 09:45` (ค.ศ. + 24-hour + เวลาไทย)

**Reports & Export**
- **Export Report (CSV)** — ปุ่มลอย "Export Report" บน /users (admin), /admin (admin_sap), /dashboard (manager) — ดาวน์โหลดเอกสารทั้งหมด 55 columns ต่อแถว: WH no, status, LOT/PO/Item, summary stats (avg/min/max ต่อ kind), full_cartons, remainder, total_pcs, skip reasons, issue count, SAP info, ชื่อผู้สร้าง/ส่ง/ปิด, timestamps, lead_time_minutes — รองรับภาษาไทย (UTF-8 BOM) เปิดใน Excel ได้

**Workflow & Edit Access**
- **แก้ไขข้อมูลพื้นฐานจากแท็บ Header** — เดิม LOT/PO/Item Code/Description/Supplier/Delivery Date กรอกได้แค่ตอน `/new` เท่านั้น → ตอนนี้แก้ไขได้จากแท็บ "ข้อมูลหลัก" พร้อม auto-save on blur + Item Code lookup (สอดคล้องกับ /new)
- **Reopen completed document** — ปุ่ม "แก้ไขเอกสาร" บน `/admin/[id]` สำหรับเอกสาร `completed` (admin + admin_sap) → reset status เป็น `in_progress` + clear closed_at/closed_by/submitted_at/ended_at แต่ **เก็บ CFSD/sap_notification_id/sap_attachment_url ไว้** + บันทึก `audit_log` action=`reopen_completed` พร้อมเหตุผล

**Search**
- **PO number** — เพิ่ม `po_number` เข้าใน HOME_SEARCH_FIELDS → พิมพ์เลข PO (เช่น `5888`) แล้วเจอเอกสารทันที (เดิมรองรับเฉพาะ WH/LOT/Item/Description) — placeholder ใน search box อัปเดตเป็น "ค้นหา WH-, LOT, PO, Item Code, Description..."

**Visibility & Audit**
- **User attribution บน /admin/[id]** — Workflow card แสดงชื่อจริง: **สร้างโดย / ส่งโดย / ปิดโดย** + role พร้อม timestamp (เดิมแสดงแค่ "ส่งโดย: พนักงาน" generic)
- **Audit Timeline บน /admin/[id]** — แสดงประวัติทุก action (create_doc, edit_header, submit_work, complete_sap, unlock, reopen_completed, recall_submission) พร้อมชื่อคน + timestamp + เหตุผล/CFSD detail — label เป็นภาษาไทย ("สร้างเอกสาร", "เปิดเอกสารใหม่ (post-SAP)" ฯลฯ)

**UX**
- **Skip section reminder** — เพิ่มข้อความเตือนสีแดง "⚠ โปรดยืนยันการข้ามก่อนไปขั้นตอนถัดไป" ใต้ dropdown เลือกเหตุผล (Per Pcs/Inner/Carton) — ป้องกัน case ที่ user เลือกเหตุผลแล้ว navigate ออกโดยไม่กด "ยืนยันการข้าม" (ทำให้ skip ไม่ถูกบันทึก → submit ติด)

**Infrastructure (ไม่กระทบฟีเจอร์)**
- ย้าย Vercel project: `beamjoyjoy-5628s-projects/comets-gr` → `datacomets-projects/warehouse-weighing`
- URL Production: `https://warehouse-weighing.vercel.app` (URL เก่า `comets-gr.vercel.app` ยังเข้าได้แต่ค้างโค้ดเก่า)
- GitHub repo: `Datacomets/warehouse-weighing`

### 13 พฤษภาคม 2569 (v2.4)
- หน้า PDF ใบชั่งน้ำหนัก (ทั้งพรีวิวและไฟล์ดาวน์โหลด) — บรรทัด "Cartons ชั่งแล้ว" เปลี่ยนรูปแบบให้ตรงกับหน้า "ส่งงานเพื่อนำเข้า SAP" คือ `(qty/carton x ลังเต็ม) + เศษ N = รวม ชิ้น` (เดิมไม่มี qty/carton เห็นแค่จำนวนลัง) เพื่อให้สูตรการคำนวณยอดรวมสอดคล้องกันทุกหน้า

### 23 เมษายน 2569 (v2.3) — UX Wave 3
**ป้องกันข้อมูลหาย + ยกระดับประสบการณ์มือถือ**
- **Auto-save** หน้า "ข้อมูลหลัก" (Header) — ทุกช่อง save อัตโนมัติเมื่อ blur, มีไฟแสดงสถานะ "กำลังบันทึก / บันทึกแล้ว" + เตือนด้วย `beforeunload` ถ้ามีข้อมูลยังไม่ถูก save
- **Inline validation** — ช่อง MFG/EXP Date เช็คทันทีเมื่อ blur ว่า EXP ต้องไม่น้อยกว่า MFG (ไม่ต้องรอกด Next)
- **Character counter** บน textarea "หมายเหตุ" (max 500 ตัวอักษร)
- **ConfirmDialog** — แทนที่ `window.confirm()` 4 จุดด้วย Material-style modal: ลบค่าน้ำหนัก / ข้าม section ที่มีข้อมูล / ลบรายการปัญหา / ลบรหัสสินค้าใน Item master. Touch target ≥48px + ปุ่มอันตรายสีแดง
- **CountGrid cells** ขยายจาก 40px → 48px + ขยายฟอนต์เป็น text-base เพื่อให้ใส่ถุงมือแล้วยังแตะได้แม่นยำ
- **Submit checklist** เปลี่ยน ✓/✗ เป็น `check_circle` / `cancel` icons (เข้ากับ Material) + layout ชัดเจนขึ้น
- **Skip reason** — แยกแสดงเหตุผลแบบ free-form (italic + ป้าย "ระบุเอง") จาก preset options
- **StepNav** — step ที่ locked เปลี่ยนจาก `<Link>` เป็น `<span aria-disabled>` ไม่สามารถกดได้ (เดิมกดแล้วไปหน้า warning เปล่าๆ)
- **Remainder** — เมื่อบันทึก "ไม่มีเศษ" แล้ว แสดง badge พร้อมปุ่ม "แก้ไข" ชัดเจน (เดิมไม่มี affordance ให้ย้อนกลับไปกรอกเศษ)

### 22 เมษายน 2569 (v2.2)
- หน้า "ส่งงานเพื่อนำเข้า SAP" — เพิ่มบรรทัดสูตรการคำนวณยอดรวมในการ์ด "สรุปจำนวนรวม" รูปแบบ `(จำนวนต่อลัง x จำนวนลังเต็ม) + เศษ N = จำนวนชิ้น` เพื่อให้ผู้ใช้เห็นที่มาของตัวเลขรวมก่อนกดส่ง (สอดคล้องกับรูปแบบที่ใช้บนหน้านับเศษอยู่แล้ว)

### 22 เมษายน 2569 (v2.1)
- หน้า "นับเศษ" (Remainder): เพิ่มปุ่ม **"ไม่มีเศษ"** สำหรับกรณีที่ไม่มีสินค้าเศษเหลือ — กดแล้วบันทึก `remainder_pcs = 0` ทันที และขึ้น badge ยืนยัน
- หน้าสร้างเอกสารใหม่ (`/new`): **ซ่อนส่วน "ข้อมูล SAP (Optional)"** สำหรับ role `operator` — เลข SAP จะกรอกโดย admin_sap ในขั้น "บันทึกเลข SAP" เท่านั้น Role อื่น (admin, admin_sap, qc, manager) ยังเห็นตามเดิม
- ปุ่ม **"ไม่มีการชั่งน้ำหนักส่วนนี้"** บนแท็บชั่งทั้ง 3 แท็บ (Per Pcs / Per Inner / Per Carton) — ขยายครบทุกแท็บใน Wave 2b:
  - กดแล้วเลือกเหตุผลจาก dropdown (มี preset ต่างกันตามแท็บ + "อื่นๆ ระบุ" free-text)
  - แท็บที่ข้ามจะแสดง badge "ข้ามส่วนนี้" + เหตุผล และมีปุ่ม "ยกเลิกการข้าม"
  - StepNav ให้ checkmark แท็บที่ข้าม เหมือน step ที่ทำเสร็จ
  - Submit checklist นับแท็บที่ข้ามว่าผ่าน, ถ้าข้ามแท็บลัง → ข้ามการนับเศษอัตโนมัติ
  - เก็บ `skip_per_*` (bool) + `skip_reason_per_*` (text) ใน `gr_documents` สำหรับ audit
  - Migration: `0006_add_skip_sections.sql`

### 11 เมษายน 2569 (v2.0)
- เปลี่ยน "Item Supplier" → "ชื่อสินค้าฝั่ง Supplier" (ชื่อที่ Supplier ใช้เรียกสินค้า ไม่ใช่ชื่อบริษัท Supplier)
- ลบ toggle "Per 1 Pcs / Per 100 Pcs" ออก — ชั่งทีละชิ้นเสมอ
- เพิ่มเมนู Hamburger (☰) → หน้าหลัก, คู่มือ, โปรไฟล์, ออกจากระบบ
- เพิ่มหน้าคู่มือการใช้งาน (/guide)

### 10 เมษายน 2569 (v1.9)
- UX: เพิ่มปุ่ม "ก่อนหน้า" ทุก step ในขั้นตอนชั่งน้ำหนัก
- UX: เพิ่ม confirm dialog ก่อนลบค่าน้ำหนักและรายการปัญหา
- UX: เพิ่ม success toast หลังส่งงาน, บันทึกเศษ, นำเข้า SAP
- UX: StepNav แสดง checkmark สีเขียวสำหรับ step ที่ทำแล้ว
- UX: แปล StepNav เป็นไทยทั้งหมด (ข้อมูลหลัก → ชั่งต่อชิ้น → ชั่งต่อถุง/ถาด → ชั่งต่อลัง → นับเศษ → ปัญหา → ส่งงาน)
- UX: CountGrid เปลี่ยนเป็น flex-wrap ไม่ต้อง scroll แนวนอนบนมือถือ ขยาย touch target
- หน้า Admin doc: แสดงค่าน้ำหนักทุกรายการ + กรอบแดง outlier + ลิสต์ปัญหา + grid ตาราง Per Carton แบบมีเลขลัง

### 09 เมษายน 2569 (v1.8)
- เพิ่มหน่วยวัด: เลือกได้ Kg / g / ชิ้น ต่อเอกสาร
- เพิ่ม step "นับเศษ" (Remainder) หลัง Per Carton — กรอกจำนวนชิ้นที่ไม่ครบลัง พร้อมสรุป (ลังเต็ม × ชิ้น/ลัง) + เศษ = รวมชิ้น
- ลบคอลัมน์ "จำนวนที่นับได้จริง (ลัง)" ออกจาก Header — ใช้จำนวนจาก Per Carton grid + remainder แทน
- เปลี่ยน "Per Inner" → "Per Inner/Tray/Bag" ทุกที่
- Outlier detection (กรอบแดง) ในทุกหน้าชั่งน้ำหนัก (Per Pcs, Per Inner, Per Carton grid)
- CountGrid แสดงเลขลังต่อเนื่อง (1, 2, 3... 11, 12...) ด้านบนแต่ละช่อง
- QA fixes: null checks (notFound), Per Pcs showPer100Toggle, submit checklist เพิ่มนับเศษ, PDF แสดง remainder + weight_unit, RemainderForm validate จำนวนเต็ม

### 08 เมษายน 2569 (v1.7)
- หน้า Admin SAP: แบ่งแท็บ รอ SAP / กำลังนับ / เสร็จวันนี้ / ทั้งหมด พร้อมสรุปตัวเลข
- หน้า /team: ภาพรวมทีมพนักงาน (operator) — จำนวนงาน กำลังทำ / ค้าง SAP / เสร็จวันนี้
- หน้า /team/[userId]: drill-down รายคน — แท็บ กำลังทำ / ค้าง SAP / เสร็จแล้ว / ทั้งหมด
- หน้า /home: operator เห็นเฉพาะงานของตัวเอง (filter created_by)
- BottomNav: เพิ่มเมนู "ทีม" สำหรับ qc / manager / admin
- QA fixes 22 จุด: RLS restrict operator, file upload validation, password validation, timezone GMT+7, error logging, audit log (create_doc, edit_header), loading.tsx, search escape wildcards, validation ค่าลบ/overflow, PDF error fallback, ลบหน้า /admin/completed ที่ซ้ำ

---

## 1. ภาพรวมโครงการ (Project Overview)

ระบบตรวจรับสินค้าเข้าคลังเป็น Web Application สำหรับพนักงานระดับปฏิบัติการในแผนกคลังสินค้า เพื่อทดแทนกระบวนการบันทึกข้อมูลด้วยกระดาษและ Excel ให้เป็นระบบดิจิทัลแบบ Real-time โดยดึงข้อมูลบางส่วนจากระบบ ERP ที่มีอยู่ รองรับการใช้งานผ่านโทรศัพท์มือถือ และสนับสนุนนโยบาย Paperless ขององค์กร

---

## 2. ปัญหาและแรงจูงใจ (Problem Statement)

กระบวนการรับสินค้าปัจจุบันประกอบด้วย 2 ขั้นตอนที่ทำแยกกัน:
1. พนักงานบันทึกข้อมูลลงกระดาษ (ใบชั่งน้ำหนัก + ใบตรวจนับ) หน้างาน
2. นำข้อมูลไปคีย์ซ้ำใน Excel (Double Work)

ปัญหาที่เกิดขึ้น:
- ข้อมูลผิดพลาดจากการกรอกด้วยมือหลายรอบ
- ไม่สามารถตรวจสอบยอดสินค้าแบบ Real-time ได้
- ไม่มีระบบติดตาม Lead Time การรับสินค้า
- ไม่สามารถบันทึกภาพหลักฐานปัญหาหน้างานได้โดยตรง
- ต้นทุนแฝงจากค่ากระดาษ หมึกพิมพ์ และพื้นที่จัดเก็บเอกสาร

---

## 3. วัตถุประสงค์ (Objectives)

1. รับข้อมูลหลักจาก ERP (Supplier Delivery Overview / Packing List) มาแสดงอัตโนมัติ ลดการกรอกซ้ำ
2. บันทึกน้ำหนักและขนาดสินค้าแบบ Digital พร้อมคำนวณค่าสถิติ (Max/Min) อัตโนมัติ
3. ครอบคลุมข้อมูลสำคัญของสินค้า เช่น MFG, EXP, Lot Number
4. ตรวจสอบยอดสินค้าจริงเทียบกับข้อมูลในระบบ (ขาด/เกิน)
5. วัดประสิทธิภาพทีมงานผ่านการคำนวณ Lead Time ของกระบวนการรับสินค้า
6. บันทึกปัญหาหน้างานพร้อมแนบรูปภาพและรหัสของเสียได้ทันที
7. รองรับการใช้งานบนโทรศัพท์มือถือ (Mobile-friendly)
8. ส่งออกรายงานเป็น PDF ทดแทนเอกสารกระดาษ

---

## 4. กลุ่มผู้ใช้งาน (Target Users)

| Persona | บทบาท | การใช้งานหลัก |
|---|---|---|
| **พนักงานปฏิบัติการ** | ผู้ชั่งน้ำหนัก / ผู้ตรวจนับ | สร้างเอกสาร WH-, กรอกข้อมูลชั่งน้ำหนัก, นับเศษ, ส่งงาน |
| **Admin / เจ้าหน้าที่ SAP** | ผู้นำข้อมูลเข้า SAP | รับงานที่พนักงานส่งมา, ตรวจสอบค่าน้ำหนักทุกรายการ, นำข้อมูลเข้า SAP, กรอกเลข SAP กลับเข้าระบบ |
| **QC / หัวหน้างาน** | ผู้ตรวจสอบ | ดูภาพรวมทีมพนักงาน, ตรวจสอบค่าน้ำหนัก (ค่าผิดปกติขึ้นกรอบแดง), ดูรายงานปัญหา |
| **ผู้จัดการคลัง** | ผู้ติดตาม KPI | ดู Dashboard, ติดตาม Lead Time, ดูภาพรวมทีม |

---

## 5. กระบวนการทำงาน (Workflow)

### ขั้นตอนการทำงานของระบบ

```
[พนักงานปฏิบัติการ]
ของเข้า → เปิด Web App → ระบบรัน WH-YYMM-XXX
→ กรอก Header → ชั่งต่อชิ้น → ชั่งต่อถุง/ถาด → ชั่งต่อลัง → นับเศษ → รายงานปัญหา
→ กด "ส่งงาน" → Status เปลี่ยนเป็น "รอนำเข้า SAP"

[Admin / เจ้าหน้าที่ SAP]
→ เห็นเอกสาร WH- Status "รอนำเข้า SAP"
→ ตรวจสอบค่าน้ำหนักทุกรายการ (กรอบแดงที่ค่าผิดปกติ) + ดูรายงานปัญหา
→ นำข้อมูลเข้า SAP → SAP ออกเลข CFSD
→ Admin กรอกเลข CFSD กลับเข้าระบบ → Status เปลี่ยนเป็น "เสร็จสมบูรณ์"
```

---

## 5b. Status Workflow ของเอกสาร WH-

```
[กำลังดำเนินการ] ──ส่งงาน──► [รอนำเข้า SAP] ──นำเข้า SAP──► [เสร็จสมบูรณ์]
       ▲                          │                              │
       │                          │                              │
       │           ปลดล็อก (admin) │       แก้ไขเอกสาร (admin/admin_sap)
       └──────────────────────────┘                              │
       │                                                         │
       └─────────────────────────────────────────────────────────┘
                   (reset เป็น in_progress; CFSD ถูกเก็บไว้)
```

| Status | สีที่แสดง | ความหมาย | ใครเปลี่ยน |
|---|---|---|---|
| 🟡 **กำลังดำเนินการ** | เหลือง / Orange | พนักงานเปิดเอกสารและกำลังกรอกข้อมูล | Auto (เมื่อสร้างเอกสาร) |
| 🔵 **รอนำเข้า SAP** | น้ำเงิน | พนักงานกรอกครบและกด "ส่งงาน" แล้ว | พนักงานปฏิบัติการ |
| 🟢 **เสร็จสมบูรณ์** | เขียว | Admin นำข้อมูลเข้า SAP เรียบร้อย และกรอกเลข CFSD กลับเข้าระบบแล้ว | Admin / เจ้าหน้าที่ SAP |

### Business Rules ของ Status

- พนักงานกด "ส่งงาน" ได้เฉพาะเมื่อกรอกข้อมูล **ชั่งต่อชิ้น, ชั่งต่อถุง/ถาด, ชั่งต่อลัง และ นับเศษ** ครบแล้ว (หรือกดข้ามแท็บนั้นพร้อมเหตุผล)
- เมื่อ Status เป็น "รอนำเข้า SAP" พนักงานปฏิบัติการ **ไม่สามารถแก้ไข** ข้อมูลชั่งน้ำหนักได้ (ต้องให้ Admin **ปลดล็อก** ถ้าจำเป็น — กลับเป็น in_progress, audit_log action=`unlock`)
- เมื่อ Status เป็น "เสร็จสมบูรณ์" — Admin/Admin SAP สามารถกด **"แก้ไขเอกสาร"** เพื่อแก้ไขข้อมูลภายหลัง → reset status เป็น in_progress แต่ **เก็บเลข CFSD/notification/attachment ไว้** (audit_log action=`reopen_completed`)
- Admin กรอกเลข CFSD (Inbound Delivery ID จาก SAP) พร้อมแนบเอกสารจาก SAP ได้ (Optional)
- เมื่อเปลี่ยนเป็น "เสร็จสมบูรณ์" ระบบบันทึก Timestamp และชื่อ Admin ที่ดำเนินการ
- ทุก action สำคัญถูกบันทึกใน `audit_log` พร้อม actor id + timestamp + detail (เหตุผล/CFSD)

---

### 6.1 การสร้างเอกสารใหม่และ Running Number

เมื่อพนักงานเปิดรายการรับสินค้าใหม่ **ระบบต้องรันเลขเอกสารทันที** ก่อนที่ SAP จะออกเลขรับเข้า

#### Running Number Format

```
WH - YYMM - XXX

ตัวอย่าง:
  WH-2504-001   (เอกสารแรกของเดือนเมษายน 2568)
  WH-2504-002   (เอกสารที่ 2 ของเดือนเดียวกัน)
  WH-2505-001   (เดือนถัดไป XXX รีเซ็ตเป็น 001)
```

#### ข้อมูลที่กรอกในขั้นตอนนี้

| Field | ที่มา | หมายเหตุ |
|---|---|---|
| **เลขเอกสาร (WH-)** | **Auto-generate** | แสดงทันที ห้ามแก้ไข |
| LOT | กรอกเอง | |
| PO Number | กรอกเอง | อ้างอิงจาก Packing List |
| Item Code (SAP) | กรอกเอง | ดึง Description จาก Item Master อัตโนมัติ |
| Description | กรอกเอง / Auto-fill | จาก Item Master |
| ชื่อสินค้าฝั่ง Supplier | กรอกเอง | ชื่อที่ Supplier ใช้เรียกสินค้านี้ |
| Delivery Date | กรอกเอง | วันที่สินค้าเข้าจริง |

---

### 6.2 ใบชั่งน้ำหนักสินค้า (Weight Recording Form)

#### ขั้นตอนที่ 1 — ข้อมูลหลัก (Header)

| Field | ที่มา | ตัวอย่าง |
|---|---|---|
| ชื่อเครื่องชั่ง (Scale Name) | กรอกเอง | เช่น WH-02 |
| จำนวนชิ้น/ลัง (Qty per Carton) | กรอกเอง | 360 ชิ้น |
| หน่วยวัด | เลือก: **Kg** / **g** / **ชิ้น** | ใช้ทั้งเอกสาร |
| กว้าง × ยาว × สูง (ซม.) | กรอกเอง | 31 × 40 × 27.5 |
| Gross Weight | กรอกเอง | 14.750 |
| Net Weight | กรอกเอง | 14.400 |
| วันที่ผลิต (MFG) | กรอกเอง | ปี 2000-2100 |
| วันหมดอายุ (EXP) | กรอกเอง | ≥ MFG, ปี 2000-2100 |
| Lot Number | กรอกเอง | |
| QC Status | เลือก | QC เบิก / QC ไม่เบิก |
| หมายเหตุ | กรอกเอง | |

> **หมายเหตุ:** ลบ "จำนวนที่นับได้จริง (ลัง)" ออกแล้ว — ใช้จำนวนจาก Per Carton grid + นับเศษ แทน

---

#### ขั้นตอนที่ 2 — ชั่งต่อชิ้น (Per Pcs)

| Field | รายละเอียด |
|---|---|
| น้ำหนักแต่ละครั้ง | กรอกได้หลายค่า (ไม่จำกัดจำนวนครั้ง) ชั่งทีละชิ้นเสมอ |
| Average / MIN / MAX | คำนวณอัตโนมัติ |
| ค่าผิดปกติ | แสดงกรอบแดง (outlier detection) |
| รูปภาพ | ถ่ายรูปประกอบได้ (JPEG/PNG/WEBP, สูงสุด 10 MB) |

> **หมายเหตุ:** ไม่มี toggle Per 100 Pcs — ชั่งทีละชิ้นเสมอ

---

#### ขั้นตอนที่ 3 — ชั่งต่อถุง/ถาด (Per Inner / Tray / Bag)

| Field | รายละเอียด |
|---|---|
| จำนวนชิ้น/Inner (Qty per Inner) | กรอกเอง เช่น 10 ชิ้น |
| น้ำหนักแต่ละครั้ง | กรอกได้หลายค่า (ไม่จำกัดจำนวนครั้ง) |
| Average / MIN / MAX | คำนวณอัตโนมัติ |
| ค่าผิดปกติ | แสดงกรอบแดง (outlier detection) |
| รูปภาพ | ถ่ายรูปประกอบได้ |

---

#### ขั้นตอนที่ 4 — ชั่งต่อลัง (Per Carton)

| Field | รายละเอียด |
|---|---|
| น้ำหนักแต่ละลัง | กรอกในตาราง flex-wrap (ขยายได้ ไม่ต้อง scroll แนวนอน) |
| เลขลัง | แสดงลำดับต่อเนื่อง (1, 2, 3... 11, 12...) ด้านบนแต่ละช่อง |
| Average / MIN / MAX | คำนวณอัตโนมัติ |
| ค่าผิดปกติ | แสดงกรอบแดง (outlier detection) |

---

#### ขั้นตอนที่ 5 — นับเศษ (Remainder)

| Field | รายละเอียด |
|---|---|
| จำนวนเศษ (ชิ้น) | กรอกจำนวนชิ้นที่ไม่ครบลัง ถ้าไม่มีเศษให้เว้นว่าง (ต้องเป็นจำนวนเต็ม) |
| สรุปจำนวน | คำนวณอัตโนมัติ: (ชิ้น/ลัง × ลังเต็ม) + เศษ = รวมชิ้น |

---

### 6.3 การบันทึกปัญหา (Issue Reporting) — ขั้นตอนที่ 6

| FR | รายการ | รายละเอียด |
|---|---|---|
| FR-01 | ประเภทปัญหา | สินค้าขาดหาย / ชำรุด / ข้อมูลหน้ากล่องไม่ตรง / อื่นๆ |
| FR-02 | รหัสของเสีย (Defect Code) | เลือกจาก Dropdown หรือกรอกเอง |
| FR-03 | แนบรูปภาพ | เปิดกล้องถ่ายรูปปัญหาแนบทันที (JPEG/PNG/WEBP, สูงสุด 10 MB) |
| FR-04 | ระบุจำนวนที่มีปัญหา | กรอกจำนวนสินค้าที่มีปัญหา |
| FR-05 | ยืนยันก่อนลบ | แสดง confirm dialog ก่อนลบรายการปัญหา |

---

### 6.4 ส่งงาน (Submit) — ขั้นตอนที่ 7

| รายการ | รายละเอียด |
|---|---|
| Checklist | ต้องทำครบ: ชั่งต่อชิ้น ✓, ชั่งต่อถุง/ถาด ✓, ชั่งต่อลัง ✓, นับเศษ ✓ |
| สรุปจำนวนรวม | แสดง: ลังเต็ม / ชิ้นเศษ / ชิ้นรวม |
| ยืนยันการส่ง | 2 ขั้นตอน — กดส่ง → แสดงยืนยัน → กดยืนยัน |
| Success Feedback | แสดง toast "ส่งงานสำเร็จ!" ก่อน redirect กลับหน้าหลัก |

---

### 6.5 หน้า Admin / QC — ตรวจสอบเอกสาร

Admin และ QC สามารถดูข้อมูลเอกสารแบบสรุปใน 1 หน้า:

| ส่วน | รายละเอียด |
|---|---|
| ข้อมูลเอกสาร | PO, Item Code, Description, ชื่อสินค้าฝั่ง Supplier, วันส่ง, หน่วยวัด |
| สรุปจำนวน | ลังเต็ม / ชิ้นเศษ / ชิ้นรวม พร้อมสูตรคำนวณ |
| ชั่งต่อชิ้น | ค่าทุกรายการ + AVG/MIN/MAX + กรอบแดง outlier |
| ชั่งต่อถุง/ถาด | ค่าทุกรายการ + AVG/MIN/MAX + กรอบแดง outlier |
| ชั่งต่อลัง | ตาราง grid มีเลขลัง + กรอบแดง outlier |
| ปัญหา | ลิสต์ปัญหาทั้งหมดพร้อมรูปภาพ |
| SAP Entry | กรอกเลข CFSD + แนบเอกสาร (PDF/รูป, สูงสุด 20 MB) |
| Workflow | แสดง **สร้างโดย / ส่งโดย / ปิดโดย** (ชื่อจริง + role) + timestamp + Lead Time + เหตุผลปลดล็อกล่าสุด |
| Audit Timeline | ประวัติทุก action (create_doc / edit_header / submit_work / complete_sap / unlock / reopen_completed / recall_submission) พร้อม actor + timestamp + detail (เหตุผล, CFSD) |
| ปุ่ม Action | Export PDF · ปลดล็อก (pending_sap) · แก้ไขเอกสาร (completed → reopen, admin + admin_sap เท่านั้น) |

---

### 6.6 หน้าทีมพนักงาน (/team)

| รายการ | รายละเอียด |
|---|---|
| สิทธิ์เข้าถึง | QC, Manager, Admin |
| ภาพรวม | จำนวนงาน: กำลังทำ / ค้าง SAP / เสร็จวันนี้ |
| รายคน | ลิสต์ operator แต่ละคน พร้อมตัวเลข → กดเข้าดูงานรายคน |
| Drill-down | หน้ารายคน: แท็บ กำลังทำ / ค้าง SAP / เสร็จแล้ว / ทั้งหมด |

---

### 6.7 Dashboard และรายงาน

| FR | รายการ | รายละเอียด |
|---|---|---|
| FR-05 | Dashboard Real-time | แสดงยอดสรุปน้ำหนักรวม แยกตามชื่อสินค้าฝั่ง Supplier ในรูปแบบกราฟ |
| FR-06 | ติดตาม Lead Time | แสดง Lead Time เฉลี่ย และเปรียบเทียบกับ KPI ที่กำหนด |
| FR-07 | ส่งออก PDF — ใบชั่งน้ำหนัก | แสดง remainder, หน่วยวัด, ชื่อสินค้าฝั่ง Supplier, วันที่ ค.ศ. + 24-hour + GMT+7 |
| FR-08 | ส่งออก PDF — ใบตรวจนับ | แสดง Grid ค่าน้ำหนักรายลัง พร้อมเลขลัง |
| FR-08a | Export Report (CSV) | ปุ่มลอย /users (admin), /admin (admin_sap), /dashboard (manager) → ดาวน์โหลด CSV ทุกเอกสาร 55 columns (WH/status/LOT/PO/Item/summary stats/skip reasons/issue count/SAP/ชื่อผู้ทำ/timestamps/lead time) — UTF-8 BOM เปิดใน Excel ได้ |

---

### 6.8 การใช้งานบนมือถือ

| FR | รายการ | รายละเอียด |
|---|---|---|
| FR-09 | Responsive Web Design | รองรับ iOS และ Android ผ่าน Browser ไม่ต้องติดตั้ง App |
| FR-10 | Camera Access | เรียกกล้องมือถือเพื่อถ่ายรูปสินค้าหรือหน้าปัดเครื่องชั่งได้โดยตรง |
| FR-11 | Numeric Keyboard | ช่องกรอกน้ำหนักต้องเรียก Numeric Keyboard ของมือถือโดยอัตโนมัติ |
| FR-12 | CountGrid Responsive | ตาราง Per Carton ใช้ flex-wrap ไม่ต้อง scroll แนวนอน |
| FR-13 | Hamburger Menu | เมนูด้านซ้าย: หน้าหลัก, คู่มือ, โปรไฟล์, ออกจากระบบ |

---

### 6.9 UX Requirements

| รายการ | รายละเอียด |
|---|---|
| ปุ่มย้อนกลับ | ทุก step มีปุ่ม "ก่อนหน้า" + "ถัดไป" |
| Progress Indicator | StepNav แสดง checkmark สีเขียวสำหรับ step ที่ทำแล้ว |
| Confirm ก่อนลบ | ลบค่าน้ำหนัก / ลบรายการปัญหา ต้องยืนยันก่อน |
| Success Toast | ส่งงาน, บันทึกเศษ, นำเข้า SAP → แสดง toast สำเร็จ |
| ภาษาไทย | StepNav ทั้งหมดเป็นภาษาไทย |
| Outlier Detection | ค่าน้ำหนักที่ผิดปกติแสดงกรอบแดง (ทุกหน้าชั่ง + หน้า Admin) |

---

## 7. ความต้องการที่ไม่ใช่ฟังก์ชัน (Non-Functional Requirements)

| # | หมวด | รายละเอียด |
|---|---|---|
| NFR-01 | Performance | หน้าจอโหลดภายใน 3 วินาที + global loading spinner |
| NFR-02 | Availability | ระบบพร้อมใช้งาน ≥ 99% ในชั่วโมงทำการ |
| NFR-03 | Security | Login + Role-based access + RLS (operator เห็นเฉพาะงานตัวเอง) |
| NFR-04 | Data Integrity | ข้อมูลไม่สูญหาย ตรวจสอบย้อนหลังได้ (audit_log) |
| NFR-05 | Mobile Support | iOS / Android ผ่าน Browser |
| NFR-06 | File Upload | รูปภาพ: JPEG/PNG/WEBP สูงสุด 10 MB, เอกสาร SAP: +PDF สูงสุด 20 MB |
| NFR-07 | Validation | ค่าลบ, overflow, email format, password min 6 chars, MFG/EXP ปี 2000-2100 |
| NFR-08 | Timezone | คำนวณ "วันนี้" ด้วย GMT+7 (เวลาไทย) — `fmtDate`/`fmtDateTime` บังคับ `timeZone: "Asia/Bangkok"` + `hour12: false` + ปฏิทิน Gregorian (ค.ศ.) เพื่อให้แสดงผลตรงกันบน Vercel UTC server, browser TZ ใดๆ |
| NFR-09 | Logging | Structured JSON logger สำหรับทุก server page + audit_log สำหรับ actions สำคัญ |

---

## 8. ความสัมพันธ์กับระบบ SAP (System Sequence & Integration)

> ระบบนี้ทำงาน **ก่อน SAP** เสมอ

```
[ระบบนี้]   พนักงาน → สร้าง WH-YYMM-XXX → ชั่งน้ำหนัก → นับเศษ → ส่งงาน
                                                                        ↓
[Admin]     รับงาน "รอนำเข้า SAP" → ตรวจค่าน้ำหนัก (กรอบแดง) → เปิด SAP → กรอกข้อมูล
                                                                        ↓
[SAP]       ออกเลข Inbound Delivery (CFSD-XXXX) + เอกสาร SAP
                                                                        ↓
[Admin]     กลับมากรอกเลข CFSD ในระบบนี้ → toast "นำเข้า SAP สำเร็จ!" → Status = "เสร็จสมบูรณ์"
```

---

## 9. เงื่อนไขความสำเร็จ (Success Metrics)

| ตัวชี้วัด | เป้าหมาย |
|---|---|
| ลด Double Work | พนักงานคีย์ข้อมูลเพียงครั้งเดียว (Key Once) |
| ความถูกต้องของข้อมูล | ลดข้อผิดพลาดจากการบันทึกด้วยมือ + outlier detection อัตโนมัติ |
| Lead Time Visibility | ดู Lead Time การรับสินค้าได้ Real-time |
| Paperless | ลดการใช้กระดาษในกระบวนการรับสินค้า |
| รายงาน PDF | ออกรายงานได้ทันทีโดยไม่ต้องพิมพ์ซ้ำ |
| ดูภาพรวมทีม | หัวหน้างานเห็นงานพนักงานทุกคนแบบ Real-time |

---

## 10. Tech Stack (Resolved)

| รายการ | เลือกใช้ |
|---|---|
| Framework | Next.js (App Router) |
| Database | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Hosting | Vercel |
| Styling | Tailwind CSS (Material Design 3 tokens) |
| PDF | @react-pdf/renderer |
| Charts | Recharts |

---

## 11. การอนุมัติ (Approvals)

| บทบาท | ชื่อ | วันที่อนุมัติ | สถานะ |
|---|---|---|---|
| ผู้จัดทำโครงการ | นายธนโชค ปาปะไน | — | รอลงนาม |
| ผู้จัดการแผนก | — | — | รอลงนาม |
| ผู้บริหาร / ผู้อนุมัติ | — | — | รอลงนาม |

---

*เอกสารนี้จัดทำจากแบบฟอร์ม DATA-REQ-2604001 — ปรับปรุงล่าสุด 11 เมษายน 2569 (v2.0)*
