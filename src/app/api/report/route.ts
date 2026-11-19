import { NextResponse, type NextRequest } from "next/server";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { COL_BY_KEY, fetchReportRows, filterPairs, fmtCell, parseFilters, PRESETS, reportFileBase, summarize, type Row } from "@/lib/report";
import { fetchDocPhotos, issuePhotos, issueText, productPhotos, productSlots } from "@/lib/reportPhotos";
import { autoWidth, buildXlsx, colRef, S, type Cell, type SheetImage } from "@/lib/xlsx";
import sharp from "sharp";

const THUMB = 150; // px, longest side of a picture in the sheet
const MAX_PICS = 400; // keep the file a sane size on very wide date ranges

type Thumb = { data: Buffer; w: number; h: number };

/** Public Supabase Storage URL → small JPEG for embedding, or null if the file is missing. */
async function makeThumb(url: string): Promise<Thumb | null> {
  if (!/^https?:\/\//.test(url)) return null;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    const src = Buffer.from(await r.arrayBuffer());
    const { data, info } = await sharp(src).rotate().resize(THUMB * 2, THUMB * 2, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer({ resolveWithObject: true });
    const k = THUMB / Math.max(info.width, info.height);
    return { data, w: Math.round(info.width * Math.min(1, k)), h: Math.round(info.height * Math.min(1, k)) };
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // pictures are fetched and resized while the file is built

/** GET /api/report?<filters>&format=xlsx|csv — same filters (and photo options) as /report */
export async function GET(req: NextRequest) {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (profile.role === "operator") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const f = parseFilters(sp);
  const supabase = createClient();
  let rows: Row[];
  try {
    rows = await fetchReportRows(supabase as any, f);
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || "Report failed" }, { status: 500 });
  }
  const cols = f.cols.map((k) => COL_BY_KEY[k]).filter(Boolean);
  const base = reportFileBase(f);
  const { data: opt } = await supabase.rpc("report_options");
  const opName = (opt as any)?.operators?.find((o: any) => o.id === f.operator)?.name;
  const pairs = filterPairs(f, { operator: opName });
  const photos = await fetchDocPhotos(supabase as any, rows.map((r) => r.id), { product: f.pphoto !== "none", issues: f.iphoto });

  if (sp.get("format") === "csv") {
    const q = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const origin = req.nextUrl.origin;
    const abs = (u: string) => (u.startsWith("/") ? origin + u : u); // Supabase URLs are already absolute
    const head = cols.map((c) => c.label);
    if (f.pphoto !== "none") head.push("ลิงก์รูปสินค้า");
    if (f.iphoto) head.push("รายละเอียดปัญหา", "ลิงก์รูปปัญหา");
    const lines = [head.map(q).join(",")];
    for (const r of rows) {
      const cells = cols.map((c) => (c.kind === "int" || c.kind === "dec" ? String(c.get(r) ?? "") : fmtCell(c, c.get(r))));
      const d = photos.get(r.id);
      if (f.pphoto !== "none") cells.push(productPhotos(d, f).map(abs).join(" "));
      if (f.iphoto) cells.push(issueText(d), (d?.issues || []).flatMap((i) => i.photos).map(abs).join(" "));
      lines.push(cells.map(q).join(","));
    }
    return new Response("﻿" + lines.join("\r\n") + "\r\n", {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(base)}.csv`,
      },
    });
  }

  // one budget for every picture in the file; the same picture is resized only once
  const cache = new Map<string, Promise<Thumb | null>>();
  let picCount = 0;
  let skipped = 0;
  const thumb = (u: string): Promise<Thumb | null> => {
    const hit = cache.get(u);
    if (hit) return hit;
    if (picCount >= MAX_PICS) {
      skipped++;
      return Promise.resolve(null);
    }
    picCount++;
    const p = makeThumb(u);
    cache.set(u, p);
    return p;
  };

  // ---- Excel: one sheet "ข้อมูล" — exactly the columns / photos / conditions chosen on the page ----
  const s = summarize(rows);
  const title = `COMETS GR — ${PRESETS.find((p) => p.key === f.preset)?.label || "Report"}`;

  // ---- แผ่น "ข้อมูล": เงื่อนไขที่เลือก (ถ้าเลือก) + คอลัมน์ที่เลือก + รูปสินค้า / ปัญหา ----
  const prodLists = rows.map((r) => productSlots(photos.get(r.id), f)); // aligned to the chosen positions
  const issueLists = rows.map((r) => (f.iphoto ? issuePhotos(photos.get(r.id)) : []));
  const nProd = f.pphoto === "none" ? 0 : f.pslots.length;
  const nIssue = f.iphoto ? Math.max(1, ...issueLists.map((l) => l.length)) : 0;
  const nUser = cols.length;
  const totalCols = nUser + nProd + (f.iphoto ? 1 + nIssue : 0);
  const head: Cell[] = cols.map((c) => ({ v: c.label, s: S.header }));
  for (let k = 0; k < nProd; k++) {
    const n = f.pslots[k];
    head.push({ v: nProd === 1 && n === 1 ? "รูปสินค้า ★" : n === 1 ? "รูป 1 ★" : `รูป ${n}`, s: S.header });
  }
  if (f.iphoto) {
    head.push({ v: "รายละเอียดปัญหา", s: S.header });
    for (let k = 0; k < nIssue; k++) head.push({ v: nIssue === 1 ? "รูปปัญหา" : `รูปปัญหา ${k + 1}`, s: S.header });
  }
  const pad = (cells: Cell[], st: number): Cell[] => [...cells, ...Array(Math.max(0, totalCols - cells.length)).fill({ v: "", s: st })];
  const headIdx = 4; // 0-based row of the table header (title · labels · values · blank)
  const images1: SheetImage[] = [];
  const heights1: Record<number, number> = {};
  const [prodThumbs, issueThumbs] = await Promise.all([
    Promise.all(prodLists.map((l) => Promise.all(l.map((u) => (u ? thumb(u) : Promise.resolve(null)))))),
    Promise.all(issueLists.map((l) => Promise.all(l.map(thumb)))),
  ]);
  const dataRows: Cell[][] = rows.map((r, i) => {
    const cells: Cell[] = cols.map((c) => {
      const raw = c.get(r);
      const bad = r.abnormal && (c.key === "abnormal" || c.key === "avg_pcs" || c.key === "avg_carton");
      if (c.kind === "int") return { v: raw as number | null, s: S.int };
      if (c.kind === "dec") return { v: raw as number | null, s: bad ? S.bad : S.dec };
      if (bad) return { v: fmtCell(c, raw), s: S.bad };
      return { v: fmtCell(c, raw), s: S.wrap };
    });
    const ri = headIdx + 1 + i;
    const place = (list: (Thumb | null)[], col0: number) =>
      list.forEach((t, k) => {
        if (t) images1.push({ row: ri, col: col0 + k, data: t.data, ext: "jpeg", w: t.w, h: t.h });
      });
    place(prodThumbs[i], nUser);
    for (let k = 0; k < nProd; k++) cells.push(prodLists[i][k] && !prodThumbs[i][k] ? { v: "ไม่ได้ใส่รูป", s: S.sub } : "");
    if (f.iphoto) {
      cells.push({ v: issueText(photos.get(r.id)), s: S.wrap });
      place(issueThumbs[i], nUser + nProd + 1);
      for (let k = 0; k < nIssue; k++) cells.push(issueLists[i][k] && !issueThumbs[i][k] ? { v: "ไม่ได้ใส่รูป", s: S.sub } : "");
    }
    const hs = [...prodThumbs[i], ...issueThumbs[i]].filter((t): t is Thumb => !!t).map((t) => t.h);
    if (hs.length) heights1[ri] = Math.ceil((Math.max(...hs) + 8) * 0.75);
    return cells;
  });
  const totalRow: Cell[] = pad(
    cols.map((c, i) => {
      if (i === 0) return { v: `รวม ${s.docs.toLocaleString()} ใบงาน`, s: S.total };
      if (c.key === "full_cartons") return { v: s.cartons, s: S.totalInt };
      if (c.key === "total_pcs") return { v: s.pcs, s: S.totalInt };
      if (c.key === "issue_count") return { v: rows.reduce((a, r) => a + (Number(r.issue_count) || 0), 0), s: S.totalInt };
      return { v: "", s: S.total };
    }),
    S.total
  );
  const widths1: Record<number, number> = {};
  for (let k = 0; k < nProd; k++) widths1[nUser + k] = 23;
  if (f.iphoto) {
    widths1[nUser + nProd] = 36;
    for (let k = 0; k < nIssue; k++) widths1[nUser + nProd + 1 + k] = 23;
  }

  const skippedNote = skipped ? ` · ใส่รูปได้สูงสุด ${MAX_PICS} รูปต่อไฟล์ (ไม่ได้ใส่ ${skipped} รูป — ดูในระบบ)` : "";
  // หัวไฟล์: รูปแบบ · ช่วงวันที่ · นับวันที่จาก — แนวนอน แต่ละหัวข้อกินหลายคอลัมน์ (merge) ให้พอกับข้อความ
  const tableRows: Cell[][] = [head, ...dataRows, totalRow];
  const colW = Array.from({ length: totalCols }, (_, ci) => widths1[ci] ?? autoWidth(tableRows, ci));
  const fields: [string, string][] = [
    ["รูปแบบ", pairs.find(([k]) => k === "รูปแบบ")?.[1] || "-"],
    ["ช่วงวันที่", pairs.find(([k]) => k === "ช่วงวันที่")?.[1] || "-"],
    ["นับวันที่จาก", pairs.find(([k]) => k === "นับวันที่จาก")?.[1] || "-"],
  ];
  const labelRow: Cell[] = [];
  const valueRow: Cell[] = [];
  const merges: string[] = [];
  let col = 0;
  for (const [k, v] of fields) {
    const need = Math.max(k.length, v.length * 1.15) + 4;
    const start = col;
    let w = 0;
    do w += colW[col++] ?? 12; while (w < need && col < Math.max(totalCols, start + 1) + 6);
    for (let c = start; c < col; c++) {
      labelRow[c] = { v: c === start ? k : "", s: S.hdrKey };
      valueRow[c] = { v: c === start ? v : "", s: S.hdrVal };
    }
    if (col - start > 1) merges.push(`${colRef(start)}2:${colRef(col - 1)}2`, `${colRef(start)}3:${colRef(col - 1)}3`);
  }
  for (let c = col; c < totalCols; c++) {
    labelRow[c] = { v: "", s: S.hdrKey };
    valueRow[c] = { v: "", s: S.hdrVal };
  }
  const sheet1 = {
    name: "ข้อมูล",
    rows: [[{ v: title, s: S.title }], labelRow, valueRow, [{ v: skippedNote.replace(/^ · /, ""), s: S.sub }], ...tableRows],
    filter: { headerRow: headIdx + 1, lastRow: headIdx + 1 + dataRows.length, cols: totalCols },
    colWidths: Object.fromEntries(colW.map((w, i) => [i, w])),
    rowHeights: { ...heights1, 1: 16, 2: 22 },
    merges,
    images: images1,
  };

  const buf = buildXlsx([sheet1]);
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(base)}.xlsx`,
    },
  });
}
