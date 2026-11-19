import Link from "next/link";
import type { GrDocument } from "@/lib/types";
import { StatusBadge, statusBorder } from "./StatusBadge";
import { Icon } from "./Icon";
import { fmtDate, leadTimeText } from "@/lib/stats";
import { clsx } from "clsx";
import type { CardPhoto } from "@/lib/docPhotos";
import { thumbUrl } from "@/lib/reportPhotos";

/**
 * photo: pass it (even with count 0) to show the ★ thumbnail column; leave it out to keep the
 * card text-only.
 */
export function DocumentCard({ doc, href, photo }: { doc: GrDocument; href?: string; photo?: CardPhoto }) {
  const inner = (
    <div className={clsx("card", statusBorder(doc.status))}>
      <div className="flex justify-between items-start mb-3 gap-3">
        {photo && (
          <div className="relative flex-none">
            {photo.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbUrl(photo.url, 160)} alt="" loading="lazy" className="w-14 h-14 rounded-xl object-cover bg-surface-container-low" />
            ) : (
              <span className="w-14 h-14 rounded-xl border-2 border-dashed border-outline-variant/60 flex items-center justify-center text-outline-variant" title="ยังไม่มีรูปสินค้า">
                <Icon name="image" className="text-xl" />
              </span>
            )}
            {photo.url && (
              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-tertiary-fixed-dim text-primary text-[9px] flex items-center justify-center shadow-sm" aria-hidden>
                ★
              </span>
            )}
          </div>
        )}
        <div className="flex flex-col min-w-0 mr-auto">
          <span className="text-[10px] font-bold text-outline-variant uppercase">
            Document No.
          </span>
          <h3 className="text-lg font-headline font-bold text-primary leading-tight">
            {doc.wh_number}
          </h3>
        </div>
        <StatusBadge status={doc.status} />
      </div>
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <Icon name="inventory_2" className="text-sm" />
          <span className="text-sm font-medium truncate">
            LOT {doc.lot ?? "-"} · {doc.description ?? "-"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-outline text-xs">
          <Icon name="calendar_today" className="text-xs" />
          <span>{fmtDate(doc.delivery_date ?? doc.created_at)}</span>
          {photo && (
            <span className="inline-flex items-center gap-1 ml-1" title="รูปสินค้าของใบงานนี้">
              <Icon name="photo_camera" className="text-xs" />
              {photo.count}/4
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-center justify-between pt-4 border-t border-surface-container-low">
        {doc.sap_inbound_id ? (
          <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-lg text-[10px] font-bold uppercase">
            SAP: {doc.sap_inbound_id}
          </span>
        ) : (
          <span className="px-3 py-1 rounded-lg border border-outline-variant text-[10px] font-bold text-outline uppercase">
            ยังไม่มีเลข SAP
          </span>
        )}
        <div className="flex items-center gap-1 text-on-tertiary-container">
          <Icon name="schedule" className="text-sm" />
          <span className="text-[11px] font-bold">
            {doc.status === "completed"
              ? `สำเร็จ (${leadTimeText(doc.started_at, doc.closed_at)})`
              : leadTimeText(doc.started_at, new Date().toISOString())}
          </span>
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}
