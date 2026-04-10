import { redirect } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";

const STEPS = [
  { icon: "description", title: "1. สร้างเอกสาร", desc: "กรอก LOT, PO Number, Item Code แล้วกด 'เริ่มบันทึก'" },
  { icon: "edit_note", title: "2. กรอกข้อมูลหลัก (Header)", desc: "กรอกชื่อเครื่องชั่ง, จำนวนชิ้น/ลัง, ขนาดลัง, น้ำหนัก, วัน MFG/EXP" },
  { icon: "balance", title: "3. ชั่งต่อชิ้น (Per Pcs)", desc: "ชั่งน้ำหนักต่อชิ้น กรอกค่าแล้วกด 'เพิ่ม' ทีละค่า" },
  { icon: "inventory", title: "4. ชั่งต่อถุง/ถาด (Per Inner)", desc: "ชั่งน้ำหนักต่อ Inner/Tray/Bag กรอกจำนวนชิ้นต่อ Inner" },
  { icon: "local_shipping", title: "5. ชั่งต่อลัง (Per Carton)", desc: "กรอกน้ำหนักในตาราง ช่องที่ค่าผิดปกติจะขึ้นกรอบแดง" },
  { icon: "exposure", title: "6. นับเศษ (Remainder)", desc: "กรอกจำนวนชิ้นที่ไม่ครบลัง ถ้าไม่มีเศษให้เว้นว่าง" },
  { icon: "report_problem", title: "7. รายงานปัญหา (Issues)", desc: "แจ้งสินค้าเสียหาย/ขาดหาย พร้อมถ่ายรูปประกอบ" },
  { icon: "send", title: "8. ส่งงาน (Submit)", desc: "ตรวจ Checklist แล้วกด 'ยืนยันส่ง' เข้าคิว Admin SAP" },
];

export default async function GuidePage() {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");

  return (
    <>
      <TopAppBar title="คู่มือการใช้งาน" subtitle="COMETS GR" showBack />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">
        <div className="card border-l-4 border-primary-container">
          <h2 className="font-headline font-bold text-primary">ขั้นตอนการตรวจรับสินค้า</h2>
          <p className="text-xs text-outline mt-1">ทำตามลำดับขั้นตอนด้านล่าง</p>
        </div>

        {STEPS.map((s, i) => (
          <div key={i} className="card flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-none">
              <Icon name={s.icon} className="text-lg" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface">{s.title}</h3>
              <p className="text-xs text-outline mt-0.5">{s.desc}</p>
            </div>
          </div>
        ))}

        <div className="card bg-tertiary-container/20 border-l-4 border-tertiary-fixed-dim">
          <h3 className="text-sm font-bold text-on-surface">สัญลักษณ์ที่ควรรู้</h3>
          <ul className="mt-2 text-xs flex flex-col gap-1">
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded border-2 border-error bg-error-container/30 flex items-center justify-center text-error text-[10px] font-bold">!</span>
              <span>กรอบแดง = ค่าผิดปกติ (outlier) ให้ตรวจสอบอีกครั้ง</span>
            </li>
            <li className="flex items-center gap-2">
              <Icon name="check_circle" className="text-success text-lg" />
              <span>เครื่องหมายถูกสีเขียว = ขั้นตอนนี้ทำเสร็จแล้ว</span>
            </li>
            <li className="flex items-center gap-2">
              <Icon name="lock" className="text-outline text-lg" />
              <span>ล็อก = เอกสารถูกส่งแล้ว ต้องให้ Admin ปลดล็อก</span>
            </li>
          </ul>
        </div>
      </main>
      <BottomNav role={profile.role} />
    </>
  );
}
