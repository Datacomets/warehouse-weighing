# User Stories
## ระบบตรวจรับสินค้าเข้าคลัง (Goods Receiving Web Application)

---

| รายการ | รายละเอียด |
|---|---|
| **อ้างอิง PRD** | DATA-REQ-2604001 v2.6 |
| **เวอร์ชัน** | 1.6 |
| **วันที่** | 26 พฤษภาคม 2569 |

---

## Changelog

### 26 พฤษภาคม 2569 (v1.6) — Admin/Manager Direct Edit on Completed

- **แก้ US-109 ใหม่หมด** — เปลี่ยนจาก "Reopen completed (reset status)" → "Edit completed in place (no status change)"
  - เพิ่มสิทธิ์ **Manager** (เดิม admin + admin_sap)
  - ปุ่ม "แก้ไขเอกสาร" → "**แก้ไขข้อมูล (status ไม่เปลี่ยน)**" บน `/admin/[id]`
  - คลิกแล้ว Link ตรงไป `/doc/[id]/header` (ไม่เปลี่ยน status, ไม่เคลียร์ closed_at / closed_by / submitted_at)
  - เอกสารไม่กลับไปแสดงในงานของ operator
  - Banner สีส้มเตือนบนหน้า `/doc/[id]/*` ขณะแก้ doc ที่ completed
  - audit_log ใช้ action เดิม `edit_header` (เลิกใช้ `reopen_completed`)
- **คง 33 stories** (แก้ US-109 ไม่เพิ่ม)
- อ้างอิง PRD v2.6

### 21 พฤษภาคม 2569 (v1.5) — Date/Timezone, Export, Reopen, Audit Trail

- **เพิ่ม US-109** — Admin reopen completed document (reset เป็น in_progress, เก็บ CFSD ไว้, audit_log action=reopen_completed)
- **เพิ่ม US-111** — Admin / Admin SAP / Manager export ข้อมูลทุกเอกสารเป็น CSV (UTF-8 BOM เปิดใน Excel ภาษาไทยได้)
- **เพิ่ม US-505** — Audit timeline + user attribution บนหน้า admin doc detail
- **ขยาย US-103** — Search รวม `po_number` (เดิมเฉพาะ WH/LOT/Item/Description)
- **ปรับ US-201** — แก้ไขข้อมูลพื้นฐาน (LOT/PO/Item Code/Description/Supplier/Delivery Date) จากแท็บ Header ได้ (เดิมแก้ได้แค่ตอน /new)
- **ปรับ US-209** — เพิ่มข้อความเตือนสีแดง "โปรดยืนยันการข้ามก่อนไปขั้นตอนถัดไป" ใต้ dropdown เลือกเหตุผล
- **ปรับ US-503/504** — PDF แสดงวันที่ ค.ศ. (Gregorian) + 24-hour + GMT+7 (Asia/Bangkok)
- อ้างอิง PRD v2.5
- **รวม 33 stories** (เพิ่ม 3 จาก v1.4)

### 13 พฤษภาคม 2569 (v1.4)
- ปรับ **US-104** — สูตรการคำนวณยอดรวมบน PDF ใบชั่งน้ำหนัก (พรีวิว + ไฟล์) ใช้รูปแบบเดียวกับหน้า "ส่งงาน": `(qty/carton x ลังเต็ม) + เศษ N = รวม ชิ้น` (เดิมแสดงแค่ `ลังเต็ม + เศษ = รวม` ขาด qty/carton)

### 23 เมษายน 2569 (v1.3) — UX Wave 3 (audit + cleanup)
- ปรับ **US-102** — หน้า Header ใช้ auto-save on blur + beforeunload warning (ป้องกันข้อมูลหายเมื่อ refresh/back)
- ปรับ **US-102** — ช่อง MFG/EXP Date validate แบบ inline on blur (ไม่ต้องรอกด Next)
- ปรับ **US-104** — Checklist ก่อนส่งใช้ Material icon (`check_circle`/`cancel`) แทน ASCII
- ปรับ **US-208** — หลังกด "ไม่มีเศษ" แล้ว badge แสดงปุ่ม "แก้ไข" ให้ย้อนกลับได้
- ปรับ **US-209** — Skip reason ที่ operator พิมพ์เอง (free-form) แสดง italic + ป้าย "ระบุเอง" เพื่อให้ admin แยกออกจาก preset
- **UX Foundation** — เพิ่ม `ConfirmDialog` component (Material modal, 48px touch targets, destructive red) แทน `window.confirm()` ทั้งระบบ
- **UX Foundation** — CountGrid cells ขยาย 40px → 48px ตาม Material touch-target guideline

### 22 เมษายน 2569 (v1.2)
- ปรับ **US-104** — หน้า "ส่งงาน" แสดงสูตรการคำนวณยอดรวม `(qty/carton x ลังเต็ม) + เศษ = รวม` เป็นบรรทัดสุดท้ายของการ์ดสรุปจำนวนรวม เพื่อให้ผู้ใช้ตรวจทานที่มาของตัวเลขได้ชัดเจนก่อนส่งเข้า SAP

### 22 เมษายน 2569 (v1.1)
- เพิ่ม **US-208** — ปุ่ม "ไม่มีเศษ" บนหน้านับเศษ
- เพิ่ม **US-209** — ปุ่ม "ไม่มีการชั่งน้ำหนักส่วนนี้" พร้อม dropdown เหตุผล บนแท็บชั่ง 3 แท็บ (WIP)
- เพิ่ม **US-110** — ซ่อนช่อง SAP ไม่ให้ operator กรอกตอนสร้างเอกสาร
- ปรับ **US-104** — "ส่งงาน" นับแท็บที่ถูก mark ว่าข้ามว่าครบด้วย (ไม่บังคับต้องมีค่าชั่ง)

---

## Personas

| Persona | บทบาท | การใช้งานหลัก |
|---|---|---|
| **พนักงาน** | พนักงานปฏิบัติการคลังสินค้า (ผู้ชั่ง / ผู้ตรวจนับ) | บันทึกข้อมูลหน้างานผ่านมือถือ |
| **QC / หัวหน้างาน** | ผู้ตรวจสอบและยืนยันข้อมูล | ตรวจสอบความถูกต้อง อนุมัติ |
| **ผู้จัดการ** | ผู้จัดการคลังสินค้า | ดู Dashboard ติดตาม KPI |

---

## Epic 1 — การเปิดรายการรับสินค้า (GR Session)

### US-101
> **As a** พนักงาน  
> **I want to** กดสร้างเอกสารใหม่แล้วได้รับเลขเอกสาร WH-YYMM-XXX ทันทีโดยอัตโนมัติ  
> **So that** มีเลขกำกับเอกสารก่อนเริ่มกระบวนการชั่งน้ำหนัก โดยไม่ต้องรอเลขจาก SAP

**Acceptance Criteria:**
- [ ] ปุ่ม "สร้างเอกสารใหม่" อยู่บน Home Screen
- [ ] เมื่อกดปุ่ม ระบบ Auto-generate เลข WH-YYMM-XXX ทันที (เช่น WH-2504-001)
- [ ] เลข WH- แสดงเด่นชัดที่ด้านบนของฟอร์ม และ **ห้ามแก้ไขได้**
- [ ] ลำดับ XXX รีเซ็ตเป็น 001 ทุกต้นเดือน
- [ ] เลขที่สร้างแล้วไม่ซ้ำกัน แม้จะสร้างพร้อมกันหลายเครื่อง

---

### US-102
> **As a** พนักงาน  
> **I want to** กรอกเลขรับเข้า SAP (เช่น CFSD / Inbound Delivery No.) ย้อนหลังได้หลังจาก SAP ออกเลข  
> **So that** เอกสาร WH- สามารถเชื่อมโยงกับระบบ SAP ได้ในภายหลัง

**Acceptance Criteria:**
- [ ] ฟิลด์ "เลขรับเข้า SAP" เป็น Optional — เว้นว่างได้ตอนสร้าง
- [ ] สามารถแก้ไขและกรอกเลข SAP ได้ภายหลัง แม้เอกสารจะ Complete แล้ว
- [ ] เมื่อกรอกเลข SAP แล้ว ระบบแสดง Badge "เชื่อมกับ SAP แล้ว" บนเอกสารนั้น

---

### US-103
> **As a** พนักงาน  
> **I want to** ดูรายการเอกสาร WH- ทั้งหมดที่เปิดอยู่และที่เสร็จแล้ว  
> **So that** สามารถเปิดต่อหรือตรวจสอบย้อนหลังได้

**Acceptance Criteria:**
- [ ] Home Screen แสดงรายการแยกตาม Status: กำลังดำเนินการ / เสร็จสิ้น
- [ ] แต่ละรายการแสดง: เลข WH-, LOT, Item Description, วันที่, Status
- [ ] แสดง Badge "มีเลข SAP" หรือ "ยังไม่มีเลข SAP" ในแต่ละรายการ
- [x] ค้นหาด้วย: **เลข WH-, LOT, PO Number, Item Code, Description** (รวม PO ใน v1.5)
- [x] Placeholder ในช่อง search: "ค้นหา WH-, LOT, PO, Item Code, Description..."

---

## Epic 1b — Status Workflow และ Admin SAP

### US-104
> **As a** พนักงานปฏิบัติการ  
> **I want to** กด "ส่งงาน" เมื่อกรอกข้อมูลชั่งน้ำหนักครบแล้ว  
> **So that** Admin ทราบว่าเอกสารนี้พร้อมให้นำเข้า SAP

**Acceptance Criteria:**
- [ ] ปุ่ม "ส่งงาน" ปรากฏเฉพาะเมื่อกรอก Per Pcs, Per Inner และ Per Carton ครบแล้ว
- [ ] ระบบแสดง Confirmation Dialog ก่อนส่ง: "ยืนยันการส่งงาน? ไม่สามารถแก้ไขข้อมูลได้หลังส่ง"
- [ ] หลังยืนยัน Status เปลี่ยนเป็น 🔵 "รอนำเข้า SAP" ทันที
- [ ] ระบบบันทึก Timestamp และชื่อพนักงานที่ส่งงาน
- [ ] พนักงานไม่สามารถแก้ไขข้อมูลชั่งน้ำหนักได้หลังส่งงาน (Read-only)

---

### US-105
> **As a** Admin / เจ้าหน้าที่ SAP  
> **I want to** เห็นรายการเอกสาร WH- ที่มี Status "รอนำเข้า SAP" แยกออกมาชัดเจน  
> **So that** ทราบทันทีว่ามีงานรอดำเนินการอยู่กี่รายการ

**Acceptance Criteria:**
- [ ] Home Screen ของ Admin มีแถบ "รอนำเข้า SAP" แสดงจำนวน Badge แบบ Real-time
- [ ] สามารถ Filter รายการตาม Status ได้
- [ ] แต่ละรายการแสดง: เลข WH-, LOT, Item Description, วันที่ส่งงาน, ชื่อพนักงานที่ส่ง
- [ ] เรียงลำดับตามวันที่ส่งงานล่าสุดก่อน (Newest first)

---

### US-106
> **As a** Admin / เจ้าหน้าที่ SAP  
> **I want to** ดูข้อมูลทั้งหมดในเอกสาร WH- เพื่อนำไปกรอกใน SAP  
> **So that** ไม่ต้องถามพนักงานซ้ำ และมีข้อมูลครบพร้อมกรอก SAP ได้เลย

**Acceptance Criteria:**
- [ ] หน้าดูรายละเอียดแสดงข้อมูลทุก Field ใน Read-only mode ได้ชัดเจน
- [ ] มีปุ่ม "Export PDF" เพื่อพิมพ์หรือดูบนมือถือขณะกรอก SAP
- [ ] ข้อมูลที่ต้องใช้กรอก SAP แสดงเด่น ได้แก่: PO Number, Product ID, Description, Quantity, Delivery Date, Gross Weight

---

### US-107
> **As a** Admin / เจ้าหน้าที่ SAP  
> **I want to** กรอกเลข Inbound Delivery (CFSD) ที่ได้จาก SAP กลับเข้าเอกสาร WH-  
> **So that** เอกสาร WH- และ SAP เชื่อมกันได้ และ Status เปลี่ยนเป็น "เสร็จสมบูรณ์"

**Acceptance Criteria:**
- [ ] หน้า Admin มีปุ่ม "บันทึกเลข SAP" บนเอกสารที่ Status "รอนำเข้า SAP"
- [ ] Form มีช่อง: "Inbound Delivery ID (CFSD)" (Required), "Delivery Notification ID" (Optional), "แนบเอกสาร SAP" (Optional)
- [ ] เมื่อกด Save ระบบเปลี่ยน Status เป็น 🟢 "เสร็จสมบูรณ์" ทันที
- [ ] ระบบบันทึก Timestamp และชื่อ Admin ที่ดำเนินการ
- [ ] เลข CFSD ที่กรอกแล้วแสดงบน Document Card ในรายการ

---

### US-108
> **As a** Admin / เจ้าหน้าที่ SAP  
> **I want to** Unlock เอกสารเพื่อให้พนักงานแก้ไขข้อมูลที่กรอกผิดได้  
> **So that** ไม่ต้องสร้างเอกสารใหม่ในกรณีที่ข้อมูลผิดพลาด

**Acceptance Criteria:**
- [ ] Admin มีปุ่ม "ปลดล็อกเพื่อแก้ไข" บนเอกสารที่ Status "รอนำเข้า SAP"
- [ ] เมื่อ Unlock Status กลับเป็น "กำลังดำเนินการ" และพนักงานแก้ไขได้
- [ ] ระบบบันทึก Log ว่าใคร Unlock เมื่อไหร่ และเหตุผล (กรอก Free Text)

---

### US-109 (v1.6 — Direct Edit)
> **As an** Admin / Admin SAP / Manager
> **I want to** กดปุ่ม "แก้ไขข้อมูล" บนเอกสารที่ Status "เสร็จสมบูรณ์" แล้วเพื่อแก้ไขข้อมูล**โดยตรง** โดยไม่เปลี่ยน status และไม่ส่งกลับไปยัง Operator
> **So that** ถ้าตรวจพบความผิดพลาดหลังปิดงาน (เช่น น้ำหนักผิด, MFG/EXP ผิด) Admin/Manager แก้เองได้ทันทีโดยเอกสารยังคงเป็น completed และไม่ไปรบกวน operator

**Acceptance Criteria:**
- [x] ปุ่ม "แก้ไขข้อมูล (status ไม่เปลี่ยน)" ปรากฏใต้กล่อง "SAP Linked" บน `/admin/[id]` เมื่อ Status = `completed`
- [x] เห็นเฉพาะ role `admin`, `admin_sap`, `manager` (operator/qc ไม่เห็น) — ตรวจด้วย `canEditDocumentData(role, "completed")`
- [x] กดแล้ว **Link ไป `/doc/[id]/header` ทันที** (ไม่มี confirm dialog, ไม่กรอกเหตุผล)
- [x] ทุกฟิลด์ในหน้า `/doc/[id]/*` (header, per-pcs, per-inner, count, remainder, issues) **editable** สำหรับ role ที่มีสิทธิ์
- [x] **Status ไม่เปลี่ยน** — เอกสารยังคงเป็น `completed` หลังแก้
- [x] **ไม่เคลียร์ timestamps:** `closed_at` / `closed_by` / `submitted_at` / `sap_inbound_id` คงอยู่ตามเดิม
- [x] **เอกสารไม่กลับไปแสดงในงานของ operator** (เพราะ status ยัง completed)
- [x] Banner สีส้มแสดงบนหน้า `/doc/[id]/*` ขณะแก้ doc ที่ completed: "⚠ เอกสารนี้นำเข้า SAP แล้ว — การแก้ไขจะไม่เปลี่ยนสถานะกลับ แต่ระบบจะบันทึก audit log ทุกครั้ง"
- [x] audit_log บันทึก action `edit_header` (ตามปกติ) — ใช้ตัว detail/timestamps แยกแยะว่าเป็นการแก้หลัง SAP

**Note:** v1.5 มี action `reopen_completed` แต่ deprecate แล้ว — เปลี่ยนเป็น direct edit แบบนี้แทน

---

### US-110
> **As a** พนักงานปฏิบัติการ (operator)
> **I want to** ไม่ต้องเห็นช่องข้อมูล SAP ตอนสร้างเอกสารใหม่
> **So that** หน้าสร้างเอกสารสั้นและโฟกัสเฉพาะงานของตัวเอง (การกรอก SAP เป็นหน้าที่ของ admin_sap)

**Acceptance Criteria:**
- [x] ส่วน "ข้อมูล SAP (Optional)" (CFSD / Delivery Notification ID) ถูกซ่อนสำหรับ role `operator` บนหน้า `/new`
- [x] Role อื่น (admin, admin_sap, qc, manager) ยังเห็นส่วนนี้ตามเดิม
- [x] Backend insert ยังคงทำงานได้: field ที่ถูกซ่อนจะเป็น `null` (ไม่กระทบ schema)
- [x] เมื่อ admin_sap ได้รับเอกสาร สามารถกรอก SAP ผ่านหน้า `/admin/[id]` เหมือนเดิม

---

### US-111
> **As an** Admin / Admin SAP / Manager
> **I want to** ดาวน์โหลดข้อมูลเอกสารทั้งหมดเป็นไฟล์ CSV ผ่านปุ่มลอย
> **So that** สามารถนำข้อมูลไปวิเคราะห์ในมือถือ/Excel ได้ทันทีโดยไม่ต้อง query DB เอง

**Acceptance Criteria:**
- [x] ปุ่มลอย "Export Report" มุมขวาล่าง แสดงเฉพาะ role `admin` (/users), `admin_sap` (/admin), `manager` (/dashboard)
- [x] กดปุ่มแล้วระบบดึงทุกเอกสาร (gr_documents) + ตารางที่เกี่ยวข้อง (weight_measurements, count_grid_entries, issue_reports, profiles) parallel
- [x] สร้างไฟล์ CSV 55 columns ต่อเอกสาร: WH no, status (ภาษาไทย), LOT/PO/Item/Description/Supplier, Delivery/MFG/EXP, scale/qty/dimensions/weights, per_pcs/inner/carton avg/min/max + count, full_cartons/remainder/total_pcs, skip flags + reasons (3 แท็บ), issue_count, CFSD/Notification, ชื่อผู้สร้าง/ส่ง/ปิด, timestamps ISO, lead_time_minutes
- [x] CSV ใช้ UTF-8 BOM (เปิดใน Excel แล้วภาษาไทยไม่เพี้ยน) + CRLF line endings
- [x] Filename รูปแบบ `comets-gr-report-YYYY-MM-DD.csv`
- [x] ระหว่างดึง — ปุ่มเปลี่ยนเป็น "กำลังเตรียม..." + spinner; Toast แจ้ง "ส่งออก N เอกสารสำเร็จ"

---

### US-201
> **As a** พนักงาน  
> **I want to** กรอกข้อมูล Header ของใบชั่งน้ำหนัก ได้แก่ ชื่อเครื่องชั่ง, LOT, PO, Item, Description, จำนวนชิ้น/ลัง, จำนวนที่นับได้จริง, ขนาดลัง, Gross Weight และ Net Weight  
> **So that** มีข้อมูลพื้นฐานครบถ้วนก่อนเริ่มกระบวนการชั่งน้ำหนัก

**Acceptance Criteria:**
- [ ] ฟิลด์ที่ดึงจาก ERP ได้ให้ Pre-fill อัตโนมัติ แต่ยังแก้ไขได้
- [ ] มีช่อง "ชื่อเครื่องชั่ง" แบบ Free Text
- [ ] มีช่อง "จำนวนชิ้น/ลัง" และ "จำนวนที่นับได้จริง (ลัง)" แยกกันชัดเจน
- [ ] มีช่องขนาดลัง กว้าง / ยาว / สูง (ซม.) แยก 3 ช่อง
- [ ] มีช่อง Gross Weight และ Net Weight แยกกัน (หน่วย kg)
- [ ] มี Date Picker สำหรับ MFG และ EXP พร้อม Lot Number
- [ ] มี Toggle QC เบิก / QC ไม่เบิก และช่องหมายเหตุ
- [x] **แก้ไขข้อมูลพื้นฐานจากแท็บ Header** (v1.5) — LOT, PO Number, Item Code, Description, ชื่อสินค้าฝั่ง Supplier, Delivery Date แก้ไขได้จากหน้า `/doc/[id]/header` (ไม่ใช่แค่ตอน `/new` เท่านั้น) พร้อม Item Code lookup จาก `item_master` แบบเดียวกับหน้า /new
- [x] Auto-save on blur ทุก field, ปุ่มแสดงสถานะ "บันทึกแล้ว"

---

### US-202
> **As a** พนักงาน  
> **I want to** บันทึกน้ำหนักต่อชิ้น (Per Pcs) โดยเลือกได้ว่าจะชั่งแบบ Per 1 Pcs หรือ Per 100 Pcs (กรณีสินค้าเบามาก)  
> **So that** ได้ค่าเฉลี่ย Min Max และน้ำหนักต่อ 1 ชิ้นโดยอัตโนมัติ ไม่ต้องคำนวณเอง

**Acceptance Criteria:**
- [ ] มี Toggle เลือก "ชั่ง Per 1 Pcs" หรือ "ชั่ง Per 100 Pcs" ก่อนกรอกค่า
- [ ] กรอกค่าน้ำหนักได้ไม่จำกัดจำนวนครั้ง พร้อมปุ่ม "เพิ่มค่า"
- [ ] ระบบแสดง Average, MIN, MAX แบบ Real-time
- [ ] หากเลือก Per 100 Pcs ระบบคำนวณและแสดง "น้ำหนักต่อ 1 ชิ้น = Average ÷ 100" อัตโนมัติ
- [ ] ทุกช่องเรียก Numeric Keyboard ของมือถือโดยอัตโนมัติ

---

### US-202b
> **As a** พนักงาน  
> **I want to** บันทึกจำนวนชิ้นต่อ Inner และน้ำหนักต่อ Inner แต่ละครั้ง  
> **So that** ระบบคำนวณ Average Min Max ของน้ำหนัก Inner ให้อัตโนมัติ

**Acceptance Criteria:**
- [ ] มีช่อง "จำนวนชิ้น / Inner" กรอก 1 ครั้งต่อ Item
- [ ] กรอกค่าน้ำหนัก Per Inner ได้ไม่จำกัดจำนวนครั้ง
- [ ] ระบบแสดง Average, MIN, MAX แบบ Real-time

---

### US-202c
> **As a** พนักงาน  
> **I want to** บันทึกน้ำหนักต่อ Carton ได้ไม่จำกัดจำนวนครั้ง  
> **So that** ครอบคลุม Shipment ที่มีสินค้าจำนวนมากโดยไม่ถูกจำกัดที่ 10 ครั้ง

**Acceptance Criteria:**
- [ ] กรอกค่าน้ำหนัก Per Carton ได้ไม่จำกัดจำนวน พร้อมปุ่ม "เพิ่มค่า"
- [ ] ระบบแสดง Average, MIN, MAX และ Counter "ชั่งแล้ว X ลัง / Y ลัง" แบบ Real-time
- [ ] ค่าที่ออกนอก MIN/MAX ถูก Highlight เตือนในสีแดง
- [ ] สามารถลบค่าที่กรอกผิดได้

---

### US-203
> **As a** พนักงาน  
> **I want to** ถ่ายรูปหน้าปัดเครื่องชั่งหรือสินค้าและแนบกับรายการชั่งนั้นๆ ได้ทันที  
> **So that** มีหลักฐานภาพประกอบค่าน้ำหนักแต่ละครั้งโดยไม่ต้องใช้อุปกรณ์แยก

**Acceptance Criteria:**
- [ ] มีปุ่ม "ถ่ายรูป" ที่เรียกกล้องมือถือได้โดยตรงผ่าน Browser
- [ ] รองรับการอัปโหลดรูปจาก Gallery ด้วย
- [ ] แสดง Thumbnail รูปที่แนบแล้ว
- [ ] สามารถแนบได้หลายรูปและลบรูปได้

---

### US-204
> **As a** พนักงาน  
> **I want to** กรอก MFG Date, EXP Date และ Lot Number ของสินค้า  
> **So that** มีข้อมูลการติดตามสินค้าครบถ้วนและถูกต้อง

**Acceptance Criteria:**
- [ ] มี Date Picker สำหรับ MFG และ EXP
- [ ] มีช่องกรอก Lot Number แบบ Free Text
- [ ] ระบบแจ้งเตือนหาก EXP Date น้อยกว่า MFG Date

---

### US-205
> **As a** พนักงาน  
> **I want to** ระบุสถานะ QC (เบิก / ไม่เบิก) และกรอกหมายเหตุ  
> **So that** ทีม QC ทราบสถานะสินค้าได้ทันที

**Acceptance Criteria:**
- [ ] มี Toggle หรือ Radio Button เลือก QC เบิก / QC ไม่เบิก
- [ ] มีช่องหมายเหตุ (Free Text) สำหรับข้อมูลเพิ่มเติม

---

### US-206
> **As a** พนักงาน  
> **I want to** ถ่ายรูปสินค้าหรือหน้าปัดเครื่องชั่งผ่านกล้องมือถือและแนบกับรายการนั้นๆ  
> **So that** มีหลักฐานภาพประกอบการชั่งน้ำหนักโดยไม่ต้องใช้อุปกรณ์แยก

**Acceptance Criteria:**
- [ ] มีปุ่ม "ถ่ายรูป" ที่เรียกกล้องมือถือได้โดยตรงผ่าน Browser
- [ ] รองรับการอัปโหลดรูปจาก Gallery ด้วย
- [ ] แสดง Thumbnail รูปที่แนบแล้วในฟอร์ม
- [ ] สามารถแนบได้หลายรูปต่อรายการ
- [ ] สามารถลบรูปที่แนบแล้วได้

---

### US-207
> **As a** พนักงาน  
> **I want to** ระบบบันทึกเวลาเริ่มและสิ้นสุดการชั่งน้ำหนักโดยอัตโนมัติ  
> **So that** ทราบ Lead Time ของกระบวนการชั่งน้ำหนักโดยไม่ต้องจับเวลาเอง

**Acceptance Criteria:**
- [ ] ระบบบันทึกเวลาเริ่มอัตโนมัติเมื่อเปิดฟอร์ม
- [ ] ระบบบันทึกเวลาสิ้นสุดอัตโนมัติเมื่อกด Submit
- [ ] พนักงานสามารถแก้ไขเวลาได้ในกรณีที่บันทึกไม่ถูกต้อง
- [ ] แสดงเวลาในรูปแบบ HH:MM

---

### US-208
> **As a** พนักงาน
> **I want to** กดปุ่ม "ไม่มีเศษ" บนหน้านับเศษเมื่อสินค้าลงลังเต็มพอดี
> **So that** ไม่ต้องพิมพ์ 0 เอง และระบบบันทึกสถานะชัดเจนว่ายืนยันแล้วว่าไม่มีเศษ (ไม่ใช่แค่ข้ามข้อ)

**Acceptance Criteria:**
- [x] หน้า "นับเศษ" มีปุ่ม "ไม่มีเศษ" ข้างปุ่มบันทึก
- [x] กดแล้ว `remainder_pcs = 0` ถูกบันทึกทันที + ขึ้น toast "บันทึกว่าไม่มีเศษ"
- [x] แสดง badge "บันทึกแล้วว่าไม่มีเศษ" เมื่อ state = 0 เพื่อยืนยันว่าไม่ใช่ค่าว่าง
- [x] Submit checklist นับว่า "นับเศษ" ผ่านเมื่อ remainder = 0 (เหมือนกรอกค่าอื่น)

---

### US-209
> **As a** พนักงาน
> **I want to** กดปุ่ม "ไม่มีการชั่งน้ำหนักส่วนนี้" บนแท็บชั่ง (Per Pcs / Per Inner / Per Carton) พร้อมเลือกเหตุผลจาก dropdown
> **So that** ส่งงานได้ในกรณีที่สินค้าไม่สามารถชั่งตามปกติได้ (เช่น สินค้าชิ้นเล็กชั่งต่อชิ้นไม่ได้) โดยไม่ต้องกรอกค่าหลอก

**Acceptance Criteria:**
- [x] แต่ละแท็บชั่ง (per-pcs / per-inner / per-carton) มีปุ่ม "ไม่มีการชั่งน้ำหนักส่วนนี้"
- [x] กดแล้วเปิด dropdown เลือกเหตุผลตามแท็บ (เช่น per-pcs: "สินค้าชิ้นเล็กชั่งต่อชิ้นไม่ได้", per-inner: "สินค้าไม่มี Inner/ถุง/ถาด", per-carton: "สินค้าไม่แพ็กเป็นลัง") + ตัวเลือก "อื่นๆ (ระบุ)"
- [x] ถ้าเลือก "อื่นๆ" ต้องกรอก free text เหตุผล
- [x] เมื่อยืนยันแล้ว แท็บจะแสดงสถานะ "ข้ามส่วนนี้ — <เหตุผล>" และปุ่ม "ยกเลิกการข้าม"
- [x] Step nav แสดง checkmark ให้แท็บที่ถูกข้ามเหมือน step ที่เสร็จแล้ว
- [x] Submit checklist นับแท็บที่ข้ามว่าผ่าน พร้อมแสดงเหตุผลท้าย checklist item
- [x] ถ้าแท็บ "ชั่งต่อลัง" ถูกข้าม → ไม่ต้องกรอกเศษด้วย (ข้ามทั้งคู่อัตโนมัติ)
- [x] เก็บ `skip_per_*` boolean + `skip_reason_per_*` text ใน `gr_documents` สำหรับ audit
- [x] ถ้ามีข้อมูลชั่งอยู่แล้วก่อนกดข้าม ระบบ confirm ก่อน ไม่ลบข้อมูลเดิม — ยกเลิกการข้ามแล้วข้อมูลกลับมา
- [ ] แสดงเหตุผลการข้ามใน PDF export *(TODO — Wave 3)*
- [x] **ข้อความเตือนสีแดง** ใต้ dropdown: "⚠ โปรดยืนยันการข้ามก่อนไปขั้นตอนถัดไป" (v1.5) — ป้องกัน case ที่ user เลือกเหตุผลแล้ว navigate ออกโดยไม่กด confirm

---

## Epic 3 — ใบตรวจนับสินค้า (Count Verification)

### US-301
> **As a** พนักงาน  
> **I want to** บันทึกน้ำหนักรายลังทุกลังลงใน Grid  
> **So that** มีข้อมูลน้ำหนักแต่ละลังครบถ้วนสำหรับการตรวจสอบ

**Acceptance Criteria:**
- [ ] Grid มีช่องกรอกจัดเป็น 10 คอลัมน์ต่อแถว และขยายแถวได้อัตโนมัติ
- [ ] ทุกช่องเรียก Numeric Keyboard ของมือถือโดยอัตโนมัติ
- [ ] ข้อมูล LOT, ITEM, CODE, DES ดึงมาจากใบชั่งน้ำหนักโดยอัตโนมัติ

---

### US-302
> **As a** พนักงาน  
> **I want to** ระบบคำนวณค่า Min, Max และ Average ของน้ำหนักทุกลังโดยอัตโนมัติ  
> **So that** ไม่ต้องคำนวณเองและลดความผิดพลาด

**Acceptance Criteria:**
- [ ] ระบบแสดง Min, Max, Average แบบ Real-time ขณะกรอกข้อมูล
- [ ] ค่าสถิติอัปเดตทันทีเมื่อมีการกรอกหรือแก้ไขค่าใดๆ ใน Grid
- [ ] แสดงจำนวนลังที่บันทึกแล้ว vs ที่คาดหวัง (ถ้ามีข้อมูลจาก ERP)

---

### US-303
> **As a** พนักงาน  
> **I want to** เปรียบเทียบจำนวนสินค้าที่นับได้จริงกับจำนวนตาม Packing List  
> **So that** ทราบทันทีว่าสินค้าขาดหรือเกินจำนวน

**Acceptance Criteria:**
- [ ] ระบบแสดงยอดที่คาดหวัง (จาก ERP) และยอดที่นับได้จริง
- [ ] ระบบคำนวณและแสดงผลต่าง (+/-) พร้อมสีสัญญาณ (เขียว = ตรง, แดง = ขาด/เกิน)
- [ ] บันทึกผลต่างลงในระบบเพื่อรายงาน

---

## Epic 4 — การบันทึกปัญหา (Issue Reporting)

### US-401
> **As a** พนักงาน  
> **I want to** บันทึกปัญหาที่พบระหว่างรับสินค้า พร้อมระบุประเภทปัญหาและรหัสของเสีย  
> **So that** มีบันทึกปัญหาที่ชัดเจนโดยไม่ต้องเขียนกระดาษแยก

**Acceptance Criteria:**
- [ ] มีปุ่ม "แจ้งปัญหา" ในฟอร์มรับสินค้า
- [ ] มี Dropdown เลือกประเภทปัญหา: สินค้าขาดหาย / ชำรุด / ข้อมูลหน้ากล่องไม่ตรง / อื่นๆ
- [ ] มี Dropdown หรือ Search เลือกรหัสของเสีย (Defect Code)
- [ ] มีช่องกรอกจำนวนสินค้าที่มีปัญหา
- [ ] สามารถบันทึกปัญหาได้หลายรายการต่อ 1 GR Session

---

### US-402
> **As a** พนักงาน  
> **I want to** ถ่ายรูปปัญหาหน้างานและแนบกับรายการปัญหานั้นๆ ได้ทันที  
> **So that** มีหลักฐานภาพประกอบรายการปัญหาทุกรายการ

**Acceptance Criteria:**
- [ ] แต่ละรายการปัญหาสามารถแนบรูปภาพได้
- [ ] เรียกกล้องมือถือได้โดยตรง
- [ ] แสดง Thumbnail รูปที่แนบแล้วในรายการปัญหา

---

## Epic 5 — Dashboard และรายงาน

### US-501
> **As a** ผู้จัดการ  
> **I want to** ดู Dashboard สรุปยอดน้ำหนักรับสินค้าแบบ Real-time แยกตามประเภทสินค้าหรือซัพพลายเออร์  
> **So that** ตัดสินใจได้รวดเร็วโดยไม่ต้องรอรายงาน

**Acceptance Criteria:**
- [ ] Dashboard แสดงกราฟยอดน้ำหนักรวม (Bar / Line Chart)
- [ ] สามารถ Filter ตามช่วงวันที่, ประเภทสินค้า, ซัพพลายเออร์
- [ ] ข้อมูลอัปเดต Real-time เมื่อมีการบันทึกใหม่

---

### US-502
> **As a** ผู้จัดการ  
> **I want to** ติดตาม Lead Time ของกระบวนการรับสินค้าเปรียบเทียบกับ KPI ที่กำหนด  
> **So that** ระบุได้ทันทีว่ากระบวนการล่าช้าหรืออยู่ในเป้าหมาย

**Acceptance Criteria:**
- [ ] Dashboard แสดง Lead Time เฉลี่ยรายวัน/สัปดาห์/เดือน
- [ ] แสดงสัญญาณเตือน (สีแดง) เมื่อ Lead Time เกิน KPI ที่กำหนด
- [ ] สามารถดู Lead Time รายการย้อนหลังได้

---

### US-503
> **As a** QC / หัวหน้างาน  
> **I want to** ส่งออกใบชั่งน้ำหนักเป็นไฟล์ PDF  
> **So that** มีเอกสารสำหรับแนบหรือส่งต่อได้โดยไม่ต้องพิมพ์กระดาษ

**Acceptance Criteria:**
- [ ] มีปุ่ม "Export PDF" ในหน้าใบชั่งน้ำหนัก
- [ ] PDF มี layout ใกล้เคียงกับใบกระดาษเดิม (Header, 3 ระดับน้ำหนัก, เวลา, ลายเซ็น)
- [ ] PDF สามารถ Download หรือ Share ผ่านมือถือได้โดยตรง
- [x] วันที่บน PDF แสดง ค.ศ. (Gregorian) + 24-hour + GMT+7 (Asia/Bangkok) — เหมือนกันทุก runtime (v1.5)

---

### US-504
> **As a** QC / หัวหน้างาน  
> **I want to** ส่งออกใบตรวจนับสินค้าเป็นไฟล์ PDF  
> **So that** มีเอกสารบันทึกน้ำหนักรายลังสำหรับอ้างอิง

**Acceptance Criteria:**
- [ ] มีปุ่ม "Export PDF" ในหน้าใบตรวจนับ
- [ ] PDF แสดง Grid ค่าน้ำหนักรายลัง พร้อม Min/Max/Average
- [ ] PDF ระบุ LOT, ITEM, CODE, DES และผู้รับผิดชอบ
- [x] วันที่บน PDF แสดง ค.ศ. (Gregorian) + 24-hour + GMT+7 (v1.5)

---

### US-505
> **As an** Admin / Admin SAP
> **I want to** เห็นว่าใครทำอะไรกับเอกสารแต่ละใบเมื่อไหร่ (audit timeline) บนหน้าตรวจสอบเอกสาร
> **So that** สามารถสืบสวนข้อผิดพลาด, รู้ว่าใครเป็นคนกรอกข้อมูล, หรือใครเป็นคนปลดล็อก/เปิดเอกสารใหม่ได้โดยไม่ต้อง query DB

**Acceptance Criteria:**
- [x] หน้า `/admin/[id]` แสดง **Workflow card** มีชื่อจริง + role ของ created_by, submitted_by, closed_by พร้อม timestamp และ Lead Time
- [x] ถ้ามี `unlock_reason` ล่าสุด แสดงเป็น highlight ในการ์ด workflow (เช่น "เหตุผลปลดล็อก/แก้ไขล่าสุด: 'พบน้ำหนักผิด'")
- [x] แสดง **Audit Timeline** ใต้ Workflow card — เรียงจากใหม่ → เก่า
- [x] แต่ละแถวแสดง: timestamp (ค.ศ. + 24-hour + ไทย), ชื่อ actor + role, action label เป็นภาษาไทย, detail (เหตุผล/CFSD ถ้ามี)
- [x] Action labels ภาษาไทยครอบคลุม: create_doc / edit_header / submit_work / complete_sap / unlock / reopen_completed / recall_submission

---

## Epic 6 — การจัดการผู้ใช้งานและสิทธิ์ (User & Permission)

### US-601
> **As a** ผู้ดูแลระบบ  
> **I want to** สร้างและจัดการบัญชีผู้ใช้งาน กำหนด Role ให้แต่ละคน  
> **So that** ผู้ใช้แต่ละ Role เข้าถึงได้เฉพาะฟีเจอร์ที่เกี่ยวข้อง

**Acceptance Criteria:**
- [ ] สร้าง / แก้ไข / ปิดใช้งาน User ได้
- [ ] กำหนด Role: พนักงาน / QC-หัวหน้างาน / ผู้จัดการ / Admin
- [ ] แต่ละ Role เห็นเมนูและฟีเจอร์ตามสิทธิ์ที่กำหนด

---

### US-602
> **As a** พนักงาน / QC / ผู้จัดการ  
> **I want to** Login เข้าระบบด้วย Username และ Password  
> **So that** ข้อมูลของแต่ละคนแยกจากกัน และมีความปลอดภัย

**Acceptance Criteria:**
- [ ] มีหน้า Login พร้อม Validation
- [ ] Session หมดอายุหลังไม่มีการใช้งานตามเวลาที่กำหนด
- [ ] แสดงชื่อผู้ใช้ที่ Login อยู่บนทุกหน้า

---

## สรุป User Stories ทั้งหมด

| Epic | จำนวน Story | ครอบคลุม |
|---|---|---|
| Epic 1 — Running Number & Document | 3 | Auto-generate WH-, กรอก SAP ย้อนหลัง, รายการเอกสาร (รวม PO ใน search) |
| Epic 1b — Status Workflow & Admin SAP | 8 | ส่งงาน, Admin เห็นงาน, ดูข้อมูลส่ง SAP, กรอก CFSD กลับ, Unlock, **Reopen completed (v1.5)**, ซ่อน SAP สำหรับ operator, **Export Report CSV (v1.5)** |
| Epic 2 — ใบชั่งน้ำหนัก | 10 | Header (รวมแก้ไขข้อมูลพื้นฐาน v1.5), Per Pcs/100Pcs, Per Inner+จำนวนชิ้น, Per Carton ไม่จำกัด, MFG/EXP, QC, รูปภาพ, เวลา, ไม่มีเศษ, ข้ามการชั่ง (+reminder v1.5) |
| Epic 3 — ใบตรวจนับ | 3 | Grid, สถิติ, ตรวจสอบจำนวน |
| Epic 4 — บันทึกปัญหา | 2 | ประเภทปัญหา, รูปภาพ |
| Epic 5 — Dashboard/รายงาน | 5 | Dashboard, Lead Time, Export PDF ×2 (ค.ศ./24-hour/GMT+7), **Audit Timeline (v1.5)** |
| Epic 6 — User/Permission | 2 | จัดการ User, Login |
| **รวม** | **33 Stories** | (+3 จาก v1.4) |

---

*อ้างอิง PRD DATA-REQ-2604001 v2.5 — User Stories เวอร์ชัน 1.5*
