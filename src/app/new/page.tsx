import { redirect } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { CreateDocForm } from "./CreateDocForm";

export default async function NewDocPage({ searchParams }: { searchParams: { code?: string } }) {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");

  // The WH number is issued only when the form is saved (create_gr_document),
  // so opening this page and leaving never uses up a number.
  return (
    <>
      <TopAppBar title="สร้างเอกสารใหม่" subtitle="กรอกข้อมูลก่อนเริ่มชั่งน้ำหนัก" showBack />
      <main className="mt-16 pb-32 px-4">
        <CreateDocForm userId={profile.id} role={profile.role} initialCode={(searchParams.code || "").trim().slice(0, 40)} />
      </main>
    </>
  );
}
