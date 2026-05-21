"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";
import { reopenCompletedDocument } from "@/lib/docActions";

/**
 * Admin / Admin SAP affordance on `/admin/[id]` for already-completed docs.
 * Resets status to `in_progress` so the operator (or admin) can fix late-
 * discovered mistakes. CFSD / SAP attachment info is preserved on the row.
 */
export function ReopenButton({ docId }: { docId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reopen() {
    if (!reason.trim()) return;
    setLoading(true);
    setErr(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const result = await reopenCompletedDocument(supabase, {
      docId,
      userId: user?.id ?? null,
      reason,
    });
    if (!result.ok) {
      setErr(result.error);
      setLoading(false);
      return;
    }
    setLoading(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary flex-1 text-error"
      >
        <Icon name="edit" /> แก้ไขเอกสาร
      </button>
    );
  }

  return (
    <div className="card flex-1 border-l-4 border-error">
      <p className="text-xs mb-2 font-bold">
        ⚠ เปิดเอกสารกลับเป็น &ldquo;กำลังดำเนินการ&rdquo; เพื่อแก้ไข
      </p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="input-base text-xs"
        placeholder="เหตุผล (เช่น พบน้ำหนักผิดหลังปิดงาน)"
      />
      <p className="text-[10px] text-outline mt-1">
        เลข CFSD จะถูกเก็บไว้ ระบบจะ clear closed_at / submitted_at
        ให้ operator แก้ไขแล้วส่งงานใหม่
      </p>
      {err && <p className="text-xs text-error mt-1">{err}</p>}
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => {
            setOpen(false);
            setReason("");
            setErr(null);
          }}
          className="btn-secondary flex-1 h-9 text-xs"
          disabled={loading}
        >
          ยกเลิก
        </button>
        <button
          onClick={reopen}
          disabled={loading || !reason.trim()}
          className="flex-1 h-9 text-xs rounded-xl bg-error text-on-error font-bold disabled:opacity-50"
        >
          {loading ? "กำลังเปิด..." : "ยืนยันแก้ไข"}
        </button>
      </div>
    </div>
  );
}
