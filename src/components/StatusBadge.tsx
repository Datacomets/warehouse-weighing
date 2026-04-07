import { clsx } from "clsx";
import type { DocStatus } from "@/lib/types";

const map: Record<DocStatus, { label: string; bg: string; fg: string; dot: string }> = {
  in_progress: {
    label: "กำลังดำเนินการ",
    bg: "bg-tertiary-container",
    fg: "text-on-tertiary-container",
    dot: "bg-tertiary-fixed-dim",
  },
  pending_sap: {
    label: "รอนำเข้า SAP",
    bg: "bg-secondary-container",
    fg: "text-on-secondary-container",
    dot: "bg-primary-container",
  },
  completed: {
    label: "เสร็จสมบูรณ์",
    bg: "bg-green-100",
    fg: "text-green-800",
    dot: "bg-success",
  },
};

export function StatusBadge({ status, className }: { status: DocStatus; className?: string }) {
  const m = map[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight",
        m.bg,
        m.fg,
        className
      )}
    >
      <span className={clsx("w-1.5 h-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function statusBorder(status: DocStatus) {
  if (status === "in_progress") return "border-l-4 border-tertiary-fixed-dim";
  if (status === "pending_sap") return "border-l-4 border-primary-container";
  return "border-l-4 border-success";
}
