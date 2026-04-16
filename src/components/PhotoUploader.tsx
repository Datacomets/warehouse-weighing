"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./Icon";
import { Toast, useToast } from "./Toast";
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
  const toast = useToast();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const result = await uploadWeightPhoto(supabase, { documentId, kind, file });
      if (!result.ok) {
        toast.error(result.error);
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
      toast.error(result.error);
      return;
    }
    setPhotos(photos.filter((x) => x.id !== p.id));
  }

  return (
    <div className="card">
      <Toast message={toast.msg} variant={toast.variant} />
      <div className="flex items-center justify-between mb-2">
        <span className="section-title">รูปภาพประกอบ</span>
        {!readOnly && (
          <label
            className={`btn-secondary h-11 px-4 text-xs cursor-pointer ${
              uploading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <Icon name="photo_camera" className="text-base" />
            {uploading ? "กำลังอัปโหลด..." : "ถ่ายรูป / เลือกรูป"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              hidden
              disabled={uploading}
              onChange={onPick}
            />
          </label>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {photos.map((p) => (
          <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-surface-container">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="w-full h-full object-cover" />
            {!readOnly && (
              <button
                type="button"
                onClick={() => remove(p)}
                aria-label="ลบรูปภาพ"
                className="absolute top-1 right-1 w-10 h-10 rounded-full bg-error/90 hover:bg-error text-white flex items-center justify-center shadow-md active:scale-95 transition-transform"
              >
                <Icon name="close" className="text-base" />
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
