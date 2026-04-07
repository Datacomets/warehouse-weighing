# COMETS GR — Goods Receiving Web Application

ระบบตรวจรับสินค้าเข้าคลัง อ้างอิง PRD `DATA-REQ-2604001`

ดูรายละเอียดการติดตั้งและการใช้งานทั้งหมดที่ [SETUP.md](./SETUP.md)

## เทคโนโลยี

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS (Stitch UI design tokens)
- **Backend / Auth / DB / Storage:** Supabase (Postgres + Auth + Storage + RLS)
- **PDF:** @react-pdf/renderer
- **Charts:** Recharts

## คุณสมบัติหลัก

- ✅ Auto-generate WH-YYMM-XXX
- ✅ ชั่งน้ำหนัก Per Pcs (Per 1 / Per 100), Per Inner, Per Carton (ไม่จำกัด)
- ✅ ใบตรวจนับ Grid + เปรียบเทียบยอด
- ✅ บันทึกปัญหา + ถ่ายรูปจากกล้องมือถือ
- ✅ Status Workflow: in_progress → pending_sap → completed
- ✅ Admin SAP Entry + Unlock
- ✅ Manager Dashboard + KPI Lead Time
- ✅ Export PDF (ใบชั่งน้ำหนัก + ใบตรวจนับ)
- ✅ Role-based access (operator / qc / admin_sap / manager / admin)
- ✅ Mobile + Desktop responsive

## คำสั่ง

```bash
npm install     # ติดตั้ง dependencies
npm run dev     # รัน dev server (port 3000)
npm run build   # build production
npm run start   # รัน production build
```
