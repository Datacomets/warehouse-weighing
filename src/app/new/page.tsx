import { redirect } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { CreateDocForm } from "./CreateDocForm";

export default async function NewDocPage() {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const { data: whNumber, error } = await supabase.rpc("next_wh_number");
  if (error || !whNumber) {
    return (
      <main className="p-6">
        <h1 className="text-error font-bold">ไม่สามารถออกเลขเอกสารได้</h1>
        <p className="text-sm">{error?.message}</p>
      </main>
    );
  }

  return (
    <>
      <TopAppBar title="สร้างเอกสารใหม่" subtitle="กรอกข้อมูลก่อนเริ่มชั่งน้ำหนัก" showBack />
      <main className="mt-16 pb-32 px-4">
        <CreateDocForm whNumber={whNumber as string} userId={profile.id} />
      </main>
    </>
  );
}
