"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const STEPS = [
  { key: "header", label: "Header" },
  { key: "per-pcs", label: "Per Pcs" },
  { key: "per-inner", label: "Per Inner" },
  { key: "count", label: "Per Carton" },
  { key: "issues", label: "Issues" },
  { key: "submit", label: "Submit" },
];

export function StepNav({ docId }: { docId: string }) {
  const path = usePathname();
  return (
    <nav className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-4 px-4 sticky top-16 bg-background z-30 pb-2 pt-1">
      {STEPS.map((s, i) => {
        const href = `/doc/${docId}/${s.key}`;
        const active = path === href || path.startsWith(href);
        return (
          <Link
            key={s.key}
            href={href}
            className={clsx(
              "px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-semibold border transition-colors",
              active
                ? "bg-primary-container text-on-primary border-primary-container"
                : "bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container"
            )}
          >
            {i + 1}. {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
