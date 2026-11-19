import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { BottomNav } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { ReportForm, type ReportOptions } from "./ReportForm";
import { canAccessAdminQueue } from "@/lib/permissions";
import { COL_BY_KEY, fetchReportRows, filterPairs, fmtCell, parseFilters, reportFileBase, summarize, toQuery, toSP } from "@/lib/report";
import { countPhotos, fetchDocPhotos, issuePhotos, issueText, productPhotos, thumbUrl } from "@/lib/reportPhotos";
import type { ExportInfo } from "./ExportPanel";

export const dynamic = "force-dynamic";
const PREVIEW = 50;

export default async function ReportPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");
  if (profile.role === "operator") redirect("/home");

  const supabase = createClient();
  const f = parseFilters(toSP(searchParams));
  const [{ data: opt }, rowsOrErr, { data: lv }] = await Promise.all([
    supabase.rpc("report_options"),
    fetchReportRows(supabase as any, f).catch((e: Error) => e),
    supabase.from("log_viewers").select("user_id").eq("user_id", profile.id).maybeSingle(),
  ]);
  const options = (opt as ReportOptions) || { categories: [], suppliers: [], operators: [] };
  const err = rowsOrErr instanceof Error ? rowsOrErr.message : null;
  const rows = rowsOrErr instanceof Error ? [] : rowsOrErr;
  const s = summarize(rows);
  const cols = f.cols.map((k) => COL_BY_KEY[k]).filter(Boolean);
  const q = toQuery(f);
  const canSeeCancelled = profile.role === "admin" || profile.role === "admin_wh" || !!lv;
  const opName = options.operators.find((o) => o.id === f.operator)?.name;
  // photos: counts for the whole result, thumbnails for the preview rows and the dialog
  const ids = rows.map((r) => r.id);
  const photos = await fetchDocPhotos(supabase as any, ids, { product: true, issues: true });
  const counts = countPhotos(ids, photos, f);
  const prodOf = (id: string) => productPhotos(photos.get(id), f);
  const issOf = (id: string) => (f.iphoto ? issuePhotos(photos.get(id)) : []);
  const withProd = rows.filter((r) => prodOf(r.id).length);
  const withIssue = rows.filter((r) => issOf(r.id).length);
  const sampleRows = [...withProd.slice(0, 2), ...withIssue.filter((r) => !withProd.slice(0, 2).includes(r)).slice(0, 1)];
  for (const r of rows) if (sampleRows.length < 3 && !sampleRows.includes(r)) sampleRows.push(r);
  const pcsCol = COL_BY_KEY["total_pcs"];
  const info: ExportInfo = {
    q,
    title: reportFileBase(f),
    rows: rows.length,
    pairs: filterPairs(f, { operator: opName }),
    colLabels: cols.map((c) => c.label),
    pphoto: f.pphoto,
    pslots: f.pslots,
    iphoto: f.iphoto,
    counts,
    sampleProd: withProd.slice(0, 4).map((r) => thumbUrl(prodOf(r.id)[0], 96)),
    sampleIssue: withIssue.slice(0, 3).map((r) => thumbUrl(issOf(r.id)[0], 96)),
    sample: sampleRows.slice(0, 3).map((r) => ({
      wh: r.wh_number || "",
      code: r.item_code || "",
      pcs: fmtCell(pcsCol, pcsCol.get(r)) || "0",
      prod: prodOf(r.id)[0] ? thumbUrl(prodOf(r.id)[0], 96) : null,
      issue: issOf(r.id)[0] ? thumbUrl(issOf(r.id)[0], 96) : null,
      issueText: f.iphoto ? issueText(photos.get(r.id)) : "",
    })),
  };
  const showProd = f.pphoto !== "none";
  const docHref = (id: string) => (canAccessAdminQueue(profile.role) ? `/admin/${id}` : `/doc/${id}/header`);

  return (
    <>
      <TopAppBar title="Report" subtitle="เลือกเงื่อนไข · ดาวน์โหลด" showBack />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-3 max-w-[1500px] mx-auto w-full">
        <ReportForm
          initial={f}
          options={options}
          canSeeCancelled={canSeeCancelled}
          counts={counts}
          summary={{ docs: s.docs, cartons: s.cartons, pcs: s.pcs, issueDocs: s.issueDocs }}
          info={info}
        />

        <section className="flex flex-col gap-3 min-w-0">
          {err && <div className="card bg-error-container text-on-error-container text-sm">ดึงข้อมูลไม่สำเร็จ: {err}</div>}

          {rows.length > 0 && (
            <div className="sm:hidden flex flex-col gap-2">
              {rows.slice(0, PREVIEW).map((r) => (
                <Link key={r.id} href={docHref(r.id)} className="card py-2.5 px-3 flex items-center gap-3">
                  {showProd && <Thumbs urls={prodOf(r.id)} />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-primary text-sm">{r.wh_number}</span>
                    <span className="block text-xs text-outline truncate">
                      {r.item_code} · {Number(r.total_pcs || 0).toLocaleString()} ชิ้น
                    </span>
                  </span>
                  {f.iphoto && <IssueCell issues={photos.get(r.id)?.issues.map((i) => i.type) || []} title={issueText(photos.get(r.id))} urls={[]} />}
                </Link>
              ))}
            </div>
          )}

          <div className={`card p-0 overflow-x-auto ${rows.length ? "hidden sm:block" : ""}`}>
            {rows.length === 0 ? (
              <p className="text-sm text-outline text-center py-10">ไม่มีข้อมูลตามเงื่อนไขนี้ — ลองขยายช่วงวันที่หรือเอาเงื่อนไขออก</p>
            ) : (
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr>
                    {showProd && <th className="bg-surface-container text-primary font-bold px-3 py-2 text-left whitespace-nowrap">รูป</th>}
                    {cols.map((c) => (
                      <th key={c.key} className={`bg-surface-container text-primary font-bold px-3 py-2 whitespace-nowrap ${c.kind === "int" || c.kind === "dec" ? "text-right" : "text-left"}`}>
                        {c.label}
                      </th>
                    ))}
                    {f.iphoto && <th className="bg-surface-container text-primary font-bold px-3 py-2 text-left whitespace-nowrap">ปัญหา</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW).map((r) => (
                    <tr key={r.id} className="border-t border-outline-variant/20 hover:bg-surface-container-low">
                      {showProd && (
                        <td className="px-3 py-1">
                          <Thumbs urls={prodOf(r.id)} />
                        </td>
                      )}
                      {cols.map((c) => {
                        const v = fmtCell(c, c.get(r));
                        const right = c.kind === "int" || c.kind === "dec";
                        const bad = r.abnormal && (c.key === "abnormal" || c.key === "avg_pcs" || c.key === "avg_carton" || c.key === "minmax");
                        return (
                          <td key={c.key} className={`px-3 py-1.5 whitespace-nowrap max-w-[260px] truncate ${right ? "text-right" : ""} ${bad ? "bg-error-container/50 text-error font-bold" : ""}`}>
                            {c.key === "wh_number" ? (
                              <Link href={docHref(r.id)} className="text-primary font-semibold hover:underline">
                                {v}
                              </Link>
                            ) : (
                              v
                            )}
                          </td>
                        );
                      })}
                      {f.iphoto && (
                        <td className="px-3 py-1">
                          <IssueCell issues={photos.get(r.id)?.issues.map((i) => i.type) || []} title={issueText(photos.get(r.id))} urls={issOf(r.id)} />
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-[#fff4e2] font-bold border-t-2 border-tertiary-fixed-dim">
                    {showProd && <td />}
                    {cols.map((c, i) => (
                      <td key={c.key} className={`px-3 py-1.5 whitespace-nowrap ${c.kind === "int" ? "text-right" : ""}`}>
                        {i === 0
                          ? `รวม ${s.docs.toLocaleString()} ใบ`
                          : c.key === "full_cartons"
                            ? s.cartons.toLocaleString()
                            : c.key === "total_pcs"
                              ? s.pcs.toLocaleString()
                              : c.key === "issue_count"
                                ? rows.reduce((a, r) => a + (Number(r.issue_count) || 0), 0).toLocaleString()
                                : ""}
                      </td>
                    ))}
                    {f.iphoto && <td />}
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          <p className="text-[11px] text-outline">
            แสดง {Math.min(PREVIEW, rows.length)} แถวแรก จาก {rows.length.toLocaleString()} · น้ำหนักผิดปกติ {s.abnormal} ใบ · Lead Time เฉลี่ย {s.avgLead} · กด PDF / CSV / Excel แล้วจะมีหน้าให้ตรวจก่อนดาวน์โหลด · ไฟล์ Excel มีแผ่นเดียว ตามคอลัมน์และรูปที่เลือก · น้ำหนักผิดปกติ = มีค่าชั่งต่างจากค่าเฉลี่ยของกลุ่มเกิน 10% · กด WH No. เพื่อเปิดใบงาน
          </p>
        </section>
      </main>
      <BottomNav role={profile.role} />
    </>
  );
}

/** First picture of a list as a small square, with "+n" when there are more. */
function Thumbs({ urls }: { urls: string[] }) {
  if (!urls.length)
    return (
      <span className="w-9 h-9 rounded-lg bg-surface-container-low inline-flex items-center justify-center text-outline-variant" title="ไม่มีรูป">
        <Icon name="hide_image" className="text-base" />
      </span>
    );
  return (
    <span className="relative inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumbUrl(urls[0], 96)} alt="" className="w-9 h-9 rounded-lg object-cover block" loading="lazy" />
      {urls.length > 1 && <span className="absolute -right-1.5 -bottom-1 bg-primary-container text-white text-[9px] font-bold rounded-full px-1">+{urls.length - 1}</span>}
    </span>
  );
}

function IssueCell({ issues, title, urls }: { issues: string[]; title: string; urls: string[] }) {
  if (!issues.length) return <span className="text-outline">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="bg-error-container text-on-error-container text-[10.5px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap" title={title}>
        {issues[0]}
        {issues.length > 1 ? ` +${issues.length - 1}` : ""}
      </span>
      {urls.length > 0 && <Thumbs urls={urls} />}
    </span>
  );
}
