"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";

export function SubmitPanel({
  docId,
  canSubmit,
  status,
}: {
  docId: string;
  canSubmit: boolean;
  status: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setErr(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("gr_documents")
      .update({
        status: "pending_sap",
        submitted_by: user?.id,
        submitted_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
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
      action: "submit_work",
    });
    setLoading(false);
    router.push("/home");
    router.refresh();
  }

  if (status === "pending_sap" || status === "completed") {
    return (
      <div className="card bg-secondary-container/40 border-l-4 border-primary-container">
        <p className="text-sm">
          เอกสารนี้ส่งงานแล้ว — รอ Admin นำเข้า SAP
        </p>
      </div>
    );
  }

  return (
    <>
      {!confirm ? (
        <button
          disabled={!canSubmit}
          onClick={() => setConfirm(true)}
          className="btn-primary w-full"
        >
          <Icon name="send" /> ส่งงาน (เข้าคิว SAP)
        </button>
      ) : (
        <div className="card border-l-4 border-tertiary-fixed-dim">
          <h3 className="font-bold text-primary mb-2">ยืนยันการส่งงาน?</h3>
          <p className="text-xs text-on-surface-variant mb-3">
            หลังส่งงาน คุณจะไม่สามารถแก้ไขข้อมูลชั่งน้ำหนักได้ จนกว่า Admin จะปลดล็อกให้
          </p>
          {err && (
            <p className="text-xs text-error mb-2">{err}</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => setConfirm(false)} className="btn-secondary flex-1">
              ยกเลิก
            </button>
            <button onClick={submit} disabled={loading} className="btn-primary flex-1">
              {loading ? "กำลังส่ง..." : "ยืนยันส่ง"}
            </button>
          </div>
        </div>
      )}
      {!canSubmit && (
        <p className="text-xs text-error">
          ⚠ ต้องกรอก Per Pcs, Per Inner และ Per Carton อย่างน้อย 1 ค่าก่อนจึงจะส่งงานได้
        </p>
      )}
    </>
  );
}
