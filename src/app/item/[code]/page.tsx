import { redirect } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { DocumentCard } from "@/components/DocumentCard";
import { fmtDate } from "@/lib/stats";
import { cardPhotos } from "@/lib/docPhotos";

/** หน้าสินค้า: ข้อมูลจาก Item Master + ใบงานทุกสถานะของรหัสนี้ */
export default async function ItemPage({ params }: { params: { code: string } }) {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");
  const code = decodeURIComponent(params.code).trim();
  const supabase = createClient();

  const [{ data: item }, { data: docs }] = await Promise.all([
    supabase.from("item_master").select("item_code, description, product_category, obsolete").eq("item_code", code).maybeSingle(),
    supabase
      .from("gr_documents")
      .select("*")
      .eq("item_code", code)
      .is("cancelled_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const list = docs || [];
  const last = list[0];
  const photos = await cardPhotos(supabase as any, list.map((d: any) => d.id));

  return (
    <>
      <TopAppBar title={code} subtitle="หน้าสินค้า" showBack />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4 max-w-3xl mx-auto w-full">
        <div className="card border-l-4 border-primary-container">
          <span className="section-title">ข้อมูลสินค้า</span>
          {item ? (
            <>
              <div className="mt-1 font-headline font-bold text-lg text-primary">{item.item_code}</div>
              <div className="text-sm font-semibold">{item.description || "-"}</div>
              <div className="text-xs text-outline mt-1">
                {item.product_category || "ไม่มีหมวด"} · ใบงาน {list.length} ใบ
                {last ? ` · รับล่าสุด ${fmtDate(last.created_at)}` : ""}
              </div>
              {item.obsolete && <div className="text-xs font-bold text-error mt-1">⚠ Obsolete — รหัสนี้เลิกใช้ใน SAP</div>}
            </>
          ) : (
            <p className="text-sm text-error mt-1">ไม่พบรหัส {code} ใน Item Master</p>
          )}
        </div>

        <span className="section-title px-1">
          ใบงานของรหัสนี้ ({list.length}){profile.role === "operator" ? " — เฉพาะของฉัน" : ""}
        </span>
        {list.length === 0 ? (
          <div className="card text-center text-outline text-sm py-8">ยังไม่มีใบงานของรหัสนี้</div>
        ) : (
          list.map((d: any) => <DocumentCard key={d.id} doc={d} href={`/doc/${d.id}/header`} photo={photos.get(d.id)} />)
        )}
      </main>
      <BottomNav role={profile.role} />
    </>
  );
}
