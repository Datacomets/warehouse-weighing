import { redirect } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { COL_BY_KEY, describeFilters, fetchReportRows, filterPairs, fmtCell, parseFilters, PRESETS, summarize, toSP } from "@/lib/report";
import { fetchDocPhotos, issuePhotos, issueText, productPhotos, thumbUrl } from "@/lib/reportPhotos";
import { AutoPrint } from "./AutoPrint";

export const dynamic = "force-dynamic";

const WRAP = ["description", "supplier", "issue_types", "remarks", "skips", "unlock_reason"];

/** Print-ready page → browser "Save as PDF". Same filters and photo options as /report. */
export default async function ReportPrint({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");
  if (profile.role === "operator") redirect("/home");
  const supabase = createClient();
  const f = parseFilters(toSP(searchParams));
  const [rows, { data: opt }] = await Promise.all([fetchReportRows(supabase as any, f), supabase.rpc("report_options")]);
  const s = summarize(rows);
  const cols = f.cols.map((k) => COL_BY_KEY[k]).filter(Boolean);
  const opName = (opt as any)?.operators?.find((o: any) => o.id === f.operator)?.name;
  const title = `COMETS GR — ${PRESETS.find((p) => p.key === f.preset)?.label || "Report"}`;
  const now = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 16).replace("T", " ");
  const photos = f.pphoto !== "none" || f.iphoto ? await fetchDocPhotos(supabase as any, rows.map((r) => r.id), { product: f.pphoto !== "none", issues: f.iphoto }) : new Map();
  const showProd = f.pphoto !== "none";
  const pairs = filterPairs(f, { operator: opName });

  return (
    <div className="report-print text-[#1b1b21] p-6">
      <style>{`
        @media screen { .report-print { background:#e9eaf0; min-height:100vh } #report-sheet { background:#fff; box-shadow:0 8px 28px rgba(0,0,40,.12); padding:16px; margin:0 auto; box-sizing:content-box } }
        @media print { .no-print { display:none !important } body { background:#fff !important } .report-print { padding:0 } #report-sheet { padding:0; margin:0 } }
        .report-print td, .report-print th { white-space: nowrap }
        .report-print td.wrap { white-space: normal; min-width: 180px; max-width: 320px }
        .report-print table { border-collapse: collapse; width: 100%; font-size: 10px }
        .report-print th { background:#000080; color:#fff; text-align:left; padding:4px 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact }
        .report-print td { padding:3px 6px; border-bottom:1px solid #e6e6ee; vertical-align: middle }
        .report-print tr { break-inside: avoid }
        .report-print thead { display: table-header-group }
        .report-print .pics { display:flex; gap:3px }
        .report-print .pics img { width:44px; height:44px; object-fit:cover; border-radius:4px; display:block }
        .report-print .hdr { display:flex; gap:28px; background:#fff4e2; border-radius:8px; padding:7px 12px; margin-bottom:12px; -webkit-print-color-adjust: exact; print-color-adjust: exact }
        .report-print .hdr span { display:block; font-size:9px; color:#666 }
        .report-print .hdr b { font-size:12px; color:#000080 }
      `}</style>
      <AutoPrint />
      <div id="report-sheet">
        <h1 className="text-xl font-bold text-[#000080]">{title}</h1>
        <p className="text-[11px] text-[#666] mb-3">
          {describeFilters(f, { operator: opName }).join(" · ")} · ดึงโดย {profile.full_name} · {now}
        </p>
        <div className="grid grid-cols-5 gap-2 mb-3">
          {[
            [s.docs, "ใบงาน"],
            [s.cartons, "ลังเต็ม"],
            [s.pcs, "ชิ้นรวม"],
            [s.issueDocs, "ใบที่มีปัญหา"],
            [s.abnormal, "น้ำหนักผิดปกติ"],
          ].map(([v, l]) => (
            <div key={String(l)} className="border border-[#e3e3ec] rounded-lg px-3 py-2">
              <div className="text-lg font-bold text-[#000080]">{Number(v).toLocaleString()}</div>
              <div className="text-[10px] text-[#666]">{l}</div>
            </div>
          ))}
        </div>
        <div className="hdr">
          {pairs.slice(0, 3).map(([k, v]) => (
            <div key={k}>
              <span>{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
        <table>
          <thead>
            <tr>
              {showProd && <th>รูปสินค้า</th>}
              {cols.map((c) => (
                <th key={c.key} style={{ textAlign: c.kind === "int" || c.kind === "dec" ? "right" : "left" }}>
                  {c.label}
                </th>
              ))}
              {f.iphoto && <th>รายละเอียดปัญหา</th>}
              {f.iphoto && <th>รูปปัญหา</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = photos.get(r.id);
              const prod = productPhotos(d, f);
              const iss = f.iphoto ? issuePhotos(d) : [];
              return (
                <tr key={r.id}>
                  {showProd && (
                    <td>
                      <div className="pics">
                        {prod.map((u) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={u} src={thumbUrl(u, 120)} alt="" width={44} height={44} />
                        ))}
                      </div>
                    </td>
                  )}
                  {cols.map((c) => (
                    <td key={c.key} className={WRAP.includes(c.key) ? "wrap" : undefined} style={{ textAlign: c.kind === "int" || c.kind === "dec" ? "right" : "left", color: r.abnormal && c.key === "abnormal" ? "#ba1a1a" : undefined }}>
                      {fmtCell(c, c.get(r))}
                    </td>
                  ))}
                  {f.iphoto && <td className="wrap">{issueText(d)}</td>}
                  {f.iphoto && (
                    <td>
                      <div className="pics">
                        {iss.map((u) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={u} src={thumbUrl(u, 120)} alt="" width={44} height={44} />
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            <tr style={{ background: "#fff4e2", fontWeight: 700 }}>
              {showProd && <td />}
              {cols.map((c, i) => (
                <td key={c.key} style={{ textAlign: c.kind === "int" ? "right" : "left" }}>
                  {i === 0 ? `รวม ${s.docs.toLocaleString()} ใบ` : c.key === "full_cartons" ? s.cartons.toLocaleString() : c.key === "total_pcs" ? s.pcs.toLocaleString() : ""}
                </td>
              ))}
              {f.iphoto && <td />}
              {f.iphoto && <td />}
            </tr>
          </tbody>
        </table>
        <p className="text-[9px] text-[#999] mt-3">COMETS GR · พิมพ์ {now} · น้ำหนักผิดปกติ = ค่าชั่งต่างจากค่าเฉลี่ยของกลุ่มเกิน 10%</p>
      </div>
    </div>
  );
}
