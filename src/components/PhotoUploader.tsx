"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./Icon";
import type { WeightKind } from "@/lib/types";
import { uploadWeightPhoto, deleteWeightPhoto } from "@/lib/photoUpload";

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

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const result = await uploadWeightPhoto(supabase, { documentId, kind, file });
      if (!result.ok) {
        alert(result.error);
        continue;
      }
      setPhotos((p) => [...p, result.data]);
    }
    setUploading(false);
    e.target.value = "";
  }

  async function remove(p: Photo) {
    const result = await deleteWeightPhoto(supabase, p.id);
    if (!result.ok) {
      alert(result.error);
      return;
    }
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
