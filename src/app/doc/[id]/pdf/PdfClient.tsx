"use client";
import dynamic from "next/dynamic";
import { Icon } from "@/components/Icon";
import { fmt, fmtDate, fmtDateTime, leadTimeText } from "@/lib/stats";
import {
  weightStatsByKind,
  countGridStats,
  totalPiecesCount,
  weightUnitLabel,
} from "@/lib/documentSummary";

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
}: {
  doc: any;
  items: any[];
  grid: any[];
}) {
  const perPcs = weightStatsByKind(items, "per_pcs");
  const perInner = weightStatsByKind(items, "per_inner");
  const perCarton = countGridStats(grid);
  const cartonCount = grid.length;
  const unitLabel = weightUnitLabel(doc.weight_unit);
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
          <Row label="Description" value={doc.description} className="col-span-2" />
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

        <table className="w-full text-xs mt-4 border border-outline-variant/50">
          <thead className="bg-surface-container">
            <tr>
              <th className="p-2 text-left">หมวด</th>
              <th className="p-2 text-right">AVG</th>
              <th className="p-2 text-right">MIN</th>
              <th className="p-2 text-right">MAX</th>
              <th className="p-2 text-right">N</th>
            </tr>
          </thead>
          <tbody>
            <Trow label="Per Pcs" data={perPcs} />
            <Trow label="Per Inner/Tray/Bag" data={perInner} />
            <Trow label="Per Carton" data={perCarton} />
          </tbody>
        </table>

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
          perPcs={perPcs}
          perInner={perInner}
          perCarton={perCarton}
        />

        <button onClick={() => window.print()} className="btn-secondary">
          <Icon name="print" /> Print
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: any; className?: string }) {
  return (
    <div className={className}>
      <span className="text-outline">{label}: </span>
      <span className="font-semibold">{value || "-"}</span>
    </div>
  );
}

function Trow({ label, data }: { label: string; data: any }) {
  return (
    <tr className="border-t border-outline-variant/30">
      <td className="p-2">{label}</td>
      <td className="p-2 text-right">{fmt(data.avg)}</td>
      <td className="p-2 text-right">{fmt(data.min)}</td>
      <td className="p-2 text-right">{fmt(data.max)}</td>
      <td className="p-2 text-right">{data.count}</td>
    </tr>
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
