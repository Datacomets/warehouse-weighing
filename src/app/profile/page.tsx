import { redirect } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";

const ROLE_LABEL: Record<string, string> = {
  operator: "พนักงานปฏิบัติการ",
  qc: "QC / หัวหน้างาน",
  admin_sap: "Admin SAP",
  manager: "ผู้จัดการ",
  admin: "Admin (System)",
};

export default async function ProfilePage() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!profile || !user) redirect("/login");

  return (
    <>
      <TopAppBar title="โปรไฟล์" />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">
        <div className="card flex flex-col items-center text-center py-8">
          <div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center text-3xl font-headline font-bold text-tertiary-fixed-dim">
            {profile.full_name.charAt(0)}
          </div>
          <h2 className="font-headline font-bold text-primary mt-3">{profile.full_name}</h2>
          <p className="text-xs text-outline">{user.email}</p>
          <span className="mt-3 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase">
            {ROLE_LABEL[profile.role] || profile.role}
          </span>
        </div>

        <form action="/api/logout" method="post">
          <button className="btn-secondary w-full text-error">
            <Icon name="logout" /> ออกจากระบบ
          </button>
        </form>
      </main>
      <BottomNav role={profile.role} />
    </>
  );
}
