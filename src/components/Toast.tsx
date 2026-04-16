"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export type ToastVariant = "success" | "error" | "warning";

interface ToastState {
  msg: string;
  variant: ToastVariant;
}

export function useToast() {
  const [state, setState] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!state) return;
    // Errors linger longer so users can read them before they disappear
    const ttl = state.variant === "error" ? 5000 : 3000;
    const t = setTimeout(() => setState(null), ttl);
    return () => clearTimeout(t);
  }, [state]);

  return {
    msg: state?.msg ?? null,
    variant: state?.variant ?? "success",
    show: (m: string) => setState({ msg: m, variant: "success" }),
    error: (m: string) => setState({ msg: m, variant: "error" }),
    warn: (m: string) => setState({ msg: m, variant: "warning" }),
  };
}

const STYLES: Record<ToastVariant, { bg: string; icon: string }> = {
  success: { bg: "bg-success", icon: "check_circle" },
  error: { bg: "bg-error", icon: "error" },
  warning: { bg: "bg-tertiary-fixed-dim", icon: "warning" },
};

export function Toast({
  message,
  variant = "success",
}: {
  message: string | null;
  variant?: ToastVariant;
}) {
  if (!message) return null;
  const style = STYLES[variant];
  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 ${style.bg} text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in text-sm font-bold max-w-[90vw]`}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon name={style.icon} className="text-lg" />
      <span className="break-words">{message}</span>
    </div>
  );
}
