"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";
import { Field } from "@/components/Field";
import { ISSUE_TYPES, DEFECT_CODES } from "@/lib/mock-erp";
import { fmtDateTime } from "@/lib/stats";
import { clsx } from "clsx";

export function IssuesPanel({
  documentId,
  userId,
  readOnly,
  initial,
}: {
  documentId: string;
  userId: string;
  readOnly: boolean;
  initial: any[];
}) {
  const supabase = createClient();
  const [issues, setIssues] = useState<any[]>(initial);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    issue_type: "damaged",
    defect_code: "",
    quantity: "",
    notes: "",
  });
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  async function uploadPhoto(file: File) {
    setUploading(true);
    const path = `${documentId}/issues/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage.from("gr-photos").upload(path, file);
    if (error) {
      alert(error.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("gr-photos").getPublicUrl(data.path);
    setPhotoUrls((p) => [...p, pub.publicUrl]);
    setUploading(false);
  }

  async function save() {
    const { data, error } = await supabase
      .from("issue_reports")
      .insert({
        document_id: documentId,
        issue_type: draft.issue_type,
        defect_code: draft.defect_code || null,
        quantity: draft.quantity ? Number(draft.quantity) : null,
        notes: draft.notes || null,
        photos: photoUrls,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    setIssues([data, ...issues]);
    setOpen(false);
    setDraft({ issue_type: "damaged", defect_code: "", quantity: "", notes: "" });
    setPhotoUrls([]);
  }

  async function remove(id: string) {
    if (!confirm("ต้องการลบรายการปัญหานี้หรือไม่?")) return;
    await supabase.from("issue_reports").delete().eq("id", id);
    setIssues(issues.filter((i) => i.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      {!readOnly && !open && (
        <button onClick={() => setOpen(true)} className="btn-primary self-start">
          <Icon name="add_alert" filled />
          แจ้งปัญหา
        </button>
      )}

      {open && (
        <div className="card flex flex-col gap-3 border-l-4 border-error">
          <Field label="ประเภทปัญหา" required>
            <div className="grid grid-cols-2 gap-2">
              {ISSUE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setDraft({ ...draft, issue_type: t.value })}
                  className={
                    draft.issue_type === t.value
                      ? "btn-primary h-10 text-xs"
                      : "btn-secondary h-10 text-xs"
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="รหัสของเสีย">
            <select
              value={draft.defect_code}
              onChange={(e) => setDraft({ ...draft, defect_code: e.target.value })}
              className="input-base"
            >
              <option value="">-- เลือก --</option>
              {DEFECT_CODES.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} — {d.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="จำนวนที่มีปัญหา">
            <input
              type="number"
              inputMode="numeric"
              value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
              className="input-base"
            />
          </Field>
          <Field label="หมายเหตุ">
            <textarea
              rows={2}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="input-base h-auto py-2"
            />
          </Field>

          <div>
            <label className="btn-secondary h-10 px-4 text-xs cursor-pointer self-start inline-flex">
              <Icon name="photo_camera" className="text-base" />
              ถ่ายรูป
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
              />
            </label>
            {uploading && <span className="text-xs text-outline ml-2">กำลังอัปโหลด...</span>}
            <div className="grid grid-cols-3 gap-2 mt-2">
              {photoUrls.map((u, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={i}
                  src={u}
                  alt=""
                  className="aspect-square w-full object-cover rounded-lg"
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 mt-2">
            <button onClick={() => setOpen(false)} className="btn-secondary flex-1">
              ยกเลิก
            </button>
            <button onClick={save} className="btn-primary flex-1">
              บันทึก
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {issues.map((i) => (
          <div key={i.id} className={clsx("card border-l-4 border-error")}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="bg-error-container text-on-error-container text-[10px] font-bold px-2 py-1 rounded uppercase">
                  {ISSUE_TYPES.find((t) => t.value === i.issue_type)?.label || i.issue_type}
                </span>
                <p className="text-xs text-outline mt-1">{fmtDateTime(i.created_at)}</p>
              </div>
              {!readOnly && (
                <button
                  onClick={() => remove(i.id)}
                  className="text-outline hover:text-error"
                >
                  <Icon name="delete" />
                </button>
              )}
            </div>
            <p className="text-sm">
              <b>รหัส:</b> {i.defect_code || "-"} · <b>จำนวน:</b> {i.quantity ?? "-"}
            </p>
            {i.notes && <p className="text-xs text-on-surface-variant mt-1">{i.notes}</p>}
            {i.photos?.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {i.photos.map((url: string, idx: number) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={idx}
                    src={url}
                    alt=""
                    className="aspect-square w-full object-cover rounded-lg"
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {issues.length === 0 && !open && (
          <p className="text-center text-xs text-outline py-4">ยังไม่มีรายการปัญหา</p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-background via-background to-transparent px-4 py-4 z-30">
        <div className="flex gap-2">
          <Link href={`/doc/${documentId}/remainder`} className="btn-secondary flex-none px-4">
            <Icon name="arrow_back" /> ก่อนหน้า
          </Link>
          <Link href={`/doc/${documentId}/submit`} className="btn-primary flex-1">
            ส่งงาน <Icon name="arrow_forward" />
          </Link>
        </div>
      </div>
    </div>
  );
}
