"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Icon } from "@/components/Icon";

const STEPS = [
  { key: "header", label: "ข้อมูลหลัก" },
  { key: "per-pcs", label: "ชั่งต่อชิ้น" },
  { key: "per-inner", label: "ชั่งต่อถุง/ถาด" },
  { key: "count", label: "ชั่งต่อลัง" },
  { key: "remainder", label: "นับเศษ" },
  { key: "issues", label: "ปัญหา" },
  { key: "submit", label: "ส่งงาน" },
];

/** Required steps that must be completed before submit is unlocked */
const REQUIRED_STEPS = ["header", "per-pcs", "per-inner", "count", "remainder"];

export function StepNav({
  docId,
  completed = {},
}: {
  docId: string;
  completed?: Record<string, boolean>;
}) {
  const path = usePathname();
  const doneCount = REQUIRED_STEPS.filter((k) => completed[k]).length;
  const canSubmit = doneCount === REQUIRED_STEPS.length;

  return (
    <nav className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-4 px-4 sticky top-16 bg-background z-30 pb-2 pt-1">
      {STEPS.map((s, i) => {
        const href = `/doc/${docId}/${s.key}`;
        const active = path === href || path.startsWith(href);
        const done = !!completed[s.key];
        const locked = s.key === "submit" && !canSubmit && !done;
        return (
          <Link
            key={s.key}
            href={href}
            className={clsx(
              "px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-semibold border transition-colors flex items-center gap-1",
              active
                ? "bg-primary-container text-on-primary border-primary-container"
                : done
                ? "bg-success/10 text-success border-success/30"
                : locked
                ? "bg-surface-container-low text-on-surface-variant/50 border-outline-variant/20"
                : "bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container"
            )}
          >
            {done && !active && (
              <Icon name="check_circle" className="text-success text-sm" />
            )}
            {locked && (
              <span title={`ทำครบ ${doneCount}/${REQUIRED_STEPS.length} ขั้นตอนก่อนจึงจะส่งงานได้`}>
                <Icon name="lock" className="text-on-surface-variant/50 text-sm" />
              </span>
            )}
            {i + 1}. {s.label}
            {locked && (
              <span className="text-[10px] font-normal opacity-60">{doneCount}/{REQUIRED_STEPS.length}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
