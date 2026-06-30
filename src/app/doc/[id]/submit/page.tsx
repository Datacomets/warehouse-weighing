import { notFound } from "next/navigation";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { SubmitPanel } from "./SubmitPanel";
import { SectionHeader } from "@/components/Field";
import { fmt, fmtDateTime, leadTimeText } from "@/lib/stats";
import { computeSubmitChecklist } from "@/lib/submitChecklist";
import {
  weightStatsByKind,
  countGridStats,
  weightUnitLabel,
} from "@/lib/documentSummary";
import { ISSUE_TYPES, DEFECT_CODES } from "@/lib/mock-erp";
import Link from "next/link";
import { Icon } from "@/components/Icon";

export default async function SubmitPage({ params }: { params: { id: string } }) {
  const { profile } = await getCurrentUserAndProfile();
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("gr_documents")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!doc) notFound();

  const { data: items } = await supabase
    .from("weight_measurements")
    .select("*")
    .eq("document_id", params.id);
  const { data: grid } = await supabase
    .from("count_grid_entries")
    .select("*")
    .eq("document_id", params.id);
  const { data: issues } = await supabase
    .from("issue_reports")
    .select("*")
    .eq("document_id", params.id)
    .order("created_at", { ascending: false });

  const measurements = items || [];
  const gridEntries = grid || [];
  const issueList = issues || [];
  const gridCount = gridEntries.length;

  const { hasPcs, hasInner, hasCarton, hasRemainder, hasAll } = computeSubmitChecklist({
    measurementKinds: measurements.map((i: any) => i.kind),
    gridCount,
    remainderPcs: doc.remainder_pcs,
    skipPerPcs: !!doc.skip_per_pcs,
    skipPerInner: !!doc.skip_per_inner,
    skipPerCarton: !!doc.skip_per_carton,
  });

  const unitLabel = weightUnitLabel(doc.weight_unit);
  const perPcs = weightStatsByKind(measurements, "per_pcs");
  const perInner = weightStatsByKind(measurements, "per_inner");
  const perCarton = countGridStats(gridEntries);

  // ค่าที่ชั่งรายตัว (เรียงตามลำดับการบันทึก)
  const bySeq = (a: any, b: any) => (a.seq ?? 0) - (b.seq ?? 0);
  const perPcsItems = measurements.filter((m: any) => m.kind === "per_pcs").sort(bySeq);
  const perInnerItems = measurements.filter((m: any) => m.kind === "per_inner").sort(bySeq);
  const perPcsValues = perPcsItems.map((m: any) => Number(m.value));
  const perInnerValues = perInnerItems.map((m: any) => Number(m.value));
  const perCartonValues = [...gridEntries]
    .sort((a: any, b: any) => a.row_index - b.row_index || a.col_index - b.col_index)
    .map((g: any) => Number(g.value));
  const per100 = !!perPcsItems[0]?.per_100;
  const qtyPerInner = perInnerItems[0]?.qty_per_inner ?? null;

  const qtyPerCarton = Number(doc.qty_per_carton) || 0;
  const fullCartons = gridCount;
  const remainderPcs = Number(doc.remainder_pcs) || 0;
  const totalPcs = qtyPerCarton * fullCartons + remainderPcs;

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader icon="send" title="ส่งงานเพื่อนำเข้า SAP" accent />

      <div className="card">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><b>เลขเอกสาร:</b> {doc.wh_number}</div>
          <div><b>Status:</b> {doc.status}</div>
          <div><b>เริ่มเมื่อ:</b> {fmtDateTime(doc.started_at)}</div>
          <div>
            <b>Lead Time:</b>{" "}
            {leadTimeText(doc.started_at, doc.ended_at || new Date().toISOString())}
          </div>
        </div>
      </div>

      <div className="card">
        <span className="section-title">Checklist ก่อนส่งงาน</span>
        <ul className="mt-2 text-sm flex flex-col gap-2">
          <ChecklistItem ok={hasPcs} label="ชั่ง Per Pcs" skipReason={doc.skip_per_pcs ? doc.skip_reason_per_pcs : null} />
          <ChecklistItem ok={hasInner} label="ชั่ง Per Inner/Tray/Bag" skipReason={doc.skip_per_inner ? doc.skip_reason_per_inner : null} />
          <ChecklistItem ok={hasCarton} label="ชั่ง Per Carton (Grid)" skipReason={doc.skip_per_carton ? doc.skip_reason_per_carton : null} />
          <ChecklistItem
            ok={hasRemainder}
            label="นับเศษ (Remainder)"
            note={doc.skip_per_carton ? "ไม่จำเป็น — ข้ามแท็บลังแล้ว" : undefined}
          />
        </ul>
      </div>

      {/* รายละเอียดการชั่ง — ค่าที่ชั่งทุกครั้ง */}
      <div className="card flex flex-col gap-4">
        <span className="section-title">รายละเอียดการชั่ง (หน่วย: {unitLabel})</span>

        <WeightDetail
          label="ชั่งต่อชิ้น (Per Pcs)"
          unit={unitLabel}
          values={perPcsValues}
          data={perPcs}
          skipped={!!doc.skip_per_pcs}
          reason={doc.skip_reason_per_pcs}
          meta={per100 ? "Per 100 Pcs" : "Per 1 Pcs"}
          extra={
            per100 && perPcs.count > 0
              ? `น้ำหนักต่อ 1 ชิ้น ≈ ${fmt(perPcs.avg / 100, 5)} ${unitLabel}`
              : undefined
          }
        />
        <WeightDetail
          label="ชั่งต่อถุง/ถาด (Per Inner)"
          unit={unitLabel}
          values={perInnerValues}
          data={perInner}
          skipped={!!doc.skip_per_inner}
          reason={doc.skip_reason_per_inner}
          meta={qtyPerInner ? `${qtyPerInner} ชิ้น / Inner` : undefined}
        />
        <WeightDetail
          label="ชั่งต่อลัง (Per Carton)"
          unit={unitLabel}
          values={perCartonValues}
          data={perCarton}
          skipped={!!doc.skip_per_carton}
          reason={doc.skip_reason_per_carton}
        />
      </div>

      {/* นับเศษ + สรุปจำนวน */}
      {hasCarton && (
        <div className="card border-l-4 border-primary-container">
          <span className="section-title">นับเศษ &amp; สรุปจำนวนรวม</span>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center text-sm">
            <div>
              <div className="text-xl font-headline font-bold text-primary">{fullCartons}</div>
              <div className="text-[10px] text-outline">ลังเต็ม</div>
            </div>
            <div>
              <div className="text-xl font-headline font-bold text-tertiary-fixed-dim">{remainderPcs}</div>
              <div className="text-[10px] text-outline">ชิ้นเศษ (นับเศษ)</div>
            </div>
            <div>
              <div className="text-xl font-headline font-bold text-primary">{totalPcs.toLocaleString()}</div>
              <div className="text-[10px] text-outline">ชิ้นรวม</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-outline-variant/40 text-center text-sm">
            ({qtyPerCarton} x {fullCartons} ลัง) + เศษ {remainderPcs} = {totalPcs.toLocaleString()} ชิ้น
          </div>
        </div>
      )}

      {/* ปัญหาที่พบ */}
      <div className="card">
        <span className="section-title">ปัญหาที่พบ ({issueList.length})</span>
        {issueList.length === 0 ? (
          <p className="text-xs text-outline mt-2">ไม่มีปัญหา</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {issueList.map((it: any) => {
              const typeLabel =
                ISSUE_TYPES.find((t) => t.value === it.issue_type)?.label || it.issue_type;
              const defectLabel = it.defect_code
                ? DEFECT_CODES.find((d) => d.code === it.defect_code)?.label || it.defect_code
                : null;
              return (
                <li key={it.id} className="border-l-4 border-error pl-3 py-0.5">
                  <div className="text-sm">
                    <span className="font-semibold text-error">{typeLabel}</span>
                    {defectLabel && <span className="text-outline"> · {defectLabel}</span>}
                    <span className="text-outline"> · จำนวน {it.quantity ?? "-"}</span>
                  </div>
                  {it.notes && (
                    <div className="text-xs text-on-surface-variant mt-0.5">{it.notes}</div>
                  )}
                  {Array.isArray(it.photos) && it.photos.length > 0 && (
                    <div className="text-[10px] text-outline mt-0.5">
                      <Icon name="photo_camera" className="text-xs align-middle" /> {it.photos.length} รูป
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Link href={`/doc/${params.id}/pdf`} className="btn-secondary self-start">
        <Icon name="picture_as_pdf" /> ดูตัวอย่าง / Export PDF
      </Link>

      <SubmitPanel
        docId={params.id}
        canSubmit={hasAll}
        status={doc.status}
        canRecall={doc.status === "pending_sap" && doc.submitted_by === profile?.id}
      />
    </div>
  );
}

function WeightDetail({
  label,
  unit,
  values,
  data,
  skipped,
  reason,
  meta,
  extra,
}: {
  label: string;
  unit: string;
  values: number[];
  data: { avg: number; min: number; max: number; count: number };
  skipped?: boolean;
  reason?: string | null;
  meta?: string;
  extra?: string;
}) {
  return (
    <div className="border-t border-outline-variant/30 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <span className="font-semibold text-sm">{label}</span>
        {meta && !skipped && (
          <span className="text-[11px] font-bold text-on-tertiary-container bg-tertiary-container/50 px-2 py-0.5 rounded-full">
            {meta}
          </span>
        )}
      </div>

      {skipped ? (
        <p className="text-xs text-outline italic mt-1">ข้าม{reason ? `: ${reason}` : ""}</p>
      ) : values.length === 0 ? (
        <p className="text-xs text-outline mt-1">ยังไม่มีค่าที่ชั่ง</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {values.map((v, i) => (
              <span
                key={i}
                className="inline-flex items-baseline gap-1 bg-surface-container-low border border-outline-variant/30 rounded-lg px-2 py-1 text-xs"
              >
                <span className="text-outline">#{i + 1}</span>
                <span className="font-semibold text-primary">{fmt(v)}</span>
              </span>
            ))}
          </div>
          <div className="text-xs text-outline mt-2">
            AVG {fmt(data.avg)} · MIN {fmt(data.min)} · MAX {fmt(data.max)} · {data.count} ครั้ง ({unit})
          </div>
          {extra && <div className="text-xs text-tertiary-fixed-dim mt-0.5">{extra}</div>}
        </>
      )}
    </div>
  );
}

function ChecklistItem({
  ok,
  label,
  skipReason,
  note,
}: {
  ok: boolean;
  label: string;
  skipReason?: string | null;
  note?: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <Icon
        name={ok ? "check_circle" : "cancel"}
        className={ok ? "text-success text-lg mt-0.5" : "text-error text-lg mt-0.5"}
      />
      <div className="flex-1 min-w-0">
        <span className={ok ? "text-on-surface" : "text-error"}>{label}</span>
        {skipReason && (
          <div className="text-outline text-xs mt-0.5">
            ข้าม: <span className="italic">{skipReason}</span>
          </div>
        )}
        {note && <div className="text-outline text-xs mt-0.5">{note}</div>}
      </div>
    </li>
  );
}
