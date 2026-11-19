"use client";
import { useEffect, useState } from "react";

/** Paper choices for the print view. Width/height in mm (portrait). */
const PAPERS = [
  { key: "a4l", label: "A4 แนวนอน", size: "A4 landscape", w: 297 },
  { key: "a4p", label: "A4 แนวตั้ง", size: "A4 portrait", w: 210 },
  { key: "a3l", label: "A3 แนวนอน", size: "A3 landscape", w: 420 },
  { key: "a3p", label: "A3 แนวตั้ง", size: "A3 portrait", w: 297 },
] as const;
type PaperKey = (typeof PAPERS)[number]["key"];
const MARGIN_MM = 10;
const PX_PER_MM = 96 / 25.4;
const STORE = "comets-gr-report-paper";

/**
 * Paper picker + fit-to-width for the report print page.
 * The sheet is laid out at its natural width, then zoomed down so it always fits the
 * printable width of the chosen paper (never zoomed up). Prints with the matching @page size.
 */
export function AutoPrint() {
  const [paper, setPaper] = useState<PaperKey>("a4l");
  const [scale, setScale] = useState(1);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE) as PaperKey | null;
      if (saved && PAPERS.some((p) => p.key === saved)) setPaper(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const p = PAPERS.find((x) => x.key === paper)!;
    let style = document.getElementById("report-page-size") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "report-page-size";
      document.head.appendChild(style);
    }
    style.textContent = `@page { size: ${p.size}; margin: ${MARGIN_MM}mm; }`;

    const sheet = document.getElementById("report-sheet");
    const table = sheet?.querySelector("table");
    if (!sheet || !table) return;
    const printable = Math.floor((p.w - MARGIN_MM * 2) * PX_PER_MM);
    (sheet.style as any).zoom = "1";
    sheet.style.width = `${printable}px`;
    const need = Math.max(printable, Math.ceil(table.scrollWidth));
    sheet.style.width = `${need}px`;
    const z = Math.min(1, printable / need);
    (sheet.style as any).zoom = String(z);
    setScale(z);
  }, [paper]);

  function choose(k: PaperKey) {
    setPaper(k);
    try {
      localStorage.setItem(STORE, k);
    } catch {}
  }

  return (
    <div className="no-print sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-[#fff8ec] border border-[#ffb95f] px-4 py-2 text-sm">
      <span className="font-bold text-[#5c3800]">ขนาดกระดาษ</span>
      {PAPERS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => choose(p.key)}
          className={
            "rounded-full px-3 py-1 border text-xs font-bold transition " +
            (paper === p.key ? "bg-[#000080] text-white border-[#000080]" : "bg-white text-[#000080] border-[#c6c5d5] hover:border-[#000080]")
          }
        >
          {p.label}
        </button>
      ))}
      <span className="text-xs text-[#5c3800]">
        {scale < 1 ? `ย่อเหลือ ${Math.round(scale * 100)}% ให้พอดีกระดาษ` : "พอดีกระดาษ ไม่ต้องย่อ"}
        {scale < 0.6 ? " · ตัวหนังสือจะเล็ก ลองเลือกกระดาษใหญ่ขึ้น หรือลดคอลัมน์" : ""}
      </span>
      <button
        type="button"
        onClick={() => window.print()}
        className="ml-auto rounded-xl bg-[#000080] text-white px-4 py-2 text-sm font-bold"
      >
        พิมพ์ / บันทึกเป็น PDF
      </button>
    </div>
  );
}
