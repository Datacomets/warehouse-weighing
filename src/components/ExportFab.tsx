"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./Icon";
import { Toast, useToast } from "./Toast";
import { buildCsv, downloadCsv } from "@/lib/exportCsv";
import { stats } from "@/lib/stats";
import { translateSupabaseError } from "@/lib/supabaseError";
import { canExportReport } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  in_progress: "กำลังดำเนินการ",
  pending_sap: "รอนำเข้า SAP",
  completed: "เสร็จสมบูรณ์",
};

/**
 * Headers for the exported CSV. Keeping the list explicit (vs derived from
 * row keys) makes column order stable and self-documenting.
 */
const HEADERS = [
  "wh_number",
  "status",
  "lot",
  "po_number",
  "item_code",
  "description",
  "supplier",
  "delivery_date",
  "mfg_date",
  "exp_date",
  "lot_number",
  "scale_name",
  "weight_unit",
  "qty_per_carton",
  "width_cm",
  "length_cm",
  "height_cm",
  "gross_weight",
  "net_weight",
  "qc_status",
  "remarks",
  "per_pcs_count",
  "per_pcs_avg",
  "per_pcs_min",
  "per_pcs_max",
  "per_inner_count",
  "per_inner_avg",
  "per_inner_min",
  "per_inner_max",
  "per_carton_count",
  "per_carton_avg",
  "per_carton_min",
  "per_carton_max",
  "full_cartons",
  "remainder_pcs",
  "total_pcs",
  "skip_per_pcs",
  "skip_reason_per_pcs",
  "skip_per_inner",
  "skip_reason_per_inner",
  "skip_per_carton",
  "skip_reason_per_carton",
  "issue_count",
  "sap_inbound_id",
  "sap_notification_id",
  "created_by",
  "submitted_by",
  "closed_by",
  "unlock_reason",
  "created_at",
  "started_at",
  "submitted_at",
  "ended_at",
  "closed_at",
  "lead_time_minutes",
];

function fmt3(n: number): string {
  return n.toFixed(3);
}

export function ExportFab({ role }: { role: UserRole }) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (!canExportReport(role)) return null;

  async function handleExport() {
    if (busy) return;
    setBusy(true);
    try {
      const [
        { data: docs, error: docsErr },
        { data: profiles, error: profErr },
        { data: measurements, error: mErr },
        { data: gridEntries, error: gErr },
        { data: issues, error: iErr },
      ] = await Promise.all([
        supabase
          .from("gr_documents")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name"),
        supabase.from("weight_measurements").select("document_id,kind,value"),
        supabase.from("count_grid_entries").select("document_id,value"),
        supabase.from("issue_reports").select("document_id"),
      ]);

      const err = docsErr || profErr || mErr || gErr || iErr;
      if (err) {
        toast.error(translateSupabaseError(err));
        return;
      }

      const profileMap = new Map<string, string>();
      for (const p of profiles || []) profileMap.set(p.id, p.full_name);

      const measByDoc = new Map<
        string,
        { per_pcs: number[]; per_inner: number[]; per_carton: number[] }
      >();
      for (const m of measurements || []) {
        const id = (m as any).document_id as string;
        let bucket = measByDoc.get(id);
        if (!bucket) {
          bucket = { per_pcs: [], per_inner: [], per_carton: [] };
          measByDoc.set(id, bucket);
        }
        const k = (m as any).kind as keyof typeof bucket;
        if (bucket[k]) bucket[k].push(Number((m as any).value));
      }

      const gridByDoc = new Map<string, number[]>();
      for (const g of gridEntries || []) {
        const id = (g as any).document_id as string;
        let arr = gridByDoc.get(id);
        if (!arr) {
          arr = [];
          gridByDoc.set(id, arr);
        }
        arr.push(Number((g as any).value));
      }

      const issueCountByDoc = new Map<string, number>();
      for (const i of issues || []) {
        const id = (i as any).document_id as string;
        issueCountByDoc.set(id, (issueCountByDoc.get(id) || 0) + 1);
      }

      const rows = (docs || []).map((d: any) => {
        const m = measByDoc.get(d.id) || {
          per_pcs: [],
          per_inner: [],
          per_carton: [],
        };
        const grid = gridByDoc.get(d.id) || [];
        const pcsS = stats(m.per_pcs);
        const innerS = stats(m.per_inner);
        const cartonS = stats(m.per_carton);
        const gridS = stats(grid);

        const fullCartons = grid.length;
        const remainderPcs = Number(d.remainder_pcs) || 0;
        const qtyPerCarton = Number(d.qty_per_carton) || 0;
        const totalPcs = qtyPerCarton * fullCartons + remainderPcs;

        const leadTime =
          d.closed_at && d.started_at
            ? Math.round(
                (new Date(d.closed_at).getTime() -
                  new Date(d.started_at).getTime()) /
                  60000
              )
            : "";

        return {
          wh_number: d.wh_number,
          status: STATUS_LABEL[d.status] ?? d.status,
          lot: d.lot,
          po_number: d.po_number,
          item_code: d.item_code,
          description: d.description,
          supplier: d.supplier,
          delivery_date: d.delivery_date,
          mfg_date: d.mfg_date,
          exp_date: d.exp_date,
          lot_number: d.lot_number,
          scale_name: d.scale_name,
          weight_unit: d.weight_unit,
          qty_per_carton: d.qty_per_carton,
          width_cm: d.width_cm,
          length_cm: d.length_cm,
          height_cm: d.height_cm,
          gross_weight: d.gross_weight,
          net_weight: d.net_weight,
          qc_status: d.qc_status,
          remarks: d.remarks,
          per_pcs_count: pcsS.count,
          per_pcs_avg: pcsS.count ? fmt3(pcsS.avg) : "",
          per_pcs_min: pcsS.count ? fmt3(pcsS.min) : "",
          per_pcs_max: pcsS.count ? fmt3(pcsS.max) : "",
          per_inner_count: innerS.count,
          per_inner_avg: innerS.count ? fmt3(innerS.avg) : "",
          per_inner_min: innerS.count ? fmt3(innerS.min) : "",
          per_inner_max: innerS.count ? fmt3(innerS.max) : "",
          per_carton_count: gridS.count,
          per_carton_avg: gridS.count ? fmt3(gridS.avg) : "",
          per_carton_min: gridS.count ? fmt3(gridS.min) : "",
          per_carton_max: gridS.count ? fmt3(gridS.max) : "",
          full_cartons: fullCartons,
          remainder_pcs: remainderPcs,
          total_pcs: totalPcs,
          skip_per_pcs: d.skip_per_pcs ? "Y" : "",
          skip_reason_per_pcs: d.skip_reason_per_pcs || "",
          skip_per_inner: d.skip_per_inner ? "Y" : "",
          skip_reason_per_inner: d.skip_reason_per_inner || "",
          skip_per_carton: d.skip_per_carton ? "Y" : "",
          skip_reason_per_carton: d.skip_reason_per_carton || "",
          issue_count: issueCountByDoc.get(d.id) || 0,
          sap_inbound_id: d.sap_inbound_id,
          sap_notification_id: d.sap_notification_id,
          created_by: profileMap.get(d.created_by) || "",
          submitted_by: profileMap.get(d.submitted_by) || "",
          closed_by: profileMap.get(d.closed_by) || "",
          unlock_reason: d.unlock_reason,
          created_at: d.created_at,
          started_at: d.started_at,
          submitted_at: d.submitted_at,
          ended_at: d.ended_at,
          closed_at: d.closed_at,
          lead_time_minutes: leadTime,
        };
      });

      const csv = buildCsv(rows, HEADERS);
      const ts = new Date().toISOString().slice(0, 10);
      downloadCsv(csv, `comets-gr-report-${ts}.csv`);
      toast.show(`ส่งออก ${rows.length} เอกสารสำเร็จ`);
    } catch (e: any) {
      toast.error(e?.message || "ส่งออกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Toast message={toast.msg} variant={toast.variant} />
      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        title="ดาวน์โหลดรายงานทั้งหมดเป็น CSV"
        aria-label="ดาวน์โหลดรายงาน CSV"
        className="fixed bottom-24 right-6 z-30 inline-flex items-center justify-center gap-2 h-14 px-6 rounded-xl bg-primary-container text-on-primary font-headline font-bold tracking-tight shadow-fab active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed no-print"
      >
        {busy ? (
          <>
            <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>กำลังเตรียม...</span>
          </>
        ) : (
          <>
            <Icon name="download" filled />
            <span>Export Report</span>
          </>
        )}
      </button>
    </>
  );
}
