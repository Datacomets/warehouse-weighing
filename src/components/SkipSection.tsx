"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./Icon";
import { Toast, useToast } from "./Toast";
import { translateSupabaseError } from "@/lib/supabaseError";

type SkipKind = "per_pcs" | "per_inner" | "per_carton";

const REASON_OPTIONS: Record<SkipKind, { value: string; label: string }[]> = {
  per_pcs: [
    { value: "small_item", label: "สินค้าชิ้นเล็กชั่งต่อชิ้นไม่ได้" },
    { value: "bulk_item", label: "สินค้าเป็นกลุ่ม/รวม ชั่งต่อชิ้นไม่ได้" },
    { value: "policy", label: "ไม่ได้ชั่งตามนโยบาย" },
    { value: "other", label: "อื่นๆ (ระบุ)" },
  ],
  per_inner: [
    { value: "no_inner", label: "สินค้าไม่มี Inner / ถุง / ถาด" },
    { value: "policy", label: "ไม่ได้ชั่งตามนโยบาย" },
    { value: "other", label: "อื่นๆ (ระบุ)" },
  ],
  per_carton: [
    { value: "no_carton", label: "สินค้าไม่แพ็กเป็นลัง" },
    { value: "bulk_delivery", label: "จัดส่งแบบกระจาย ไม่แบ่งลัง" },
    { value: "policy", label: "ไม่ได้ชั่งตามนโยบาย" },
    { value: "other", label: "อื่นๆ (ระบุ)" },
  ],
};

function reasonLabel(kind: SkipKind, storedReason: string | null): string {
  if (!storedReason) return "ไม่ระบุเหตุผล";
  const opts = REASON_OPTIONS[kind];
  const match = opts.find((o) => storedReason.startsWith(o.label));
  if (match) return storedReason;
  return storedReason;
}

export function SkipSection({
  docId,
  kind,
  initialSkipped,
  initialReason,
  hasData,
  readOnly,
}: {
  docId: string;
  kind: SkipKind;
  initialSkipped: boolean;
  initialReason: string | null;
  /** If the section already has measurements/entries, warn before skipping. */
  hasData: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [choice, setChoice] = useState<string>("");
  const [freeText, setFreeText] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const flagField = `skip_${kind}`;
  const reasonField = `skip_reason_${kind}`;

  async function confirmSkip() {
    const opts = REASON_OPTIONS[kind];
    const picked = opts.find((o) => o.value === choice);
    if (!picked) {
      setErr("กรุณาเลือกเหตุผล");
      return;
    }
    if (picked.value === "other" && !freeText.trim()) {
      setErr("กรุณาระบุเหตุผล");
      return;
    }
    if (hasData) {
      const ok = confirm(
        "ส่วนนี้มีข้อมูลที่ชั่งไว้แล้ว — หากยืนยันการข้าม ข้อมูลจะยังอยู่แต่ถูกละเว้นจากการส่งงาน ต้องการดำเนินการต่อหรือไม่?"
      );
      if (!ok) return;
    }
    const reasonText =
      picked.value === "other" ? `อื่นๆ: ${freeText.trim()}` : picked.label;

    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("gr_documents")
      .update({ [flagField]: true, [reasonField]: reasonText })
      .eq("id", docId);
    setSaving(false);
    if (error) {
      setErr(translateSupabaseError(error));
      return;
    }
    toast.show("บันทึกการข้ามส่วนนี้แล้ว");
    setExpanded(false);
    router.refresh();
  }

  async function undoSkip() {
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("gr_documents")
      .update({ [flagField]: false, [reasonField]: null })
      .eq("id", docId);
    setSaving(false);
    if (error) {
      setErr(translateSupabaseError(error));
      return;
    }
    toast.show("ยกเลิกการข้ามแล้ว");
    router.refresh();
  }

  if (initialSkipped) {
    return (
      <div className="card border-l-4 border-outline bg-surface-container-low">
        <Toast message={toast.msg} />
        <div className="flex items-center gap-2">
          <Icon name="block" className="text-outline" />
          <span className="section-title flex-1">ข้ามส่วนนี้</span>
          {!readOnly && (
            <button
              type="button"
              onClick={undoSkip}
              disabled={saving}
              className="btn-secondary h-9 px-3 text-xs"
            >
              <Icon name="undo" className="text-base" />
              ยกเลิกการข้าม
            </button>
          )}
        </div>
        <p className="text-xs text-outline mt-2">
          เหตุผล: <span className="text-on-surface-variant">{reasonLabel(kind, initialReason)}</span>
        </p>
        {err && <p className="text-xs text-error mt-2">{err}</p>}
      </div>
    );
  }

  if (readOnly) return null;

  const opts = REASON_OPTIONS[kind];

  return (
    <div className="card border-dashed border border-outline-variant/50">
      <Toast message={toast.msg} />
      {!expanded ? (
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setErr(null);
          }}
          className="btn-secondary h-10 text-sm w-full"
        >
          <Icon name="block" className="text-base" />
          ไม่มีการชั่งน้ำหนักส่วนนี้
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="label-base">เหตุผลที่ไม่ชั่ง</label>
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="input-base"
          >
            <option value="">— เลือกเหตุผล —</option>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {choice === "other" && (
            <input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              className="input-base"
              placeholder="ระบุเหตุผลเอง"
              maxLength={200}
            />
          )}
          {err && <p className="text-xs text-error">{err}</p>}
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setErr(null);
              }}
              className="btn-secondary flex-1 h-10 text-sm"
              disabled={saving}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={confirmSkip}
              disabled={saving}
              className="btn-primary flex-1 h-10 text-sm"
            >
              {saving ? "กำลังบันทึก..." : "ยืนยันการข้าม"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
