"use client";
import { useEffect } from "react";

type P = { id: string; url: string; is_primary?: boolean };

/** Full-screen photo viewer with thumbnails, ←/→ keys and optional action buttons. */
export function PhotoViewer<T extends P>({
  photos,
  index,
  onIndex,
  onClose,
  title,
  actions,
}: {
  photos: T[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  title?: string;
  actions?: (p: T) => React.ReactNode;
}) {
  const p = photos[index];
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % photos.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onClose, onIndex]);
  if (!p) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col" role="dialog" aria-modal="true">
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <button type="button" onClick={onClose} className="text-2xl leading-none" aria-label="ปิด">
          ✕
        </button>
        <div className="text-sm">
          <b>
            รูปที่ {index + 1}/{photos.length}
          </b>
          {title ? <span className="opacity-70"> · {title}</span> : null}
          {p.is_primary ? <span className="opacity-70"> · ★ รูปหลัก</span> : null}
        </div>
      </div>
      <div
        className="flex-1 flex items-center justify-center px-4 min-h-0"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.url} alt="" className="max-h-full max-w-full object-contain rounded-lg" />
      </div>
      <div className="px-4 pb-4 pt-3 flex flex-col gap-3 max-w-xl w-full mx-auto">
        {photos.length > 1 && (
          <div className="flex gap-2 justify-center">
            {photos.map((x, i) => (
              <button type="button" key={x.id} onClick={() => onIndex(i)} className={`w-12 h-12 rounded-lg overflow-hidden ${i === index ? "ring-2 ring-white" : "opacity-50"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {actions && <div className="flex gap-2">{actions(p)}</div>}
      </div>
    </div>
  );
}
