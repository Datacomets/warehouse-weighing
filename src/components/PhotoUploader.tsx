"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./Icon";
import type { WeightKind } from "@/lib/types";

interface Photo {
  id: string;
  url: string;
}

export function PhotoUploader({
  documentId,
  kind,
  initial = [],
  readOnly,
}: {
  documentId: string;
  kind?: WeightKind;
  initial?: Photo[];
  readOnly?: boolean;
}) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [uploading, setUploading] = useState(false);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`ไฟล์ "${file.name}" ไม่ใช่รูปภาพที่รองรับ (JPEG, PNG, WEBP)`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`ไฟล์ "${file.name}" ใหญ่เกิน 10 MB`);
        continue;
      }
      const path = `${documentId}/${kind || "general"}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from("gr-photos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) {
        alert("Upload failed: " + error.message);
        continue;
      }
      const { data: pub } = supabase.storage.from("gr-photos").getPublicUrl(data.path);
      const url = pub.publicUrl;
      const { data: row, error: err2 } = await supabase
        .from("weight_photos")
        .insert({ document_id: documentId, kind, url })
        .select("id,url")
        .single();
      if (!err2 && row) setPhotos((p) => [...p, row as Photo]);
    }
    setUploading(false);
    e.target.value = "";
  }

  async function remove(p: Photo) {
    await supabase.from("weight_photos").delete().eq("id", p.id);
    setPhotos(photos.filter((x) => x.id !== p.id));
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="section-title">รูปภาพประกอบ</span>
        {!readOnly && (
          <label className="btn-secondary h-9 px-3 text-xs cursor-pointer">
            <Icon name="photo_camera" className="text-base" />
            ถ่ายรูป / เลือกรูป
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              hidden
              onChange={onPick}
            />
          </label>
        )}
      </div>
      {uploading && <p className="text-xs text-outline">กำลังอัปโหลด...</p>}
      <div className="grid grid-cols-3 gap-2 mt-2">
        {photos.map((p) => (
          <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-surface-container">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="w-full h-full object-cover" />
            {!readOnly && (
              <button
                type="button"
                onClick={() => remove(p)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-error text-white flex items-center justify-center"
              >
                <Icon name="close" className="text-xs" />
              </button>
            )}
          </div>
        ))}
        {photos.length === 0 && (
          <p className="col-span-3 text-xs text-outline text-center py-2">ยังไม่มีรูปภาพ</p>
        )}
      </div>
    </div>
  );
}
