"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";
import { Toast, useToast } from "@/components/Toast";
import { submitDocument, recallSubmission } from "@/lib/docActions";

export function SubmitPanel({
  docId,
  canSubmit,
  status,
  canRecall = false,
}: {
  docId: string;
  canSubmit: boolean;
  status: string;
  canRecall?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  async function submit() {
    setLoading(true);
    setErr(null);
    const { data: { user } } = await supabase.auth.getUser();
    const result = await submitDocument(supabase, { docId, userId: user?.id ?? null });
    if (!result.ok) {
      setErr(result.error);
      setLoading(false);
      return;
    }
    setLoading(false);
    toast.show("ส่งงานสำเร็จ!");
    setTimeout(() => {
      router.push("/home");
      router.refresh();
    }, 1500);
  }

  async function recall() {
    setLoading(true);
    setErr(null);
    const { data: { user } } = await supabase.auth.getUser();
    const result = await recallSubmission(supabase, { docId, userId: user?.id ?? null });
    if (!result.ok) {
      setErr(result.error);
      setLoading(false);
      return;
    }
    setLoading(false);
    toast.show("ถอนส่งงานสำเร็จ");
    router.refresh();
  }

  if (status === "completed") {
    return (
      <div className="card bg-secondary-container/40 border-l-4 border-primary-container">
        <p className="text-sm">เอกสารนี้เสร็จสิ้นแล้ว — Admin นำเข้า SAP แล้ว</p>
      </div>
    );
  }

  if (status === "pending_sap") {
    return (
      <>
        <Toast message={toast.msg} />
        <div className="card bg-secondary-container/40 border-l-4 border-primary-container">
          <p className="text-sm">เอกสารนี้ส่งงานแล้ว — รอ Admin นำเข้า SAP</p>
          {canRecall && (
            <div className="mt-3 pt-3 border-t border-outline-variant/30">
              <p className="text-xs text-on-surface-variant mb-2">
                ต้องการแก้ไขข้อมูล? สามารถถอนส่งงานกลับมาแก้ไขได้
              </p>
              {err && <p className="text-xs text-error mb-2">{err}</p>}
              <button
                onClick={recall}
                disabled={loading}
                className="btn-secondary text-sm"
              >
                <Icon name="undo" /> {loading ? "กำลังถอน..." : "ถอนส่งงาน"}
              </button>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Toast message={toast.msg} />
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
