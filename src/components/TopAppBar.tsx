"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

export function TopAppBar({
  title,
  subtitle,
  showBack,
  step,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  step?: { current: number; total: number };
  rightSlot?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="fixed top-0 left-0 w-full z-40 flex items-center justify-between px-4 h-16 bg-background border-b border-outline-variant/20">
      <div className="flex items-center gap-3 min-w-0">
        {showBack ? (
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-surface-container-high transition-colors rounded-full"
            aria-label="Back"
          >
            <Icon name="arrow_back" className="text-primary" />
          </button>
        ) : (
          <Link
            href="/"
            className="p-2 hover:bg-surface-container-high transition-colors rounded-full"
          >
            <Icon name="menu" className="text-primary" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="font-headline font-bold tracking-tight text-base text-primary truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-outline truncate">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {step && (
          <span className="text-xs font-semibold text-on-surface-variant px-2.5 py-1 rounded-full bg-surface-container-high">
            {step.current}/{step.total}
          </span>
        )}
        {rightSlot}
      </div>
    </header>
  );
}
