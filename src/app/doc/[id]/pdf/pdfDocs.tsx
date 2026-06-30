"use client";
import { Document, Font, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { fmt, fmtDate, fmtDateTime, leadTimeText } from "@/lib/stats";
import {
  countGridStats,
  reorganizeGridToRows,
  totalPiecesCount,
  weightValuesByKind,
  gridValuesSorted,
  weightUnitLabel,
} from "@/lib/documentSummary";
import { ISSUE_TYPES, DEFECT_CODES } from "@/lib/mock-erp";

const issueTypeLabel = (v: string) => ISSUE_TYPES.find((t) => t.value === v)?.label || v;
const defectLabel = (c: string) =>
  c ? DEFECT_CODES.find((d) => d.code === c)?.label || c : "-";

// Helvetica (the @react-pdf default) has no Thai glyphs, so Thai text in
// the PDF rendered as garbled boxes. @react-pdf needs TTF/OTF — and modern
// @fontsource only ships woff/woff2 — so we pull Sarabun TTF from
// @expo-google-fonts/sarabun via jsDelivr. Pinned version + CORS headers
// keep this stable across builds and let the renderer fetch client-side.
Font.register({
  family: "Sarabun",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/npm/@expo-google-fonts/sarabun@0.4.1/400Regular/Sarabun_400Regular.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/npm/@expo-google-fonts/sarabun@0.4.1/700Bold/Sarabun_700Bold.ttf",
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Sarabun", color: "#191c1d" },
  h1: { fontSize: 16, fontWeight: 700, color: "#00003c", marginBottom: 2 },
  small: { fontSize: 8, color: "#767684" },
  row: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#c6c5d5", paddingBottom: 6, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  cell: { width: "50%", marginBottom: 4 },
  label: { color: "#767684", fontSize: 8 },
  val: { fontWeight: 700 },
  table: { borderWidth: 1, borderColor: "#c6c5d5", marginTop: 12 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#c6c5d5" },
  th: { flex: 1, padding: 4, backgroundColor: "#edeeef", fontWeight: 700 },
  td: { flex: 1, padding: 4 },
  sigBox: { flexDirection: "row", marginTop: 30, gap: 30 },
  sig: { flex: 1 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: "#191c1d", height: 30 },
  sigLabel: { textAlign: "center", marginTop: 4, color: "#767684" },
  small2: { fontSize: 9, marginBottom: 2 },
  readingWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 2, marginBottom: 2 },
  chip: {
    fontSize: 8,
    borderWidth: 0.5,
    borderColor: "#c6c5d5",
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginRight: 3,
    marginBottom: 3,
  },
});

function ReadingList({ label, meta, unit, values }: { label: string; meta?: string; unit: string; values: number[] }) {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={[styles.small2, { fontWeight: 700 }]}>
        {label}
        {meta ? ` — ${meta}` : ""} ({unit})
      </Text>
      {values.length === 0 ? (
        <Text style={styles.small}>ยังไม่มีค่าที่ชั่ง</Text>
      ) : (
        <View style={styles.readingWrap}>
          {values.map((v, i) => (
            <Text key={i} style={styles.chip}>
              #{i + 1} {fmt(v)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

export function WeightSheetPdf({ doc, grid, items, perPcs, perInner, perCarton, issues }: any) {
  const issueList = Array.isArray(issues) ? issues : [];
  const measurements = Array.isArray(items) ? items : [];
  const unitLabel = weightUnitLabel(doc.weight_unit);
  const perPcsValues = weightValuesByKind(measurements, "per_pcs");
  const perInnerValues = weightValuesByKind(measurements, "per_inner");
  const perCartonValues = gridValuesSorted(Array.isArray(grid) ? grid : []);
  const per100 = !!measurements.find((m: any) => m.kind === "per_pcs")?.per_100;
  const qtyPerInner = measurements.find((m: any) => m.kind === "per_inner")?.qty_per_inner ?? null;
  const cartonCount = Array.isArray(grid) ? grid.length : Number(doc.actual_count) || 0;
  const remainderPcs = Number(doc.remainder_pcs) || 0;
  const totalPcs = totalPiecesCount({
    qtyPerCarton: doc.qty_per_carton,
    cartonCount,
    remainderPcs,
  });
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.row}>
          <View>
            <Text style={styles.h1}>COMETS GR — Weight Sheet</Text>
            <Text style={styles.small}>ใบชั่งน้ำหนัก</Text>
          </View>
          <View>
            <Text style={styles.h1}>{doc.wh_number}</Text>
            <Text style={styles.small}>{doc.sap_inbound_id || "-"}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <Cell label="LOT" value={doc.lot} />
          <Cell label="PO" value={doc.po_number} />
          <Cell label="Item Code" value={doc.item_code} />
          <Cell label="Supplier Item Name" value={doc.supplier} />
          <Cell label="Description" value={doc.description} full />
          <Cell label="Lot Number" value={doc.lot_number} />
          <Cell label="Delivery Date" value={fmtDate(doc.delivery_date)} />
          <Cell label="Scale" value={doc.scale_name} />
          <Cell label="Qty / Carton" value={String(doc.qty_per_carton ?? "-")} />
          <Cell label="Full Cartons" value={String(doc.actual_count ?? "-")} />
          <Cell label="Remainder (pcs)" value={String(doc.remainder_pcs ?? "0")} />
          <Cell label="Unit" value={doc.weight_unit || "kg"} />
          <Cell label="MFG" value={fmtDate(doc.mfg_date)} />
          <Cell label="EXP" value={fmtDate(doc.exp_date)} />
          <Cell label="Gross Weight" value={`${doc.gross_weight ?? "-"} ${doc.weight_unit || "kg"}`} />
          <Cell label="Net Weight" value={`${doc.net_weight ?? "-"} ${doc.weight_unit || "kg"}`} />
        </View>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>หมวด</Text>
            <Text style={styles.th}>AVG</Text>
            <Text style={styles.th}>MIN</Text>
            <Text style={styles.th}>MAX</Text>
            <Text style={styles.th}>N</Text>
          </View>
          <Trow label="Per Pcs" data={perPcs} />
          <Trow label="Per Inner/Tray/Bag" data={perInner} />
          <Trow label="Per Carton" data={perCarton} />
        </View>

        <Text style={[styles.small2, { marginTop: 12, fontWeight: 700 }]}>รายละเอียดค่าที่ชั่ง</Text>
        <ReadingList
          label="ชั่งต่อชิ้น (Per Pcs)"
          meta={per100 ? "Per 100 Pcs" : "Per 1 Pcs"}
          unit={unitLabel}
          values={perPcsValues}
        />
        <ReadingList
          label="ชั่งต่อถุง/ถาด (Per Inner)"
          meta={qtyPerInner ? `${qtyPerInner} ชิ้น/Inner` : undefined}
          unit={unitLabel}
          values={perInnerValues}
        />
        <ReadingList
          label="ชั่งต่อลัง (Per Carton)"
          unit={unitLabel}
          values={perCartonValues}
        />

        <Text style={[styles.small2, { marginTop: 8, fontWeight: 700 }]}>
          ปัญหาที่พบ ({issueList.length})
        </Text>
        {issueList.length === 0 ? (
          <Text style={styles.small}>ไม่มีปัญหา</Text>
        ) : (
          <View style={[styles.table, { marginTop: 4 }]}>
            <View style={styles.tr}>
              <Text style={[styles.th, { flex: 1.2 }]}>ประเภท</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>รหัสของเสีย</Text>
              <Text style={[styles.th, { flex: 0.6 }]}>จำนวน</Text>
              <Text style={[styles.th, { flex: 2 }]}>หมายเหตุ</Text>
            </View>
            {issueList.map((it: any, i: number) => (
              <View style={styles.tr} key={i}>
                <Text style={[styles.td, { flex: 1.2 }]}>{issueTypeLabel(it.issue_type)}</Text>
                <Text style={[styles.td, { flex: 1.5 }]}>{defectLabel(it.defect_code)}</Text>
                <Text style={[styles.td, { flex: 0.6 }]}>{it.quantity ?? "-"}</Text>
                <Text style={[styles.td, { flex: 2 }]}>{it.notes || "-"}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ marginTop: 12 }}>
          <Text style={styles.small2}>เริ่ม: {fmtDateTime(doc.started_at)}</Text>
          <Text style={styles.small2}>สิ้นสุด: {fmtDateTime(doc.ended_at)}</Text>
          <Text style={styles.small2}>Lead Time: {leadTimeText(doc.started_at, doc.ended_at)}</Text>
          <Text style={styles.small2}>
            Cartons ชั่งแล้ว: ({doc.qty_per_carton ?? 0} x {cartonCount} ลัง) + เศษ {remainderPcs} = {totalPcs.toLocaleString()} ชิ้น
          </Text>
          <Text style={styles.small2}>หมายเหตุ: {doc.remarks || "-"}</Text>
        </View>

        <View style={styles.sigBox}>
          <View style={styles.sig}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>(ผู้จัดทำ)</Text>
          </View>
          <View style={styles.sig}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>(ผู้ตรวจสอบ)</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function CountSheetPdf({ doc, grid }: any) {
  const rows = reorganizeGridToRows(grid);
  const { avg, min, max, count } = countGridStats(grid);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.row}>
          <View>
            <Text style={styles.h1}>COMETS GR — Count Sheet</Text>
            <Text style={styles.small}>ใบตรวจนับสินค้า</Text>
          </View>
          <View>
            <Text style={styles.h1}>{doc.wh_number}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <Cell label="LOT" value={doc.lot} />
          <Cell label="Item" value={doc.item_code} />
          <Cell label="Lot Number" value={doc.lot_number} />
          <Cell label="Description" value={doc.description} full />
        </View>

        <View style={{ marginTop: 12 }}>
          {rows.map((r, i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 2 }}>
              <Text style={{ width: 24, fontSize: 8, color: "#767684" }}>{i + 1}.</Text>
              {Array.from({ length: 10 }).map((_, c) => (
                <Text
                  key={c}
                  style={{
                    flex: 1,
                    fontSize: 8,
                    borderWidth: 0.5,
                    borderColor: "#c6c5d5",
                    padding: 2,
                    textAlign: "center",
                  }}
                >
                  {r?.[c] != null ? fmt(r[c]) : ""}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>AVG</Text>
            <Text style={styles.th}>MIN</Text>
            <Text style={styles.th}>MAX</Text>
            <Text style={styles.th}>Count</Text>
          </View>
          <View style={styles.tr}>
            <Text style={styles.td}>{fmt(avg)}</Text>
            <Text style={styles.td}>{fmt(min)}</Text>
            <Text style={styles.td}>{fmt(max)}</Text>
            <Text style={styles.td}>{count}</Text>
          </View>
        </View>

        <View style={styles.sigBox}>
          <View style={styles.sig}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>(ผู้จัดทำ)</Text>
          </View>
          <View style={styles.sig}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>(ผู้ตรวจสอบ)</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

function Cell({ label, value, full }: { label: string; value: any; full?: boolean }) {
  return (
    <View style={[styles.cell, full ? { width: "100%" } : {}]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.val}>{value || "-"}</Text>
    </View>
  );
}

function Trow({ label, data }: { label: string; data: any }) {
  return (
    <View style={styles.tr}>
      <Text style={styles.td}>{label}</Text>
      <Text style={styles.td}>{fmt(data.avg)}</Text>
      <Text style={styles.td}>{fmt(data.min)}</Text>
      <Text style={styles.td}>{fmt(data.max)}</Text>
      <Text style={styles.td}>{data.count}</Text>
    </View>
  );
}
