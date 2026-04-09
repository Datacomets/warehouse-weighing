"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { stats, fmt } from "@/lib/stats";
import { Icon } from "@/components/Icon";
import { StatsCard } from "@/components/StatsCard";
import { clsx } from "clsx";

const COLS = 10;

export function CountGrid({
  documentId,
  doc,
  initial,
}: {
  documentId: string;
  doc: any;
  initial: { row_index: number; col_index: number; value: number }[];
}) {
  const supabase = createClient();
  const readOnly = doc.status !== "in_progress";

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
  const expected = doc.actual_count || 0;
  const diff = expected ? counted - expected : 0;

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
      <div className="card overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="w-8 text-outline">#</th>
              {Array.from({ length: COLS }, (_, c) => (
                <th key={c} className="text-outline px-1 py-1 font-semibold">
                  {c + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <td className="text-outline pr-1">{r + 1}</td>
                {Array.from({ length: COLS }, (_, c) => {
                  const k = `${r}:${c}`;
                  return (
                    <td key={c} className="p-0.5">
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
                        className="w-14 h-9 text-center text-xs border border-outline-variant/40 rounded bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
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

      {expected > 0 && (
        <div
          className={clsx(
            "card flex items-center justify-between",
            diff === 0
              ? "border-l-4 border-success"
              : "border-l-4 border-error"
          )}
        >
          <div>
            <span className="section-title">เปรียบเทียบ Packing List</span>
            <p className="text-sm mt-1">
              นับได้: <b>{counted}</b> / คาดหวัง: <b>{expected}</b>
            </p>
          </div>
          <div className={clsx("text-xl font-headline font-bold", diff === 0 ? "text-success" : "text-error")}>
            {diff > 0 ? `+${diff}` : diff}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-background via-background to-transparent px-4 py-4 z-30">
        <Link href={`/doc/${documentId}/issues`} className="btn-primary w-full">
          ถัดไป: รายงานปัญหา <Icon name="arrow_forward" />
        </Link>
      </div>
    </div>
  );
}
