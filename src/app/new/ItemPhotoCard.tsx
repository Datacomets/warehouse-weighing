"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";
import { findItemPhoto, uploadItemPhoto } from "@/lib/itemPhoto";

/**
 * Product photo on the "create document" page (design 2):
 * - item has a photo  → show it so the operator can check the goods match
 * - item has no photo → offer to take one / pick from the gallery (optional)
 * Only rendered for item codes that exist in item_master.
 */
export function ItemPhotoCard({
  itemCode,
  userId,
  inMaster = true,
}: {
  itemCode: string;
  userId: string;
  /** false = code not found in item_master; the photo is still saved under the typed code */
  inMaster?: boolean;
}) {
  const supabase = createClient();
  const [state, setState] = useState<"loading" | "none" | "has" | "added">("loading");
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setState("loading");
    setErr(null);
    findItemPhoto(supabase, itemCode).then((u) => {
      if (!alive) return;
      setUrl(u);
      setState(u ? "has" : "none");
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCode]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setUploading(true);
    const res = await uploadItemPhoto(supabase, { itemCode, file });
    setUploading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setUrl(res.url);
    setState("added");
    // history for the admin Log page (no document yet → document_id null)
    await supabase.from("audit_log").insert({
      document_id: null,
      actor: userId,
      action: "add_item_photo",
      detail: { item_code: itemCode, url: res.url },
    });
  }

  if (state === "loading") {
    return <div className="card h-16 animate-pulse bg-surface-container-low" aria-label="กำลังโหลดรูปสินค้า" />;
  }

  if (state === "has" && url) {
    return (
      <div className="card">
        <span className="section-title">รูปสินค้าในระบบ</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`รูปสินค้า ${itemCode}`} className="w-full max-h-64 object-contain rounded-lg mt-2 bg-surface-container-low" />
        <p className="text-sm font-bold text-center mt-2">สินค้าที่รับตรงกับรูปนี้ไหม?</p>
        <p className="text-[11px] text-outline text-center">ถ้าไม่ตรง ให้ตรวจ Item Code อีกครั้ง</p>
      </div>
    );
  }

  if (state === "added" && url) {
    return (
      <div className="card flex items-center gap-3 bg-[#dcf3e3]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="w-14 h-14 rounded-lg object-cover flex-none" />
        <div className="flex-1">
          <p className="text-sm font-bold">เพิ่มรูปสินค้าแล้ว ✓</p>
          <p className="text-[11px] text-outline">บันทึกเข้าฐานข้อมูลสินค้า {itemCode} — ครั้งต่อไปจะแสดงรูปนี้ให้เช็ก</p>
        </div>
      </div>
    );
  }

  // state === "none"
  return (
    <div className="card border border-tertiary-fixed bg-[#fff8ec]">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg border-2 border-dashed border-outline-variant flex items-center justify-center flex-none">
          <Icon name="image_not_supported" className="text-outline" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">สินค้านี้ยังไม่มีรูป</p>
          {!inMaster && (
            <p className="text-[11px] font-bold text-on-tertiary-container">รหัส {itemCode} ยังไม่มีใน Master — ตรวจรหัสให้ถูกก่อนถ่าย รูปจะผูกกับรหัสนี้</p>
          )}
          <p className="text-[11px] text-outline">ช่วยถ่ายรูปไว้ ให้คนต่อไปเช็กสินค้าได้ง่ายขึ้น (ไม่บังคับ)</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <label className={`btn-secondary h-11 text-xs cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          <Icon name="photo_camera" className="text-base" />
          {uploading ? "กำลังอัปโหลด..." : "ถ่ายรูป"}
          <input type="file" accept="image/*" capture="environment" hidden disabled={uploading} onChange={onPick} />
        </label>
        <label className={`btn-secondary h-11 text-xs cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          <Icon name="photo_library" className="text-base" />
          คลังภาพ
          <input type="file" accept="image/*" hidden disabled={uploading} onChange={onPick} />
        </label>
      </div>
      {err && <p className="text-[11px] text-error mt-2">{err}</p>}
    </div>
  );
}
