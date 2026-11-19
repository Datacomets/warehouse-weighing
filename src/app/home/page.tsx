import { redirect } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { DocumentCard } from "@/components/DocumentCard";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { HomeFilters } from "./HomeFilters";
import { logger } from "@/lib/logger";
import { seesOnlyOwnDocuments } from "@/lib/permissions";
import { isDocCanceler } from "@/lib/cancelDocs";
import { cardPhotos } from "@/lib/docPhotos";
import {
  parseHomeTab,
  normalizeSearchQuery,
  homeSearchOrExpression,
} from "@/lib/homeSearch";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { tab?: string; q?: string };
}) {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");

  const tab = parseHomeTab(searchParams.tab);
  const q = normalizeSearchQuery(searchParams.q);

  const onlyMine = seesOnlyOwnDocuments(profile.role);

  const supabase = createClient();
  let query = supabase.from("gr_documents").select("*").is("cancelled_at", null).order("created_at", { ascending: false });

  if (onlyMine) {
    query = query.eq("created_by", profile.id);
  }
  // While searching, list every status together so matching documents are never hidden behind the other tab.
  if (q) {
    // no status filter
  } else if (tab === "completed") {
    query = query.eq("status", "completed");
  } else {
    query = query.in("status", ["in_progress", "pending_sap"]);
  }
  const orExpr = homeSearchOrExpression(q);
  if (orExpr) {
    query = query.or(orExpr);
  }
  // If the search text is exactly an item code in item_master, show that product (with photo) above the results.
  const itemLookup = q
    ? supabase.from("item_master").select("item_code, description, product_category, obsolete").eq("item_code", q).maybeSingle()
    : Promise.resolve({ data: null });
  const [{ data: docs, error }, canceler, { data: item }] = await Promise.all([
    query,
    isDocCanceler(supabase, profile.id),
    itemLookup,
  ]);
  if (error) logger.error("Home page query error", { error: error.message });
  const photos = await cardPhotos(supabase as any, (docs || []).map((d: any) => d.id));

  const inProgress = (docs || []).filter((d: any) => d.status === "in_progress").length;
  const completed = (docs || []).filter((d: any) => d.status === "completed").length;

  return (
    <>
      <TopAppBar
        title={onlyMine ? "งานของฉัน" : "COMETS GR"}
        subtitle={profile.full_name}
        rightSlot={
          <form action="/api/logout" method="post">
            <button className="p-2 rounded-full hover:bg-surface-container-high" title="ออกจากระบบ">
              <Icon name="logout" className="text-primary" />
            </button>
          </form>
        }
      />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">
        <HomeFilters defaultQ={q} defaultTab={tab} />
        {canceler && (
          <Link
            href="/cancel"
            className="self-end inline-flex items-center gap-1 text-xs font-bold text-error border border-error rounded-full px-3 py-1.5"
          >
            <Icon name="block" className="text-base" /> ยกเลิกใบงาน (เลือกหลายใบ)
          </Link>
        )}

        {item && (
          <section className="flex flex-col gap-2">
            <Link href={`/item/${encodeURIComponent(item.item_code)}`} className="card border-l-4 border-primary-container block hover:bg-surface-container-low">
              <span className="section-title flex justify-between">สินค้าตามรหัสที่ค้นหา <span className="normal-case text-primary">ดูหน้าสินค้า ›</span></span>
              <div className="mt-1 text-sm font-bold text-on-surface">{item.item_code}</div>
              <div className="text-xs text-on-surface-variant">{item.description || "-"}</div>
              {item.product_category && <div className="text-[11px] text-outline">{item.product_category}</div>}
              {item.obsolete && <div className="text-[11px] font-bold text-error">Obsolete</div>}
            </Link>
          </section>
        )}

        <section className="grid grid-cols-2 gap-3">
          <Stat
            label={onlyMine ? "ค้างของฉัน" : "In Progress"}
            value={inProgress}
            hint="ยังไม่เสร็จ"
          />
          <Stat
            label={onlyMine ? "เสร็จแล้ว" : "Completed"}
            value={completed}
            hint={onlyMine ? "ของฉัน" : "all time"}
          />
        </section>

        <div className="flex flex-col gap-4 mt-2">
          {q && (
            <p className="text-xs text-outline -mb-2">
              ผลค้นหา &ldquo;{q}&rdquo; ทุกสถานะ ({(docs || []).length} ใบ) — กดที่ใบงานเพื่อดูรายละเอียด
            </p>
          )}
          {(docs || []).length === 0 && (
            <div className="card text-center text-outline py-12 flex flex-col items-center gap-3">
              <Icon name="folder_open" className="text-4xl" />
              <p className="text-sm">{q ? "ไม่พบใบงานที่ตรงกับคำค้นหา" : "ยังไม่มีเอกสารในหมวดนี้"}</p>
              {!q && tab !== "completed" && (
                <Link
                  href="/new"
                  className="btn-filled inline-flex items-center gap-2 mt-2"
                >
                  <Icon name="add" filled />
                  สร้างเอกสารใหม่
                </Link>
              )}
            </div>
          )}
          {(docs || []).map((d: any) => (
            <DocumentCard key={d.id} doc={d} href={`/doc/${d.id}/header`} photo={photos.get(d.id)} />
          ))}
        </div>
      </main>

      <Link href="/new" className="fixed bottom-24 right-6 btn-fab z-30">
        <Icon name="add" filled />
        <span>สร้างเอกสารใหม่</span>
      </Link>

      <BottomNav role={profile.role} />
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="section-title">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-headline font-bold text-primary">{value}</span>
        <span className="text-xs text-on-surface-variant">{hint}</span>
      </div>
    </div>
  );
}
