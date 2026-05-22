# Daily Task Log — COMETS GR (ระบบตรวจรับสินค้า)

บันทึกงานที่ทำในแต่ละวัน (ภาษาไทย, วันที่ พ.ศ.) เรียงใหม่สุดไว้บนสุด

---

## 13 พฤษภาคม 2569 (2026-05-13) — PDF: บรรทัดสูตรรวมให้ตรงกับหน้าสรุป

### ปัญหา
- หน้า PDF (พรีวิว + ไฟล์ดาวน์โหลด) ในบรรทัด "Cartons ชั่งแล้ว" แสดงเป็น `N ลัง + เศษ M ชิ้น = T ชิ้น` ซึ่งขาดตัวคูณ `qty/carton`
- หน้า "ส่งงานเพื่อนำเข้า SAP" (submit) แสดงสูตรเต็ม `(qty/carton x ลังเต็ม) + เศษ = รวม ชิ้น` อยู่แล้ว ทำให้สองหน้าไม่สอดคล้องกัน

### แก้
- [PdfClient.tsx:110](app/src/app/doc/[id]/pdf/PdfClient.tsx#L110) — เปลี่ยนรูปแบบเป็น `({qty_per_carton} x {cartonCount} ลัง) + เศษ {remainderPcs} = {totalPcs} ชิ้น`
- [pdfDocs.tsx](app/src/app/doc/[id]/pdf/pdfDocs.tsx) `WeightSheetPdf` — รับ prop `grid` เพิ่ม, คำนวณ `cartonCount` / `totalPcs` ด้วย `totalPiecesCount()` จาก `documentSummary` แล้วเพิ่มบรรทัด "Cartons ชั่งแล้ว" ลงในไฟล์ PDF ที่ดาวน์โหลด (เดิมมีแค่ในพรีวิว)
- [PdfDownloadButtons.tsx:23](app/src/app/doc/[id]/pdf/PdfDownloadButtons.tsx#L23) — ส่ง `grid` ต่อให้ `WeightSheetPdf`

### เอกสาร
- PRD: v2.3 → v2.4 (13 พ.ค. 2569) + changelog
- UserStories: v1.3 → v1.4 (อ้างอิง PRD v2.4) + ปรับ US-104

### Deploy
- Commit + push origin/main → Vercel auto-deploy

---

## 23 เมษายน 2569 (2026-04-23) — UX Wave 3 (audit + cleanup)

### Audit
- รีวิวระบบทั้งหมดในมุม Google UX → พบ 14 ประเด็น (1 Blocker / 3 High / 6 Medium / 4 Low)
- 2 ข้อที่ agent เสนอไม่ตรงความจริง (confirm delete ใน WeightEntry / EXP<MFG validation) ตรวจกับโค้ดจริงแล้ว

### 🔴 Blocker (Wave 3a-1)
- **`app/src/app/doc/[id]/header/HeaderForm.tsx`** — refactor ใหญ่
  - Auto-save on blur (ทุก field เรียก `autoSave()` เมื่อ blur)
  - `beforeunload` warning ถ้า dirty (ยังไม่ save)
  - SaveIndicator แสดงสถานะ `idle / saving / saved / error`
  - Inline validation MFG/EXP on blur (`validateDatesOnBlur`) + error ใต้ field
  - Char counter บน textarea "หมายเหตุ" (max 500)
  - `pb-32` ที่ form + safe area padding ให้ bottom fixed bar ไม่บัง textarea

### 🟠 High (Wave 3a-2 + 3b)
- **`app/src/components/ConfirmDialog.tsx` (ใหม่)** — Material-style modal + `useConfirm()` hook
  - Promise-based API: `await confirm({ title, message, destructive, confirmLabel })`
  - 48px touch targets, destructive สีแดง, bottom-sheet บน mobile / center บน desktop
- แทนที่ `window.confirm()` 4 จุด:
  - [WeightEntry.tsx:123](app/src/components/WeightEntry.tsx#L123) ลบค่าน้ำหนัก
  - [SkipSection.tsx:79](app/src/components/SkipSection.tsx#L79) ข้าม section ที่มีข้อมูล
  - [IssuesPanel.tsx:69](app/src/app/doc/[id]/issues/IssuesPanel.tsx#L69) ลบรายการปัญหา
  - [ItemsAdmin.tsx:119](app/src/app/admin/items/ItemsAdmin.tsx#L119) ลบรหัสสินค้า
- [CountGrid.tsx](app/src/app/doc/[id]/count/CountGrid.tsx) cells ขยาย `h-10 → h-12`, font `text-sm → text-base`

### 🟡 Medium (Wave 3c)
- [submit/page.tsx](app/src/app/doc/[id]/submit/page.tsx) — เพิ่ม `ChecklistItem` component ใช้ icon `check_circle`/`cancel` แทน ASCII
- [SkipSection.tsx](app/src/components/SkipSection.tsx) — ปรับ `reasonLabel` → `parseReason` แยก preset vs free-form + แสดง italic + ป้าย "ระบุเอง"
- [StepNav.tsx](app/src/app/doc/[id]/StepNav.tsx) — step locked เปลี่ยนเป็น `<span aria-disabled>` ไม่สามารถกดได้
- [RemainderForm.tsx](app/src/app/doc/[id]/remainder/RemainderForm.tsx) — หลังบันทึก "ไม่มีเศษ" แสดง badge + ปุ่ม "แก้ไข" ที่ clear input

### ไม่ต้องแก้ (audit ผิด)
- Placeholder ใน WeightEntry sync กับ unit อยู่แล้ว ([WeightEntry.tsx:320](app/src/components/WeightEntry.tsx#L320))
- Delete confirm ใน WeightEntry มีอยู่แล้ว (v1.9)
- Validation EXP/MFG มีอยู่แล้วใน [validation.ts:29](app/src/lib/validation.ts#L29) (เพิ่ม inline-on-blur เป็นส่วนเสริม)

### Testing
- ✅ `npx tsc --noEmit` ผ่าน
- ✅ `npx vitest run` — 20 files, 387 tests passed

### อัปเดตเอกสาร
- PRD → v2.3
- UserStories → v1.3

---

## 22 เมษายน 2569 (2026-04-22) — รอบบ่าย

### UX tweak: สูตรคำนวณยอดรวมบนหน้าส่งงาน
- `app/src/app/doc/[id]/submit/page.tsx` — เพิ่มบรรทัดสุดท้ายในการ์ด "สรุปจำนวนรวม"
  - รูปแบบ: `({qtyPerCarton} x {fullCartons} ลัง) + เศษ {remainderPcs} = {totalPcs} ชิ้น`
  - ตัวอย่าง: `(2940 x 45 ลัง) + เศษ 0 = 132,300 ชิ้น`
  - สอดคล้องกับรูปแบบบนหน้านับเศษ ([RemainderForm.tsx:157](app/src/app/doc/[id]/remainder/RemainderForm.tsx#L157))

### อัปเดตเอกสาร
- `PRD_GoodsReceiving_DATA-REQ-2604001.md` → v2.2
- `UserStories_GoodsReceiving_DATA-REQ-2604001.md` → v1.2 (ปรับ US-104)

---

## 22 เมษายน 2569 (2026-04-22)

### Push ขึ้น Vercel (commits บน `main`)
- `cafcc0f` — feat(remainder): ปุ่มไม่มีเศษ
- `44ecefd` — feat(new): ซ่อน SAP สำหรับ operator
- `2129bfa` — feat(weighing): skip-section flow (Wave 2a: per-pcs sample)
- `c9d5a3e` — feat(weighing): extend skip-section flow to per-inner and count (Wave 2b)

### Supabase prod
- ✅ รัน migration `0006_add_skip_sections.sql` แล้ว (6 คอลัมน์ใหม่บน `gr_documents`)

### ส่งมอบ (Shipped)
1. **ปุ่ม "ไม่มีเศษ" บนหน้านับเศษ** (US-208)
   - `app/src/app/doc/[id]/remainder/RemainderForm.tsx` — refactor `save()` เป็น `persistRemainder()` ให้ reuse ได้, เพิ่ม `markNoRemainder()` ที่ตั้ง `remainder_pcs = 0` และ save ทันที
   - ปรับ hint ของช่องเศษและเพิ่ม badge "บันทึกแล้วว่าไม่มีเศษ" เมื่อ state = 0
2. **ซ่อนส่วน SAP บนหน้าสร้างเอกสารใหม่สำหรับ operator** (US-110)
   - `app/src/app/new/CreateDocForm.tsx` — รับ prop `role` แล้วใช้ `canEnterSap = role !== "operator"` ห่อรอบ section "ข้อมูล SAP (Optional)"
   - `app/src/app/new/page.tsx` — ส่ง `profile.role` เข้าคอมโพเนนต์

### Skip-section flow — Wave 2a + 2b (US-209, เสร็จ)
3. **ปุ่ม "ไม่มีการชั่งน้ำหนักส่วนนี้" บนแท็บชั่ง 3 แท็บ + dropdown เหตุผล** (US-209)
   - Migration `0006_add_skip_sections.sql`: 6 field (`skip_per_pcs/inner/carton` + `skip_reason_per_pcs/inner/carton`)
   - `src/lib/types.ts`: เพิ่ม field ใน `GrDocument`
   - `src/lib/submitChecklist.ts` + test: รับ `skipPerPcs/Inner/Carton`, skipped = ผ่าน, carton skip → remainder auto-pass (6 test cases ใหม่)
   - `doc/[id]/layout.tsx`: `completed[step]` นับ skipped ว่าเสร็จ → step-nav checkmark
   - `src/components/SkipSection.tsx` (ใหม่): ปุ่ม + dropdown preset ตามแท็บ + free-text "อื่นๆ" + confirm ถ้ามีข้อมูล + undo
   - `doc/[id]/per-pcs/page.tsx` + `per-inner/page.tsx` + `count/page.tsx`: render SkipSection ด้านบน, hide body เมื่อ skipped
   - `doc/[id]/submit/page.tsx`: pass skip flags เข้า `computeSubmitChecklist` + แสดง "(ข้าม: เหตุผล)" ต่อท้าย checklist

### ยังค้าง (ยังไม่ได้ ship รอบนี้)
- แสดงเหตุผลการข้ามใน PDF export (Wave 3)

### อัปเดตเอกสาร (Docs)
- `PRD_GoodsReceiving_DATA-REQ-2604001.md` → v2.1 (เพิ่ม changelog 22 เม.ย. 2569 — รวม Wave 2a+2b)
- `UserStories_GoodsReceiving_DATA-REQ-2604001.md` → v1.1 (เพิ่ม US-110, US-208, US-209 เสร็จครบ 3 แท็บ; อ้างอิง PRD v2.1; ปรับ summary count เป็น 30 stories)

---
