import Link from "next/link";
import type { GrDocument } from "@/lib/types";
import { StatusBadge, statusBorder } from "./StatusBadge";
import { Icon } from "./Icon";
import { fmtDate, leadTimeText } from "@/lib/stats";
import { clsx } from "clsx";

export function DocumentCard({ doc, href }: { doc: GrDocument; href?: string }) {
  const inner = (
    <div className={clsx("card", statusBorder(doc.status))}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col">
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
