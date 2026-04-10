"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { Toast, useToast } from "@/components/Toast";

export function SapEntryForm({ doc, userId }: { doc: any; userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [cfsd, setCfsd] = useState(doc.sap_inbound_id || "");
  const [notif, setNotif] = useState(doc.sap_notification_id || "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  async function save() {
    if (!cfsd.trim()) {
      setErr("กรุณากรอกเลข CFSD");
      return;
    }
    setLoading(true);
    setErr(null);

    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
    const ALLOWED_TYPES = [
      "image/jpeg", "image/png", "image/webp",
      "application/pdf",
    ];

    let attachmentUrl: string | null = doc.sap_attachment_url;
    if (file) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setErr("ไฟล์ต้องเป็น PDF หรือรูปภาพ (JPEG, PNG, WEBP) เท่านั้น");
        setLoading(false);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setErr("ไฟล์ใหญ่เกิน 20 MB");
        setLoading(false);
        return;
      }
      const path = `${doc.id}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from("sap-attachments").upload(path, file);
      if (error) {
        setErr("Upload failed: " + error.message);
        setLoading(false);
        return;
      }
      const { data: pub } = supabase.storage.from("sap-attachments").getPublicUrl(data.path);
      attachmentUrl = pub.publicUrl;
    }

    const { error } = await supabase
      .from("gr_documents")
      .update({
        sap_inbound_id: cfsd.trim(),
        sap_notification_id: notif.trim() || null,
        sap_attachment_url: attachmentUrl,
        status: "completed",
        closed_by: userId,
        closed_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    await supabase.from("audit_log").insert({
      document_id: doc.id,
      actor: userId,
      action: "complete_sap",
      detail: { sap_inbound_id: cfsd },
    });

    setLoading(false);
    toast.show("นำเข้า SAP สำเร็จ!");
    setTimeout(() => {
      router.push("/admin");
      router.refresh();
    }, 1500);
  }

  return (
    <div className="card border-l-4 border-tertiary-fixed-dim flex flex-col gap-3">
      <Toast message={toast.msg} />
      <h3 className="font-headline font-bold text-primary">บันทึกเลข SAP</h3>
      <Field label="Inbound Delivery ID (CFSD)" required>
        <input
          value={cfsd}
          onChange={(e) => setCfsd(e.target.value)}
          className="input-base"
          placeholder="เช่น CFSD-8634"
        />
      </Field>
      <Field label="Delivery Notification ID">
        <input
          value={notif}
          onChange={(e) => setNotif(e.target.value)}
          className="input-base"
          placeholder="INV26-CWZ014#7"
        />
      </Field>
      <Field label="แนบเอกสาร SAP (PDF / รูป)">
        <label className="border-2 border-dashed border-outline-variant rounded-xl p-4 flex items-center gap-2 cursor-pointer">
          <Icon name="upload_file" />
          <span className="text-xs">{file ? file.name : "เลือกไฟล์..."}</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
      </Field>

      {err && (
        <div className="bg-error-container text-on-error-container text-xs px-3 py-2 rounded-lg">
          {err}
        </div>
      )}

      <button onClick={save} disabled={loading} className="btn-primary w-full bg-success">
        {loading ? "กำลังบันทึก..." : "ยืนยันนำเข้า SAP แล้ว"}
        <Icon name="check_circle" />
      </button>
    </div>
  );
}
