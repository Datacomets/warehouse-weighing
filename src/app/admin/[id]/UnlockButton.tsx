"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";

export function UnlockButton({ docId }: { docId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const [err, setErr] = useState<string | null>(null);

  async function unlock() {
    if (!reason.trim()) return;
    setLoading(true);
    setErr(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("gr_documents")
      .update({
        status: "in_progress",
        unlock_reason: reason,
        submitted_at: null,
        ended_at: null,
      })
      .eq("id", docId);
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    await supabase.from("audit_log").insert({
      document_id: docId,
      actor: user?.id,
      action: "unlock",
      detail: { reason },
    });
    setLoading(false);
    router.push("/admin");
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary flex-1">
        <Icon name="lock_open" /> ปลดล็อก
      </button>
    );
  }

  return (
    <div className="card flex-1 border-l-4 border-error">
      <p className="text-xs mb-2">เหตุผลที่ปลดล็อก:</p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="input-base text-xs"
        placeholder="เช่น พนักงานกรอกน้ำหนักผิด"
      />
      {err && (
        <p className="text-xs text-error mt-1">{err}</p>
      )}
      <div className="flex gap-2 mt-2">
        <button onClick={() => setOpen(false)} className="btn-secondary flex-1 h-9 text-xs">
          ยกเลิก
        </button>
        <button onClick={unlock} disabled={loading} className="btn-primary flex-1 h-9 text-xs">
          ยืนยัน
        </button>
      </div>
    </div>
  );
}
