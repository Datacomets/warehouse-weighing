"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { clsx } from "clsx";

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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
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
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2 hover:bg-surface-container-high transition-colors rounded-full"
              aria-label="Menu"
            >
              <Icon name="menu" className="text-primary" />
            </button>
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

      {/* Drawer overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        >
          <nav
            className="absolute top-0 left-0 w-72 h-full bg-background shadow-2xl flex flex-col animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-16 border-b border-outline-variant/20">
              <span className="font-headline font-bold text-primary text-lg">COMETS GR</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 rounded-full hover:bg-surface-container-high"
              >
                <Icon name="close" className="text-outline" />
              </button>
            </div>

            {/* Menu items */}
            <div className="flex flex-col py-2 flex-1">
              <MenuItem
                icon="home"
                label="หน้าหลัก"
                href="/home"
                onClick={() => setMenuOpen(false)}
              />
              <MenuItem
                icon="menu_book"
                label="คู่มือการใช้งาน"
                href="/guide"
                onClick={() => setMenuOpen(false)}
              />
              <MenuItem
                icon="person"
                label="โปรไฟล์"
                href="/profile"
                onClick={() => setMenuOpen(false)}
              />
            </div>

            {/* Logout */}
            <div className="border-t border-outline-variant/20 p-2">
              <form action="/api/logout" method="post">
                <button
                  type="submit"
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-error hover:bg-error-container/30 transition-colors"
                >
                  <Icon name="logout" />
                  <span className="text-sm font-semibold">ออกจากระบบ</span>
                </button>
              </form>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  href,
  onClick,
}: {
  icon: string;
  label: string;
  href: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 mx-2 rounded-xl hover:bg-surface-container-high transition-colors"
    >
      <Icon name={icon} className="text-primary" />
      <span className="text-sm font-semibold text-on-surface">{label}</span>
    </Link>
  );
}
