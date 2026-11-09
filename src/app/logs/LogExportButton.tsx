"use client";
import { Icon } from "@/components/Icon";
import { buildCsv, downloadCsv } from "@/lib/exportCsv";

export type LogExportRow = Record<"เวลา" | "ผู้ใช้" | "การกระทำ" | "ใบงาน" | "รายละเอียด", string>;

export function LogExportButton({ rows, filename }: { rows: LogExportRow[]; filename: string }) {
  return (
    <button
      type="button"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(buildCsv(rows, ["เวลา", "ผู้ใช้", "การกระทำ", "ใบงาน", "รายละเอียด"]), filename)}
      className="btn-secondary h-9 px-3 text-xs disabled:opacity-40"
    >
      <Icon name="download" className="text-base" /> Excel (CSV)
    </button>
  );
}
