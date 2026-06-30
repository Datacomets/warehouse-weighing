"use client";
import dynamic from "next/dynamic";
import { Icon } from "@/components/Icon";
import { fmt, fmtDate, fmtDateTime, leadTimeText } from "@/lib/stats";
import {
  weightStatsByKind,
  countGridStats,
  totalPiecesCount,
  weightUnitLabel,
  weightValuesByKind,
  gridValuesSorted,
} from "@/lib/documentSummary";
import { ISSUE_TYPES, DEFECT_CODES } from "@/lib/mock-erp";

// Dynamic import — @react-pdf/renderer is heavy and client-only.
// Importing the whole button wrapper (which pulls in pdfDocs + react-pdf)
// only when this component renders avoids bundling it into shared chunks.
const PdfDownloadButtons = dynamic(
  () => import("./PdfDownloadButtons").catch(() => {
    return { default: () => (
      <button className="btn-secondary text-error" disabled>
        <Icon name="error" /> ไม่สามารถโหลดตัวสร้าง PDF ได้ — ลองรีเฟรชหน้า
      </button>
    )};
  }),
  {
    ssr: false,
    loading: () => (
      <button className="btn-primary" disabled>
        <span className="inline-block w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
        กำลังเตรียม PDF...
      </button>
    ),
  }
);

export function PdfClient({
  doc,
  items,
  grid,
  issues = [],
}: {
  doc: any;
  items: any[];
  grid: any[];
  issues?: any[];
}) {
  const perPcs = weightStatsByKind(items, "per_pcs");
  const perInner = weightStatsByKind(items, "per_inner");
  const perCarton = countGridStats(grid);
  const cartonCount = grid.length;
  const unitLabel = weightUnitLabel(doc.weight_unit);
  const perPcsValues = weightValuesByKind(items, "per_pcs");
  const perInnerValues = weightValuesByKind(items, "per_inner");
  const perCartonValues = gridValuesSorted(grid);
  const per100 = !!items.find((m) => m.kind === "per_pcs")?.per_100;
  const qtyPerInner = items.find((m) => m.kind === "per_inner")?.qty_per_inner ?? null;
  const remainderPcs = Number(doc.remainder_pcs) || 0;
  const totalPcs = totalPiecesCount({
    qtyPerCarton: doc.qty_per_carton,
    cartonCount,
    remainderPcs,
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Preview card resembling A4 */}
      <div className="card max-w-3xl mx-auto" style={{ aspectRatio: "1 / 1.414" }}>
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div>
            <h1 className="font-headline font-extrabold text-primary text-xl">COMETS GR</h1>
            <p className="text-[10px] text-outline">ใบชั่งน้ำหนัก / Weight Sheet</p>
          </div>
          <div className="text-right">
            <p className="font-headline font-bold text-primary">{doc.wh_number}</p>
            <p className="text-[10px] text-outline">{doc.sap_inbound_id || "-"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs mt-3">
          <Row label="LOT" value={doc.lot} />
          <Row label="PO" value={doc.po_number} />
          <Row label="Item Code" value={doc.item_code} />
          <Row label="ชื่อสินค้าฝั่ง Supplier" value={doc.supplier} />
          <Row label="Description" value={doc.description} />
          <Row label="Lot Number" value={doc.lot_number} />
          <Row label="Delivery" value={fmtDate(doc.delivery_date)} />
          <Row label="Scale" value={doc.scale_name} />
          <Row label="Qty/Carton" value={doc.qty_per_carton} />
          <Row label="ลังเต็ม" value={cartonCount} />
          <Row label="เศษ (ชิ้น)" value={remainderPcs || "-"} />
          <Row label="รวมชิ้น" value={totalPcs.toLocaleString()} />
          <Row label="หน่วยวัด" value={unitLabel} />
          <Row label="MFG" value={fmtDate(doc.mfg_date)} />
          <Row label="EXP" value={fmtDate(doc.exp_date)} />
          <Row label="Gross" value={`${doc.gross_weight ?? "-"} ${unitLabel}`} />
          <Row label="Net" value={`${doc.net_weight ?? "-"} ${unitLabel}`} />
        </div>

        <div className="mt-4 text-xs">
          <p className="font-bold mb-1">รายละเอียดการชั่ง (หน่วย: {unitLabel})</p>
          <CategoryBlock
            label="ชั่งต่อชิ้น (Per Pcs)"
            meta={per100 ? "Per 100 Pcs" : "Per 1 Pcs"}
            unit={unitLabel}
            data={perPcs}
            values={perPcsValues}
            skipped={!!doc.skip_per_pcs}
            reason={doc.skip_reason_per_pcs}
            extra={per100 && perPcs.count > 0 ? `น้ำหนักต่อ 1 ชิ้น ≈ ${fmt(perPcs.avg / 100, 5)} ${unitLabel}` : undefined}
          />
          <CategoryBlock
            label="ชั่งต่อถุง/ถาด (Per Inner)"
            meta={qtyPerInner ? `${qtyPerInner} ชิ้น / Inner` : undefined}
            unit={unitLabel}
            data={perInner}
            values={perInnerValues}
            skipped={!!doc.skip_per_inner}
            reason={doc.skip_reason_per_inner}
          />
          <CategoryBlock
            label="ชั่งต่อลัง (Per Carton)"
            unit={unitLabel}
            data={perCarton}
            values={perCartonValues}
            skipped={!!doc.skip_per_carton}
            reason={doc.skip_reason_per_carton}
          />
        </div>

        <div className="mt-4 text-xs">
          <p className="font-bold mb-1">ปัญหาที่พบ ({issues.length})</p>
          {issues.length === 0 ? (
            <p className="text-outline">ไม่มีปัญหา</p>
          ) : (
            <table className="w-full border border-outline-variant/50">
              <thead className="bg-surface-container">
                <tr>
                  <th className="p-1 text-left">ประเภท</th>
                  <th className="p-1 text-left">รหัสของเสีย</th>
                  <th className="p-1 text-right">จำนวน</th>
                  <th className="p-1 text-left">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((it: any, i: number) => (
                  <tr key={i} className="border-t border-outline-variant/30">
                    <td className="p-1">
                      {ISSUE_TYPES.find((t) => t.value === it.issue_type)?.label || it.issue_type}
                    </td>
                    <td className="p-1">
                      {it.defect_code
                        ? DEFECT_CODES.find((d) => d.code === it.defect_code)?.label || it.defect_code
                        : "-"}
                    </td>
                    <td className="p-1 text-right">{it.quantity ?? "-"}</td>
                    <td className="p-1">{it.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 text-xs">
          <p><b>เริ่ม:</b> {fmtDateTime(doc.started_at)}</p>
          <p><b>สิ้นสุด:</b> {fmtDateTime(doc.ended_at)}</p>
          <p><b>Lead Time:</b> {leadTimeText(doc.started_at, doc.ended_at)}</p>
          <p><b>Cartons ชั่งแล้ว:</b> ({doc.qty_per_carton ?? 0} x {cartonCount} ลัง) + เศษ {remainderPcs} = {totalPcs.toLocaleString()} ชิ้น</p>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-8">
          <Sig label="ผู้จัดทำ" />
          <Sig label="ผู้ตรวจสอบ" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sticky bottom-4 bg-background py-2 no-print justify-center">
        <PdfDownloadButtons
          doc={doc}
          grid={grid}
          items={items}
          perPcs={perPcs}
          perInner={perInner}
          perCarton={perCarton}
          issues={issues}
        />

        <button onClick={() => window.print()} className="btn-secondary">
          <Icon name="print" /> Print
        </button>
      </div>
    </div>
  );
}

function CategoryBlock({
  label,
  meta,
  unit,
  data,
  values,
  skipped,
  reason,
  extra,
}: {
  label: string;
  meta?: string;
  unit: string;
  data: { avg: number; min: number; max: number; count: number };
  values: number[];
  skipped?: boolean;
  reason?: string | null;
  extra?: string;
}) {
  return (
    <div className="mb-3 border-t border-outline-variant/30 pt-2 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <span className="font-semibold">{label}</span>
        {meta && !skipped && (
          <span className="text-[10px] font-bold text-tertiary-container bg-tertiary-fixed px-2 py-0.5 rounded-full">
            {meta}
          </span>
        )}
      </div>

      {skipped ? (
        <p className="text-outline italic mt-0.5">ข้าม{reason ? `: ${reason}` : ""}</p>
      ) : values.length === 0 ? (
        <p className="text-outline mt-0.5">ยังไม่มีค่าที่ชั่ง</p>
      ) : (
        <>
          <p className="text-outline mt-0.5">
            AVG {fmt(data.avg)} · MIN {fmt(data.min)} · MAX {fmt(data.max)} · {data.count} ครั้ง ({unit})
          </p>
          {extra && <p className="text-tertiary-fixed-dim">{extra}</p>}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {values.map((v, i) => (
              <span
                key={i}
                className="inline-flex items-baseline bg-surface-container-low border border-outline-variant/30 rounded-lg px-2 py-1"
              >
                <span className="font-semibold text-primary">{fmt(v)}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: any; className?: string }) {
  return (
    <div className={`break-words ${className ?? ""}`}>
      <span className="text-outline">{label}: </span>
      <span className="font-semibold">{value || "-"}</span>
    </div>
  );
}

function Sig({ label }: { label: string }) {
  return (
    <div className="text-xs">
      <div className="border-b border-outline mb-1 h-12" />
      <p className="text-center text-outline">({label})</p>
    </div>
  );
}
