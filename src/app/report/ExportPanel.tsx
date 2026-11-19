"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { photoChoiceText, type PhotoMode } from "@/lib/report";
import type { PhotoCounts } from "@/lib/reportPhotos";

export type ExportKind = "xlsx" | "pdf" | "csv";
export interface ExportInfo {
  q: string; // the applied filters as a query string
  title: string;
  rows: number;
  pairs: [string, string][];
  colLabels: string[];
  pphoto: PhotoMode;
  pslots: number[];
  iphoto: boolean;
  counts: PhotoCounts;
  sampleProd: string[]; // small image urls
  sampleIssue: string[];
  sample: { wh: string; code: string; pcs: string; prod: string | null; issue: string | null; issueText: string }[];
}

const KIND_LABEL: Record<ExportKind, string> = { xlsx: "Excel", pdf: "PDF", csv: "CSV" };

function fmtSize(kb: number) {
  return kb < 1000 ? `${Math.max(1, Math.round(kb))} KB` : `${(kb / 1024).toFixed(1)} MB`;
}
/** Rough, labelled as an estimate in the UI. */
function estimate(kind: ExportKind, e: ExportInfo): string {
  const pics = e.counts.prodPics + e.counts.issuePics;
  const extraCols = (e.pphoto !== "none" ? 1 : 0) + (e.iphoto ? 2 : 0);
  if (kind === "csv") return fmtSize((e.rows * ((e.colLabels.length + extraCols) * 14 + (e.pphoto !== "none" || e.iphoto ? 90 : 0))) / 1024);
  if (kind === "pdf") {
    const perPage = e.pphoto !== "none" || e.iphoto ? 14 : 28;
    return `${Math.max(1, Math.ceil(e.rows / perPage))} หน้า (A4 แนวนอน)`;
  }
  // ~9 KB per embedded picture
  return fmtSize(15 + e.rows * e.colLabels.length * 0.02 + pics * 9);
}

/** Miniature of the file the user will get, per format. */
export function MiniFile({ kind, e }: { kind: ExportKind; e: ExportInfo }) {
  // Excel always carries รูปแบบ · ช่วงวันที่ · นับวันที่จาก in its header; PDF shows its conditions box only when chosen
  const condChips = kind === "csv" ? [] : e.pairs.slice(0, 3); // Excel & PDF headers: รูปแบบ · ช่วงวันที่ · นับวันที่จาก
  const Img = ({ src }: { src: string | null }) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="w-7 h-7 rounded object-cover" />
    ) : (
      <span className="block w-7 h-7" />
    );
  if (kind === "csv") {
    const head = ["WH No.", "Item Code", "ชิ้นรวม", ...(e.pphoto !== "none" ? ["ลิงก์รูปสินค้า"] : []), ...(e.iphoto ? ["รายละเอียดปัญหา", "ลิงก์รูปปัญหา"] : [])];
    return (
      <div className="rounded-xl border border-outline-variant/40 overflow-hidden bg-white shadow-sm">
        <div className="bg-surface-container-low px-3 py-1.5 text-[11px] font-bold text-primary flex items-center gap-1">
          <Icon name="description" className="text-sm" /> {e.title}.csv
        </div>
        <pre className="m-0 p-3 text-[10px] leading-relaxed font-mono whitespace-pre-wrap break-all text-on-surface">
          <b>{head.join(",")}</b>
          {"\n"}
          {e.sample
            .map((r) =>
              [r.wh, r.code, r.pcs.replace(/,/g, ""), ...(e.pphoto !== "none" ? [r.prod ? "http://…/item/1.jpg" : ""] : []), ...(e.iphoto ? [r.issueText, r.issue ? "http://…/issues/1.jpg" : ""] : [])].join(",")
            )
            .join("\n")}
        </pre>
      </div>
    );
  }
  const pdf = kind === "pdf";
  return (
    <div className="rounded-xl border border-outline-variant/40 overflow-hidden bg-white shadow-sm text-[10px]">
      <div className={`px-3 py-1.5 font-bold flex items-center gap-1.5 ${pdf ? "bg-[#ffe9e7] text-[#93000a]" : "bg-[#1e6b3f] text-white"}`}>
        <Icon name={pdf ? "picture_as_pdf" : "table_view"} className="text-sm" />
        {e.title}.{pdf ? "pdf" : "xlsx"}
      </div>
      <div className="p-2.5">
        <div className="font-extrabold text-primary-container text-[11px]">COMETS GR — {e.title.split("_")[1] || "Report"}</div>
        {condChips.length > 0 && (
          <div className="flex flex-wrap gap-1 my-1.5">
            {condChips.map(([k, v]) => (
              <span key={k} className="bg-[#fff4e2] text-[#5c3800] rounded px-1.5">
                <b>{k}</b> {v}
              </span>
            ))}
          </div>
        )}
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-primary-container text-white">
              {e.pphoto !== "none" && pdf && <th className="text-left px-1 py-0.5 font-semibold">รูป</th>}
              <th className="text-left px-1 py-0.5 font-semibold">WH No.</th>
              <th className="text-left px-1 py-0.5 font-semibold">Item</th>
              <th className="text-right px-1 py-0.5 font-semibold">ชิ้น</th>
              {e.pphoto !== "none" && !pdf && <th className="text-left px-1 py-0.5 font-semibold">รูปสินค้า</th>}
              {e.iphoto && <th className="text-left px-1 py-0.5 font-semibold">รูปปัญหา</th>}
            </tr>
          </thead>
          <tbody>
            {e.sample.map((r) => (
              <tr key={r.wh} className="border-b border-outline-variant/20">
                {e.pphoto !== "none" && pdf && (
                  <td className="px-1 py-0.5">
                    <Img src={r.prod} />
                  </td>
                )}
                <td className="px-1 py-0.5 whitespace-nowrap">{r.wh}</td>
                <td className="px-1 py-0.5">{r.code}</td>
                <td className="px-1 py-0.5 text-right">{r.pcs}</td>
                {e.pphoto !== "none" && !pdf && (
                  <td className="px-1 py-0.5">
                    <Img src={r.prod} />
                  </td>
                )}
                {e.iphoto && (
                  <td className="px-1 py-0.5">
                    <Img src={r.issue} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!pdf && (
        <div className="flex gap-0.5 bg-[#f0f0f0] px-1.5 pt-1 text-[9.5px] text-[#666]">
          {["ข้อมูล"].map((t, i) => (
            <span key={t} className={`px-2 py-0.5 rounded-t ${i === 0 ? "bg-white text-[#1e6b3f] font-bold" : ""}`}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** PDF / CSV / Excel buttons — each opens the confirm dialog first. */
export function ExportButtons({ e }: { e: ExportInfo }) {
  const [kind, setKind] = useState<ExportKind | null>(null);
  const dlRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!kind) return;
    dlRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setKind(null);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [kind]);

  function download(k: ExportKind) {
    if (k === "pdf") window.open(`/report/print?${e.q}`, "_blank");
    else {
      const a = document.createElement("a");
      a.href = `/api/report?${e.q}&format=${k}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setKind(null);
  }

  const disabled = e.rows === 0;
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setKind("pdf")} className="btn-secondary h-10 px-4 text-xs inline-flex items-center gap-1 disabled:opacity-50">
        <Icon name="picture_as_pdf" className="text-base" /> PDF
      </button>
      <button type="button" disabled={disabled} onClick={() => setKind("csv")} className="btn-secondary h-10 px-4 text-xs inline-flex items-center disabled:opacity-50">
        CSV
      </button>
      <button type="button" disabled={disabled} onClick={() => setKind("xlsx")} className="btn-primary h-10 px-4 text-xs inline-flex items-center gap-1 disabled:opacity-50">
        <Icon name="download" className="text-base" /> Excel
      </button>

      {kind && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="export-title">
          <div className="absolute inset-0 bg-[#000028]/40" onClick={() => setKind(null)} />
          <div className="relative bg-white w-full sm:w-[min(980px,94vw)] max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-[0_24px_60px_rgba(0,0,40,0.3)]">
            <div className="flex items-start px-5 sm:px-6 py-4 border-b border-outline-variant/30 sticky top-0 bg-white z-10">
              <div>
                <div id="export-title" className="font-headline font-extrabold text-lg text-primary">
                  ตรวจก่อนดาวน์โหลด {KIND_LABEL[kind]}
                </div>
                <div className="text-xs text-outline">
                  ข้อมูล {e.rows.toLocaleString()} ใบงาน · {e.pairs[1]?.[1]}
                </div>
              </div>
              <button type="button" onClick={() => setKind(null)} className="ml-auto w-9 h-9 rounded-full hover:bg-surface-container-low flex items-center justify-center text-outline" aria-label="ปิด">
                <Icon name="close" />
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr] px-5 sm:px-6 py-4">
              <div>
                <div className="text-[11px] font-bold text-outline mb-1.5">เงื่อนไขที่เลือก</div>
                <dl className="grid grid-cols-[120px_1fr] sm:grid-cols-[150px_1fr] text-[12.5px] border border-outline-variant/40 rounded-xl overflow-hidden m-0">
                  {e.pairs.map(([k, v], i) => (
                    <div key={k} className="contents">
                      <dt className={`px-3 py-1.5 bg-surface-container-low text-outline ${i ? "border-t border-outline-variant/20" : ""}`}>{k}</dt>
                      <dd className={`m-0 px-3 py-1.5 font-semibold ${i ? "border-t border-outline-variant/20" : ""}`}>{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="text-[11px] font-bold text-outline mt-3 mb-1.5">คอลัมน์ที่จะออก ({e.colLabels.length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {e.colLabels.map((c) => (
                    <span key={c} className="bg-primary-fixed text-primary-container rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold">
                      {c}
                    </span>
                  ))}
                </div>

                <div className="text-[11px] font-bold text-outline mt-3 mb-1.5">รูปในไฟล์</div>
                <div className="flex flex-col gap-2">
                  <PicRow
                    icon="star"
                    title={`รูปสินค้า (${photoChoiceText(e)})`}
                    sub={
                      e.pphoto === "none"
                        ? "ไม่ใส่รูปสินค้า"
                        : `${e.counts.prodPics.toLocaleString()} รูป จาก ${e.counts.prodDocs.toLocaleString()} ใบงาน · อีก ${(e.rows - e.counts.prodDocs).toLocaleString()} ใบยังไม่มีรูป`
                    }
                    pics={e.pphoto === "none" ? [] : e.sampleProd}
                    more={e.counts.prodPics - e.sampleProd.length}
                  />
                  <PicRow
                    icon="report"
                    title="รูปปัญหา"
                    sub={e.iphoto ? `${e.counts.issuePics.toLocaleString()} รูป จาก ${e.counts.issueCount.toLocaleString()} ปัญหา` : "ไม่ใส่รูปปัญหา"}
                    pics={e.iphoto ? e.sampleIssue : []}
                    more={e.counts.issuePics - e.sampleIssue.length}
                  />
                </div>
                {kind === "csv" && (e.pphoto !== "none" || e.iphoto) && <p className="text-[11px] text-outline mt-2">CSV ใส่รูปไม่ได้ — รูปจะเป็นลิงก์แทน</p>}
              </div>

              <div>
                <div className="text-[11px] font-bold text-outline mb-1.5">ตัวอย่างไฟล์</div>
                <MiniFile kind={kind} e={e} />
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[
                    ["รูปแบบ", kind === "xlsx" ? "Excel · 1 แผ่น" : kind === "pdf" ? "PDF (หน้าพิมพ์)" : "CSV"],
                    ["แถวข้อมูล", e.rows.toLocaleString()],
                    ["รูปทั้งหมด", kind === "csv" ? "เป็นลิงก์" : (e.counts.prodPics + e.counts.issuePics).toLocaleString()],
                    [kind === "pdf" ? "ความยาวประมาณ" : "ขนาดประมาณ", estimate(kind, e)],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-surface-container-low rounded-xl px-3 py-2">
                      <div className="text-[10.5px] text-outline">{k}</div>
                      <div className="text-sm font-bold text-primary">{v}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-outline mt-3">ถ้าแก้เงื่อนไขทางซ้ายแล้วยังไม่ได้กด &ldquo;แสดงผล&rdquo; ไฟล์จะใช้เงื่อนไขตามที่แสดงในหน้านี้</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 sm:px-6 py-3.5 border-t border-outline-variant/30 bg-surface sticky bottom-0">
              <button type="button" onClick={() => setKind(null)} className="btn-secondary h-11 px-4 text-sm inline-flex items-center gap-1.5">
                <Icon name="tune" className="text-base" /> แก้ไขเงื่อนไข
              </button>
              <button ref={dlRef} type="button" onClick={() => download(kind)} className="btn-primary h-11 px-5 text-sm inline-flex items-center gap-1.5">
                <Icon name="download" className="text-base" /> {kind === "pdf" ? "เปิดหน้าพิมพ์ PDF" : `ดาวน์โหลด ${KIND_LABEL[kind]}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PicRow({ icon, title, sub, pics, more }: { icon: string; title: string; sub: string; pics: string[]; more: number }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] gap-2.5 items-center border border-outline-variant/40 rounded-xl px-3 py-2">
      <Icon name={icon} className="text-base text-[#9a5c00]" />
      <div className="min-w-0">
        <div className="text-[12.5px] font-bold">{title}</div>
        <div className="text-[11px] text-outline">{sub}</div>
      </div>
      <div className="flex gap-1 items-center">
        {pics.map((u) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={u} src={u} alt="" className="w-9 h-9 rounded-lg object-cover" />
        ))}
        {more > 0 && <span className="text-[11px] font-bold text-outline pl-0.5">+{more}</span>}
      </div>
    </div>
  );
}
