"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";
import { PhotoViewer } from "@/components/PhotoViewer";
import { DOC_PHOTO_MAX, listDocPhotos, uploadDocPhoto, type DocPhoto } from "@/lib/docPhotos";

/**
 * Product photos of ONE document (ใบงาน) — up to 4, ★ primary, delete.
 * Used on the header (ข้อมูลพื้นฐาน) page. Not tied to the item code.
 */
export function DocPhotos({
  documentId,
  userId,
  canManageAll = false,
  readOnly = false,
}: {
  documentId: string;
  userId: string;
  /** admin / admin_wh / manager / TEAMDATA may delete anyone's photo */
  canManageAll?: boolean;
  readOnly?: boolean;
}) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<DocPhoto[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<number | null>(null);

  async function reload() {
    setPhotos(await listDocPhotos(supabase as any, documentId));
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setErr(null);
    setBusy(true);
    const room = DOC_PHOTO_MAX - (photos?.length || 0);
    for (const file of files.slice(0, room)) {
      const r = await uploadDocPhoto(supabase as any, { documentId, userId, file });
      if (!r.ok) {
        setErr(r.error);
        break;
      }
    }
    if (files.length > room) setErr(`เพิ่มได้อีก ${room} รูป (สูงสุด ${DOC_PHOTO_MAX} รูปต่อใบงาน)`);
    await supabase.from("audit_log").insert({ document_id: documentId, actor: userId, action: "add_item_photo", detail: { count: Math.min(files.length, room) } });
    setBusy(false);
    reload();
  }

  async function makePrimary(p: DocPhoto) {
    await supabase.rpc("set_primary_doc_photo", { p_id: p.id });
    reload();
  }

  async function remove(p: DocPhoto) {
    if (!confirm("ลบรูปนี้ออกจากใบงาน?")) return;
    const { error } = await supabase.from("doc_item_photos").delete().eq("id", p.id);
    if (error) setErr("ลบไม่ได้ — ลบได้เฉพาะรูปที่ตัวเองถ่าย");
    else await supabase.from("audit_log").insert({ document_id: documentId, actor: userId, action: "delete_item_photo", detail: { url: p.url } });
    setView(null);
    reload();
  }

  if (photos === null) return <div className="card h-28 animate-pulse bg-surface-container-low" aria-label="กำลังโหลดรูปสินค้า" />;

  const canDelete = (p: DocPhoto) => !readOnly && (canManageAll || p.created_by === userId);
  const full = photos.length >= DOC_PHOTO_MAX;

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <span className="section-title">รูปสินค้าของใบงานนี้</span>
        <span className="text-[11px] font-bold text-outline">
          {photos.length}/{DOC_PHOTO_MAX}
          {full ? " · เต็ม" : ""}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-2">
        {photos.map((p, i) => (
          <button
            type="button"
            key={p.id}
            onClick={() => setView(i)}
            className="relative aspect-square rounded-lg overflow-hidden bg-surface-container-low"
            title="แตะเพื่อดูรูปใหญ่"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`รูปสินค้า ${i + 1}`} className="w-full h-full object-cover" />
            {p.is_primary && (
              <span className="absolute left-1 top-1 bg-tertiary-fixed-dim text-primary text-[9px] font-extrabold rounded-full px-1.5">★ หลัก</span>
            )}
          </button>
        ))}
        {!readOnly &&
          !full &&
          Array.from({ length: DOC_PHOTO_MAX - photos.length }).map((_, i) => (
            <label
              key={`add${i}`}
              className={`aspect-square rounded-lg border-2 border-dashed border-outline-variant flex flex-col items-center justify-center text-[10px] text-outline cursor-pointer hover:border-primary ${busy ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Icon name={i === 0 ? "add_a_photo" : "add"} className="text-primary text-xl" />
              {i === 0 ? (busy ? "กำลังอัปโหลด..." : "ถ่าย/เลือกรูป") : ""}
              <input type="file" accept="image/*" multiple={i === 0} hidden disabled={busy} onChange={onPick} />
            </label>
          ))}
      </div>
      <p className="text-[11px] text-outline mt-2">
        {readOnly
          ? "ดูอย่างเดียว"
          : full
            ? "ครบ 4 รูปแล้ว — ลบรูปเดิมก่อนจึงเพิ่มใหม่ได้"
            : "รูปบันทึกไว้กับใบงานนี้ (ไม่ผูกกับรหัสสินค้า) · แตะรูปเพื่อดูใหญ่/ตั้งรูปหลัก"}
      </p>
      {err && <p className="text-[11px] text-error mt-1">{err}</p>}

      {view !== null && photos[view] && (
        <PhotoViewer
          photos={photos}
          index={view}
          onIndex={setView}
          onClose={() => setView(null)}
          actions={(p) => (
            <>
              {!readOnly && !p.is_primary && (
                <button type="button" onClick={() => makePrimary(p)} className="btn-secondary h-10 text-xs flex-1">
                  ★ ตั้งเป็นรูปหลัก
                </button>
              )}
              {canDelete(p) && (
                <button type="button" onClick={() => remove(p)} className="h-10 text-xs flex-1 rounded-xl bg-error-container text-on-error-container font-bold">
                  ลบรูปนี้
                </button>
              )}
            </>
          )}
        />
      )}
    </div>
  );
}
