"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  return { msg, show: (m: string) => setMsg(m) };
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-success text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in text-sm font-bold">
      <Icon name="check_circle" className="text-lg" />
      {message}
    </div>
  );
}
