"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-outline">Loading...</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const target = search.get("from") || "/";
    router.push(target);
    router.refresh();
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* decorative blobs */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-secondary-container/60 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-tertiary-fixed-dim/40 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm bg-white/80 backdrop-blur-xl rounded-2xl border-l-4 border-primary-container shadow-card p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-16 h-16 rounded-2xl bg-primary-container flex items-center justify-center shadow-fab">
            <Icon name="inventory_2" className="text-tertiary-fixed-dim text-3xl" filled />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-tertiary-fixed-dim border-2 border-white" />
          </div>
          <h1 className="mt-4 font-headline font-extrabold text-2xl tracking-tight text-primary">
            COMETS GR
          </h1>
          <p className="text-xs text-outline mt-1">ระบบตรวจรับสินค้าเข้าคลัง</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="relative">
            <Icon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg" />
            <input
              type="email"
              required
              placeholder="อีเมล"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base pl-10"
              autoComplete="username"
            />
          </div>
          <div className="relative">
            <Icon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg" />
            <input
              type={showPwd ? "text" : "password"}
              required
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base pl-10 pr-10"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline"
              tabIndex={-1}
            >
              <Icon name={showPwd ? "visibility_off" : "visibility"} className="text-lg" />
            </button>
          </div>

          {err && (
            <div className="bg-error-container text-on-error-container text-xs px-3 py-2 rounded-lg">
              {err}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading ? "กำลังเข้าระบบ..." : "เข้าสู่ระบบ"}
            <Icon name="arrow_forward" />
          </button>
        </form>

        <p className="text-center text-[10px] text-outline mt-6">
          © 2026 COMETS — Goods Receiving System
        </p>
      </div>
    </main>
  );
}
