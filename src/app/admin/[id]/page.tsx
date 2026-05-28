import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getCurrentUserAndProfile } from "@/lib/supabase/server";
import { TopAppBar } from "@/components/TopAppBar";
import { StatusBadge } from "@/components/StatusBadge";
import { Icon } from "@/components/Icon";
import { fmt, fmtDate, fmtDateTime, leadTimeText, stats } from "@/lib/stats";
import { SapEntryForm } from "./SapEntryForm";
import { UnlockButton } from "./UnlockButton";
import { ISSUE_TYPES } from "@/lib/mock-erp";
import { canAccessAdminQueue } from "@/lib/permissions";
import { canEditDocumentData } from "@/lib/workflow";
import { clsx } from "clsx";

/** Human-readable Thai labels for audit_log action codes. */
const ACTION_LABEL: Record<string, string> = {
  create_doc: "สร้างเอกสาร",
  edit_header: "แก้ไข Header",
  edit_remainder: "แก้ไขจำนวนเศษ",
  edit_cartons_per_pallet: "แก้ไขลังต่อพาเลท",
  submit_work: "ส่งงาน",
  complete_sap: "นำเข้า SAP",
  unlock: "ปลดล็อกเพื่อแก้ไข",
  reopen_completed: "เปิดเอกสารใหม่ (post-SAP)",
  recall_submission: "ถอนส่งงาน",
};

/** Thai labels for header field keys recorded in audit_log detail.fields. */
const HEADER_FIELD_LABEL: Record<string, string> = {
  lot: "LOT",
  po_number: "PO Number",
  item_code: "Item Code",
  description: "Description",
  supplier: "ชื่อ Supplier",
  delivery_date: "Delivery Date",
  scale_name: "เครื่องชั่ง",
  qty_per_carton: "จำนวนชิ้น/ลัง",
  width_cm: "กว้าง",
  length_cm: "ยาว",
  height_cm: "สูง",
  gross_weight: "Gross Weight",
  net_weight: "Net Weight",
  mfg_date: "MFG Date",
  exp_date: "EXP Date",
  lot_number: "Lot Number",
  qc_status: "สถานะ QC",
  remarks: "หมายเหตุ",
};

export default async function AdminDocPage({ params }: { params: { id: string } }) {
  const { profile } = await getCurrentUserAndProfile();
  if (!profile) redirect("/login");
  if (!canAccessAdminQueue(profile.role)) redirect("/home");

  const supabase = createClient();
  const [
    { data: doc },
    { data: weightItems },
    { data: gridEntries },
    { data: issues },
    { data: auditLog },
  ] = await Promise.all([
    supabase.from("gr_documents").select("*").eq("id", params.id).single(),
    supabase.from("weight_measurements").select("*").eq("document_id", params.id).order("seq"),
    supabase.from("count_grid_entries").select("*").eq("document_id", params.id).order("row_index").order("col_index"),
    supabase.from("issue_reports").select("*").eq("document_id", params.id).order("created_at", { ascending: false }),
    supabase.from("audit_log").select("id,action,detail,actor,created_at").eq("document_id", params.id).order("created_at", { ascending: false }),
  ]);
  if (!doc) notFound();

  // Resolve user names for the workflow card + audit timeline.
  const userIds = new Set<string>();
  if (doc.created_by) userIds.add(doc.created_by);
  if (doc.submitted_by) userIds.add(doc.submitted_by);
  if (doc.closed_by) userIds.add(doc.closed_by);
  for (const entry of auditLog || []) {
    if (entry.actor) userIds.add(entry.actor);
  }
  const { data: profiles } = userIds.size > 0
    ? await supabase.from("profiles").select("id,full_name,role").in("id", Array.from(userIds))
    : { data: [] as { id: string; full_name: string; role: string }[] };
  const userMap = new Map<string, { full_name: string; role: string }>();
  for (const p of profiles || []) userMap.set(p.id, { full_name: p.full_name, role: p.role });
  function userLabel(id: string | null | undefined): string {
    if (!id) return "—";
    const u = userMap.get(id);
    return u ? `${u.full_name} (${u.role})` : "—";
  }

  const unitLabel = doc.weight_unit === "g" ? "g" : doc.weight_unit === "pcs" ? "ชิ้น" : "kg";

  const pcsItems = (weightItems || []).filter((i: any) => i.kind === "per_pcs");
  const innerItems = (weightItems || []).filter((i: any) => i.kind === "per_inner");
  const gridValues = (gridEntries || []).map((g: any) => Number(g.value));

  const perPcs = stats(pcsItems.map((i: any) => Number(i.value)));
  const perInner = stats(innerItems.map((i: any) => Number(i.value)));
  const perCarton = stats(gridValues);

  const fullCartons = gridValues.length;
  const remainderPcs = Number(doc.remainder_pcs) || 0;
  const qtyPerCarton = Number(doc.qty_per_carton) || 0;
  const totalPcs = qtyPerCarton * fullCartons + remainderPcs;

  function isOutlier(v: number, s: ReturnType<typeof stats>) {
    if (s.count < 3) return false;
    const range = s.max - s.min;
    if (range === 0) return false;
    return Math.abs(v - s.avg) > range * 0.45;
  }

  return (
    <>
      <TopAppBar title={doc.wh_number} subtitle="Admin SAP Entry" showBack rightSlot={<StatusBadge status={doc.status} />} />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">

        {/* ข้อมูลเอกสาร */}
        <div className="card border-l-4 border-primary-container">
          <span className="section-title">ข้อมูลที่ต้องกรอกเข้า SAP</span>
          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
            <Info label="PO Number" value={doc.po_number} />
            <Info label="Item Code" value={doc.item_code} />
            <Info label="Description" value={doc.description} className="col-span-2" />
            <Info label="LOT" value={doc.lot} />
            <Info label="ชื่อสินค้าฝั่ง Supplier" value={doc.supplier} />
            <Info label="Delivery Date" value={fmtDate(doc.delivery_date)} />
            <Info label="Notification ID" value={doc.sap_notification_id} />
            <Info label="Qty/Carton" value={doc.qty_per_carton} />
            <Info label="หน่วยวัด" value={unitLabel} />
            <Info label="Gross Weight" value={doc.gross_weight ? `${doc.gross_weight} ${unitLabel}` : null} />
            <Info label="Net Weight" value={doc.net_weight ? `${doc.net_weight} ${unitLabel}` : null} />
          </div>
        </div>

        {/* สรุปจำนวน */}
        <div className="card border-l-4 border-tertiary-fixed-dim">
          <span className="section-title">สรุปจำนวน</span>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center">
            <div>
              <div className="text-xl font-headline font-bold text-primary">{fullCartons}</div>
              <div className="text-[10px] text-outline">ลังเต็ม</div>
            </div>
            <div>
              <div className="text-xl font-headline font-bold text-tertiary-fixed-dim">{remainderPcs}</div>
              <div className="text-[10px] text-outline">ชิ้นเศษ</div>
            </div>
            <div>
              <div className="text-xl font-headline font-bold text-primary">{totalPcs.toLocaleString()}</div>
              <div className="text-[10px] text-outline">ชิ้นรวม</div>
            </div>
          </div>
          {qtyPerCarton > 0 && (
            <p className="text-[10px] text-outline text-center mt-1">
              ({qtyPerCarton} × {fullCartons}) + {remainderPcs} = {totalPcs.toLocaleString()} ชิ้น
            </p>
          )}
          {doc.cartons_per_pallet != null && (
            <div className="mt-3 pt-3 border-t border-outline-variant/30 flex items-center justify-between gap-3">
              <span className="text-sm font-bold">จำนวนลังที่วาง / 1 พาเลท</span>
              <div className="text-right">
                <span className="text-2xl font-headline font-bold text-secondary">
                  {doc.cartons_per_pallet}
                </span>
                <span className="text-xs text-outline ml-1">ลัง</span>
              </div>
            </div>
          )}
        </div>

        {/* Per Pcs — ค่าทุกรายการ */}
        <WeightSection
          title={`Per Pcs (${perPcs.count} ค่า)`}
          icon="balance"
          items={pcsItems}
          s={perPcs}
          unit={unitLabel}
          isOutlier={isOutlier}
        />

        {/* Per Inner/Tray/Bag — ค่าทุกรายการ */}
        <WeightSection
          title={`Per Inner/Tray/Bag (${perInner.count} ค่า)`}
          icon="inventory"
          items={innerItems}
          s={perInner}
          unit={unitLabel}
          isOutlier={isOutlier}
        />

        {/* Per Carton Grid — ตาราง 10 ช่องต่อแถว */}
        <CartonGrid
          entries={gridEntries || []}
          perCarton={perCarton}
          isOutlier={isOutlier}
        />

        {/* ปัญหา / Issues */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="report_problem" className="text-error text-base" />
            <span className="section-title">ปัญหาที่รายงาน ({(issues || []).length})</span>
          </div>
          {(issues || []).length === 0 ? (
            <p className="text-xs text-outline text-center py-2">ไม่มีปัญหาที่รายงาน</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(issues || []).map((issue: any) => (
                <div key={issue.id} className="bg-error-container/20 border border-error/20 rounded-lg p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="bg-error-container text-on-error-container text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                      {ISSUE_TYPES.find((t) => t.value === issue.issue_type)?.label || issue.issue_type}
                    </span>
                    <span className="text-[10px] text-outline">{fmtDateTime(issue.created_at)}</span>
                  </div>
                  <div className="mt-1">
                    <b>รหัส:</b> {issue.defect_code || "-"} · <b>จำนวน:</b> {issue.quantity ?? "-"}
                  </div>
                  {issue.notes && <p className="text-outline mt-1">{issue.notes}</p>}
                  {issue.photos?.length > 0 && (
                    <div className="grid grid-cols-4 gap-1 mt-1">
                      {issue.photos.map((url: string, idx: number) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img key={idx} src={url} alt="" className="aspect-square w-full object-cover rounded" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workflow */}
        <div className="card text-xs">
          <span className="section-title">Workflow</span>
          <div className="mt-2 flex flex-col gap-1">
            <p>
              <b>สร้างโดย:</b> {userLabel(doc.created_by)} ·{" "}
              <span className="text-outline">{fmtDateTime(doc.created_at)}</span>
            </p>
            <p>
              <b>ส่งโดย:</b> {userLabel(doc.submitted_by)} ·{" "}
              <span className="text-outline">{fmtDateTime(doc.submitted_at)}</span>
            </p>
            <p>
              <b>ปิดโดย:</b> {userLabel(doc.closed_by)} ·{" "}
              <span className="text-outline">{fmtDateTime(doc.closed_at)}</span>
            </p>
            <p>
              <b>Lead Time:</b>{" "}
              {leadTimeText(doc.started_at, doc.closed_at || doc.submitted_at || doc.ended_at)}
            </p>
            {doc.unlock_reason && (
              <p className="bg-tertiary-container/30 px-2 py-1 rounded mt-1">
                <b>เหตุผลปลดล็อก/แก้ไขล่าสุด:</b>{" "}
                <span className="italic">&ldquo;{doc.unlock_reason}&rdquo;</span>
              </p>
            )}
          </div>
        </div>

        {/* Audit log timeline */}
        <div className="card text-xs">
          <span className="section-title">ประวัติการดำเนินการ ({(auditLog || []).length})</span>
          {(auditLog || []).length === 0 ? (
            <p className="text-outline text-center py-2 mt-2">ยังไม่มีบันทึก</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {(auditLog || []).map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 border-b border-outline-variant/20 last:border-0"
                >
                  <span className="text-outline whitespace-nowrap font-mono text-[10px]">
                    {fmtDateTime(entry.created_at)}
                  </span>
                  <span className="font-medium">{userLabel(entry.actor)}</span>
                  <span className="text-on-surface-variant">
                    → {ACTION_LABEL[entry.action] || entry.action}
                  </span>
                  {entry.detail?.reason && (
                    <span className="text-outline italic">
                      &ldquo;{String(entry.detail.reason)}&rdquo;
                    </span>
                  )}
                  {entry.detail?.value !== undefined && (
                    <span className="text-on-surface-variant">
                      → <b>{String(entry.detail.value)}</b>
                    </span>
                  )}
                  {Array.isArray(entry.detail?.fields) && entry.detail.fields.length > 0 && (
                    <span className="text-on-surface-variant">
                      → <b>{entry.detail.fields.map((k: string) => HEADER_FIELD_LABEL[k] ?? k).join(", ")}</b>
                    </span>
                  )}
                  {entry.detail?.sap_inbound_id && (
                    <span className="text-on-surface-variant">
                      ({String(entry.detail.sap_inbound_id)})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link href={`/doc/${doc.id}/pdf`} className="btn-secondary flex-1">
            <Icon name="picture_as_pdf" /> Export PDF
          </Link>
          {doc.status === "pending_sap" && <UnlockButton docId={doc.id} />}
        </div>

        {doc.status === "pending_sap" && <SapEntryForm doc={doc} userId={profile.id} />}
        {doc.status === "completed" && (
          <>
            <div className="card border-l-4 border-success">
              <span className="section-title">SAP Linked</span>
              <p className="text-sm mt-1">
                <b>CFSD:</b> {doc.sap_inbound_id} <br />
                <b>ปิดงานเมื่อ:</b> {fmtDateTime(doc.closed_at)}
              </p>
            </div>
            {canEditDocumentData(profile.role, doc.status) && (
              <Link
                href={`/doc/${doc.id}/header`}
                className="btn-secondary text-tertiary-fixed-dim"
              >
                <Icon name="edit" /> แก้ไขข้อมูล (status ไม่เปลี่ยน)
              </Link>
            )}
          </>
        )}
      </main>
    </>
  );
}

/* ---- Sub-components ---- */

function Info({ label, value, className }: { label: string; value: any; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[10px] text-outline uppercase">{label}</div>
      <div className="font-semibold text-on-surface">{value || "-"}</div>
    </div>
  );
}

function WeightSection({
  title,
  icon,
  items,
  s,
  unit,
  isOutlier,
}: {
  title: string;
  icon: string;
  items: any[];
  s: ReturnType<typeof stats>;
  unit: string;
  isOutlier: (v: number, s: ReturnType<typeof stats>) => boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <Icon name={icon} className="text-primary text-base" />
        <span className="section-title">{title}</span>
      </div>
      {s.count > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-1 text-[10px] text-outline mb-2">
            <span>AVG: <b className="text-on-surface">{fmt(s.avg)}</b></span>
            <span>MIN: <b className="text-on-surface">{fmt(s.min)}</b></span>
            <span>MAX: <b className="text-on-surface">{fmt(s.max)}</b></span>
          </div>
          <div className="flex flex-wrap gap-1">
            {items.map((m: any, i: number) => {
              const v = Number(m.value);
              const out = isOutlier(v, s);
              return (
                <span
                  key={m.id}
                  className={clsx(
                    "inline-flex items-center justify-center min-w-[3.5rem] h-8 px-2 text-[11px] font-bold rounded",
                    out
                      ? "bg-error-container/60 border-2 border-error text-error"
                      : "bg-surface-container-low border border-outline-variant/30 text-on-surface"
                  )}
                  title={out ? `#${i + 1} ค่าผิดปกติ` : `#${i + 1}`}
                >
                  {fmt(v)} {out && "⚠"}
                </span>
              );
            })}
          </div>
          <div className="text-[10px] text-outline mt-1">หน่วย: {unit}</div>
        </>
      ) : (
        <p className="text-xs text-outline text-center py-2">ยังไม่มีข้อมูล</p>
      )}
    </div>
  );
}

const COLS = 10;

function CartonGrid({
  entries,
  perCarton,
  isOutlier,
}: {
  entries: any[];
  perCarton: ReturnType<typeof stats>;
  isOutlier: (v: number, s: ReturnType<typeof stats>) => boolean;
}) {
  // สร้าง map จาก entries
  const cells: Record<string, number> = {};
  let maxRow = 0;
  entries.forEach((e: any) => {
    cells[`${e.row_index}:${e.col_index}`] = Number(e.value);
    if (e.row_index > maxRow) maxRow = e.row_index;
  });
  const totalRows = entries.length > 0 ? maxRow + 1 : 0;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <Icon name="local_shipping" className="text-primary text-base" />
        <span className="section-title">Per Carton ({perCarton.count} ลัง)</span>
      </div>
      {perCarton.count > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-1 text-[10px] text-outline mb-3">
            <span>AVG: <b className="text-on-surface">{fmt(perCarton.avg)}</b></span>
            <span>MIN: <b className="text-on-surface">{fmt(perCarton.min)}</b></span>
            <span>MAX: <b className="text-on-surface">{fmt(perCarton.max)}</b></span>
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <tbody>
                {Array.from({ length: totalRows }, (_, r) => (
                  <tr key={r}>
                    <td className="text-outline pr-1 text-[10px] font-bold whitespace-nowrap">
                      {r * COLS + 1}-{(r + 1) * COLS}
                    </td>
                    {Array.from({ length: COLS }, (_, c) => {
                      const cartonNo = r * COLS + c + 1;
                      const val = cells[`${r}:${c}`];
                      const hasVal = val !== undefined;
                      const out = hasVal && isOutlier(val, perCarton);
                      return (
                        <td key={c} className="p-0.5 text-center">
                          <div className="text-[9px] text-outline font-bold">{cartonNo}</div>
                          <div
                            className={clsx(
                              "w-14 h-9 flex items-center justify-center text-[11px] font-bold rounded",
                              !hasVal
                                ? "bg-surface-container-low border border-outline-variant/20 text-outline"
                                : out
                                ? "bg-error-container/60 border-2 border-error text-error"
                                : "bg-surface-container-low border border-outline-variant/30 text-on-surface"
                            )}
                          >
                            {hasVal ? fmt(val) : ""}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-xs text-outline text-center py-2">ยังไม่มีข้อมูล Per Carton</p>
      )}
    </div>
  );
}
