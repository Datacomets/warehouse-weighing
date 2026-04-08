"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { clsx } from "clsx";
import type { UserRole } from "@/lib/types";

export function BottomNav({ role }: { role: UserRole }) {
  const path = usePathname();

  let items: { href: string; icon: string; label: string }[] = [];
  if (role === "operator" || role === "qc") {
    items = [
      { href: "/home", icon: "pending_actions", label: "เอกสาร" },
      { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
      { href: "/profile", icon: "person", label: "โปรไฟล์" },
    ];
  } else if (role === "admin_sap") {
    items = [
      { href: "/admin", icon: "task_alt", label: "งาน SAP" },
      { href: "/admin/completed", icon: "history", label: "เสร็จสิ้น" },
      { href: "/profile", icon: "person", label: "โปรไฟล์" },
    ];
  } else if (role === "manager") {
    items = [
      { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
      { href: "/home", icon: "list_alt", label: "เอกสาร" },
      { href: "/profile", icon: "person", label: "โปรไฟล์" },
    ];
  } else {
    items = [
      { href: "/users", icon: "group", label: "ผู้ใช้" },
      { href: "/admin/items", icon: "inventory_2", label: "Items" },
      { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
      { href: "/profile", icon: "person", label: "โปรไฟล์" },
    ];
  }

  return (
    <nav className="fixed bottom-0 left-0 w-full z-40 flex justify-around items-center h-20 pb-safe bg-white/90 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,60,0.05)] rounded-t-xl no-print">
      {items.map((it) => {
        const active = path === it.href || path.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={clsx(
              "flex flex-col items-center justify-center gap-1 transition-colors",
              active ? "text-tertiary-fixed-dim scale-105" : "text-outline hover:text-primary"
            )}
          >
            <Icon name={it.icon} filled={active} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              {it.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
