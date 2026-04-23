"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";
import { SectionHeader } from "@/components/Field";
import { useConfirm } from "@/components/ConfirmDialog";
import { translateSupabaseError } from "@/lib/supabaseError";

interface ItemRow {
  item_code: string;
  description: string;
  product_category: string | null;
  purchased: boolean;
  in_house_production: boolean;
  obsolete: boolean;
  source_updated_at?: string | null;
}

const CHUNK_SIZE = 500;

export function ItemsAdmin({ initialItems }: { initialItems: ItemRow[] }) {
  const router = useRouter();
  const supabase = createClient();
  const { confirm, DialogElement } = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<ItemRow[]>(initialItems);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items.slice(0, 500);
    return items
      .filter(
        (it) =>
          it.item_code.toLowerCase().includes(t) ||
          it.description.toLowerCase().includes(t) ||
          (it.product_category || "").toLowerCase().includes(t)
      )
      .slice(0, 500);
  }, [items, q]);

  async function handleFile(file: File) {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error("ไฟล์ว่างเปล่าหรืออ่านไม่ได้");

      const header = rows[0].map((h) => h.trim().toLowerCase());
      const colIdx = (...names: string[]) =>
        header.findIndex((h) => names.some((n) => h === n.toLowerCase()));

      const iCode = colIdx("material id", "item_code", "item code");
      const iDesc = colIdx("material description", "description");
      const iCat = colIdx("product category description", "product_category", "category");
      const iPurch = colIdx("purchased", "purchased?");
      const iProd = colIdx("in-house production", "in_house_production", "in house production");

      if (iCode < 0 || iDesc < 0) {
        throw new Error(
          'ไม่พบคอลัมน์ "Material ID" หรือ "Material Description" — กรุณาตรวจสอบ header ของไฟล์'
        );
      }

      const records: ItemRow[] = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;
        const code = (row[iCode] || "").trim();
        const desc = (row[iDesc] || "").trim();
        if (!code || !desc) continue;
        records.push({
          item_code: code,
          description: desc,
          product_category: iCat >= 0 ? (row[iCat] || "").trim() || null : null,
          purchased: iPurch >= 0 ? toBool(row[iPurch]) : false,
          in_house_production: iProd >= 0 ? toBool(row[iProd]) : false,
          obsolete: /\*?\s*obsolete/i.test(desc),
        });
      }

      if (records.length === 0) throw new Error("ไม่มีแถวข้อมูลที่อ่านได้");

      // Upsert in chunks to avoid request size limits
      let done = 0;
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
          .from("item_master")
          .upsert(chunk, { onConflict: "item_code" });
        if (error) throw new Error(error.message);
        done += chunk.length;
        setMsg(`กำลัง upload... ${done.toLocaleString()} / ${records.length.toLocaleString()}`);
      }

      setMsg(`อัปโหลดสำเร็จ ${records.length.toLocaleString()} รายการ`);
      router.refresh();
      // Refetch locally so the table updates immediately
      const { data: fresh } = await supabase
        .from("item_master")
        .select("*")
        .order("item_code", { ascending: true })
        .limit(2000);
      if (fresh) setItems(fresh as ItemRow[]);
    } catch (e: any) {
      setErr(e.message || "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deleteRow(code: string) {
    const ok = await confirm({
      title: `ลบรหัสสินค้า ${code}?`,
      message: "รายการจะถูกลบออกจากฐานข้อมูล item_master",
      confirmLabel: "ลบ",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("item_master").delete().eq("item_code", code);
    if (error) {
      setErr(translateSupabaseError(error));
      return;
    }
    setItems((prev) => prev.filter((x) => x.item_code !== code));
  }

  return (
    <div className="flex flex-col gap-4">
      {DialogElement}
      <div className="card border-l-4 border-primary-container">
        <SectionHeader icon="upload_file" title="นำเข้าจาก SAP Export (CSV)" accent />
        <p className="text-[11px] text-outline mb-3">
          ใน Excel เลือก <b>File → Save As → CSV UTF-8 (.csv)</b> แล้วอัปโหลดไฟล์ที่นี่ —
          ระบบจะ upsert (เพิ่มใหม่ + อัปเดตทับ) ตาม Material ID อัตโนมัติ
          <br />
          คอลัมน์ที่รองรับ: <code>Material ID</code>, <code>Material Description</code>,{" "}
          <code>Product Category Description</code>, <code>Purchased</code>,{" "}
          <code>In-House Production</code>
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="block w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-primary file:text-on-primary file:cursor-pointer"
        />
        {msg && (
          <div className="mt-3 bg-tertiary-container text-on-tertiary-container text-xs px-3 py-2 rounded-lg">
            {msg}
          </div>
        )}
        {err && (
          <div className="mt-3 bg-error-container text-on-error-container text-xs px-3 py-2 rounded-lg">
            {err}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="section-title">รายการทั้งหมด ({items.length.toLocaleString()})</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา code / description / category..."
            className="input-base flex-1 max-w-xs text-xs"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface-container-high text-left">
              <tr>
                <th className="px-2 py-2">Material ID</th>
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2 text-center">Purch.</th>
                <th className="px-2 py-2 text-center">In-House</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-outline py-8">
                    ไม่มีข้อมูล
                  </td>
                </tr>
              )}
              {filtered.map((it) => (
                <tr
                  key={it.item_code}
                  className={
                    "border-b border-outline-variant " +
                    (it.obsolete ? "bg-error-container/30" : "")
                  }
                >
                  <td className="px-2 py-2 font-mono">{it.item_code}</td>
                  <td className="px-2 py-2">
                    {it.description}
                    {it.obsolete && (
                      <span className="ml-1 text-[10px] uppercase font-bold text-error">
                        obsolete
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-outline">{it.product_category || "-"}</td>
                  <td className="px-2 py-2 text-center">{it.purchased ? "✓" : "-"}</td>
                  <td className="px-2 py-2 text-center">{it.in_house_production ? "✓" : "-"}</td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => deleteRow(it.item_code)}
                      className="text-error hover:underline text-[11px]"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {q.trim() === "" && items.length > 500 && (
            <p className="text-[11px] text-outline mt-2 text-center">
              แสดง 500 แถวแรก — พิมพ์คำค้นหาเพื่อกรอง
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ----- helpers -----
function toBool(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "yes" || s === "y" || s === "true" || s === "1" || s === "x";
}

/**
 * Minimal CSV parser that handles:
 *  - quoted fields with commas
 *  - escaped quotes ("")
 *  - CRLF / LF line endings
 *  - leading BOM
 */
function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(cell);
        cell = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += c;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
