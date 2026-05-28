"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { stats, fmt } from "@/lib/stats";
import { isOutlier } from "@/lib/outlier";
import { Icon } from "@/components/Icon";
import { StatsCard } from "@/components/StatsCard";
import { clsx } from "clsx";

const COLS = 10;

export function CountGrid({
  documentId,
  doc,
  initial,
  readOnly: readOnlyProp,
}: {
  documentId: string;
  doc: any;
  initial: { row_index: number; col_index: number; value: number }[];
  /** Computed by the page from canEditDocumentData(role, status). Falls
   *  back to the legacy status-only check for older callers. */
  readOnly?: boolean;
}) {
  const supabase = createClient();
  const readOnly = readOnlyProp ?? doc.status !== "in_progress";

  const initRows = Math.max(
    1,
    Math.max(0, ...initial.map((e) => e.row_index)) + 1
  );
  const [rows, setRows] = useState<number>(initRows);
  const [cells, setCells] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    initial.forEach((e) => (m[`${e.row_index}:${e.col_index}`] = String(e.value)));
    return m;
  });

  const values = useMemo(() => {
    return Object.values(cells)
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0);
  }, [cells]);

  const s = stats(values);
  const counted = values.length;

  async function persist(r: number, c: number, v: string) {
    const num = Number(v);
    if (v === "" || !Number.isFinite(num)) {
      await supabase
        .from("count_grid_entries")
        .delete()
        .eq("document_id", documentId)
        .eq("row_index", r)
        .eq("col_index", c);
      return;
    }
    await supabase
      .from("count_grid_entries")
      .upsert(
        { document_id: documentId, row_index: r, col_index: c, value: num },
        { onConflict: "document_id,row_index,col_index" }
      );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: rows * COLS }, (_, idx) => {
            const r = Math.floor(idx / COLS);
            const c = idx % COLS;
            const cartonNo = idx + 1;
            const k = `${r}:${c}`;
            return (
              <div key={k} className="flex flex-col items-center">
                <div className="text-[9px] text-outline font-bold mb-0.5">{cartonNo}</div>
                <input
                  disabled={readOnly}
                  inputMode="decimal"
                  type="number"
                  step="0.001"
                  min="0"
                  max="99999"
                  value={cells[k] || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v !== "" && Number(v) < 0) return;
                    setCells({ ...cells, [k]: v });
                  }}
                  onBlur={() => persist(r, c, cells[k] || "")}
                  className={clsx(
                    "w-16 h-12 text-center text-base rounded focus:outline-none focus:ring-2",
                    cells[k] && isOutlier(Number(cells[k]), s)
                      ? "border-2 border-error bg-error-container/30 text-error focus:ring-error"
                      : "border border-outline-variant/40 bg-surface-container-low focus:ring-primary"
                  )}
                  title={cells[k] && isOutlier(Number(cells[k]), s) ? "ค่าผิดปกติ" : undefined}
                  placeholder={String(cartonNo)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={() => setRows((r) => r + 1)}
          className="btn-secondary self-start text-sm h-10 px-4"
        >
          <Icon name="add" /> เพิ่มแถว
        </button>
      )}

      <StatsCard avg={s.avg} min={s.min} max={s.max} />

      <div className="card border-l-4 border-primary-container">
        <span className="section-title">สรุป Per Carton</span>
        <p className="text-sm mt-1">
          ชั่งแล้ว: <b>{counted}</b> ลัง
        </p>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-background via-background to-transparent px-4 py-4 z-30">
        <div className="flex gap-2">
          <Link href={`/doc/${documentId}/per-inner`} className="btn-secondary flex-none px-4">
            <Icon name="arrow_back" /> ก่อนหน้า
          </Link>
          <Link href={`/doc/${documentId}/remainder`} className="btn-primary flex-1">
            นับเศษ <Icon name="arrow_forward" />
          </Link>
          {doc.status !== "in_progress" && (
            <Link
              href={`/admin/${documentId}`}
              className="btn-secondary flex-none px-4 text-tertiary-fixed-dim"
              title="บันทึกอัตโนมัติแล้ว — กลับหน้า Admin"
            >
              <Icon name="check_circle" /> กลับ Admin
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
