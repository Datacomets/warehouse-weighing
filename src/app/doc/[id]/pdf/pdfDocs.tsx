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

// react-pdf drops the final glyph of a text run for scripts that don't end on
// a space (Thai), e.g. the ก in "ใบชั่งน้ำหนัก". Appending a trailing space
// makes the (invisible) space the last glyph instead of a real character.
const noClip = (s: unknown): string => {
  const str = s == null ? "" : String(s);
  return str === "" ? str : `${str} `;
};

const issueTypeLabel = (v: string) => noClip(ISSUE_TYPES.find((t) => t.value === v)?.label || v);
const defectLabel = (c: string) =>
  c ? noClip(DEFECT_CODES.find((d) => d.code === c)?.label || c) : "-";

// Packed item descriptions/codes are comma-delimited with no spaces, so the
// PDF text layout treats the whole string as one word and lets it run off the
// right edge of the page. Insert zero-width spaces after separators to give
// the line breaker somewhere to wrap.
const softBreak = (s: unknown): string =>
  s == null
    ? ""
    : String(s)
        // break after common separators
        .replace(/([,/|_])/g, "$1\u200B")
        // and inside any long run with no break opportunity at all
        .replace(/([^\s\u200B]{14})(?=[^\s\u200B])/g, "$1\u200B");

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
  sigSpace: { height: 26 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: "#191c1d" },
  sigLabel: { textAlign: "center", marginTop: 4, color: "#767684" },
  sigName: { textAlign: "center", fontSize: 9, fontWeight: 700, marginBottom: 1 },
  small2: { fontSize: 9, marginBottom: 2 },
  catLabel: { fontSize: 9, fontWeight: 700 },
  metaPill: {
    fontSize: 7,
    fontWeight: 700,
    color: "#321d00",
    backgroundColor: "#ffddb7",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  statLine: { fontSize: 8, color: "#5b5b66", marginTop: 1 },
  extraLine: { fontSize: 8, color: "#7a5b00", marginTop: 1 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 3 },
  chip: {
    fontSize: 8,
    fontWeight: 700,
    color: "#00003c",
    borderWidth: 0.5,
    borderColor: "#c6c5d5",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  chipSeq: { color: "#767684", fontWeight: 400 },
  rtable: { borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: "#c6c5d5", marginTop: 3 },
  rtr: { flexDirection: "row" },
  rcell: {
    flex: 1,
    fontSize: 8,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: "#c6c5d5",
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  rseqCell: { flex: 0.42, color: "#767684", textAlign: "center", backgroundColor: "#f4f4f6" },
  rHead: { backgroundColor: "#edeeef", fontWeight: 700, textAlign: "center", color: "#191c1d" },
});

const READING_COLS = 5;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function CategoryBlock({
  label,
  meta,
  unit,
  values,
  data,
  skipped,
  reason,
  extra,
  first,
}: {
  label: string;
  meta?: string;
  unit: string;
  values: number[];
  data: { avg: number; min: number; max: number; count: number };
  skipped?: boolean;
  reason?: string | null;
  extra?: string;
  first?: boolean;
}) {
  return (
    <View
      style={[
        { marginBottom: 8 },
        first ? {} : { borderTopWidth: 0.5, borderTopColor: "#c6c5d5", paddingTop: 6, marginTop: 2 },
      ]}
      wrap={false}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={styles.catLabel}>{label}</Text>
        {meta && !skipped ? <Text style={styles.metaPill}>{meta}</Text> : null}
      </View>

      {skipped ? (
        <Text style={styles.statLine}>{noClip(`ข้าม${reason ? `: ${reason}` : ""}`)}</Text>
      ) : values.length === 0 ? (
        <Text style={styles.statLine}>ยังไม่มีค่าที่ชั่ง </Text>
      ) : (
        <>
          <Text style={styles.statLine}>
            AVG {fmt(data.avg)} · MIN {fmt(data.min)} · MAX {fmt(data.max)} · {data.count} ครั้ง ({unit})
          </Text>
          {extra ? <Text style={styles.extraLine}>{extra}</Text> : null}
          <View style={styles.rtable}>
            <View style={styles.rtr}>
              {Array.from({ length: READING_COLS }).flatMap((_, c) => [
                <Text key={`hs${c}`} style={[styles.rcell, styles.rHead, { flex: 0.42 }]}>
                  {noClip("ลำดับ")}
                </Text>,
                <Text key={`hv${c}`} style={[styles.rcell, styles.rHead]}>
                  {noClip("น้ำหนักที่ชั่ง")}
                </Text>,
              ])}
            </View>
            {chunk(values, READING_COLS).map((row, r) => (
              <View style={styles.rtr} key={r}>
                {Array.from({ length: READING_COLS }).flatMap((_, c) => {
                  const idx = r * READING_COLS + c;
                  const v = row[c];
                  return [
                    <Text key={`s${c}`} style={[styles.rcell, styles.rseqCell]}>
                      {v != null ? idx + 1 : ""}
                    </Text>,
                    <Text key={`v${c}`} style={styles.rcell}>
                      {v != null ? fmt(v) : ""}
                    </Text>,
                  ];
                })}
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

export function WeightSheetPdf({ doc, grid, items, perPcs, perInner, perCarton, issues, preparedBy, checkedBy }: any) {
  const issueList = Array.isArray(issues) ? issues : [];
  const measurements = Array.isArray(items) ? items : [];
  const unitLabel = weightUnitLabel(doc.weight_unit);
  const fullCartonCount = Number(doc.actual_count) || 0;
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
            <Text style={styles.small}>ใบชั่งน้ำหนัก / Weight Sheet</Text>
          </View>
          <View>
            <Text style={styles.h1}>{doc.wh_number}</Text>
            <Text style={styles.small}>{doc.sap_inbound_id || "-"}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <Cell label="LOT" value={doc.lot} />
          <Cell label="PO" value={doc.po_number} />
          <Cell label="Item Code" value={softBreak(doc.item_code)} />
          <Cell label="Supplier Item Name" value={softBreak(doc.supplier)} />
          <Cell label="Description" value={noClip(softBreak(doc.description))} />
          <Cell label="Lot Number" value={doc.lot_number} />
          <Cell label="Delivery Date" value={fmtDate(doc.delivery_date)} />
          <Cell label="Weighing Machine Number" value={doc.scale_name} />
          <Cell label="Qty / Carton" value={String(doc.qty_per_carton ?? "-")} />
          <Cell label="Full carton" value={String(doc.actual_count ?? "-")} />
          <Cell label="Loose pieces" value={String(doc.remainder_pcs ?? "0")} />
          {fullCartonCount > 0 && remainderPcs > 0 ? (
            <Cell label="Partial carton" value="1" />
          ) : null}
          <Cell label="Unit" value={doc.weight_unit || "kg"} />
          <Cell label="MFG" value={fmtDate(doc.mfg_date)} />
          <Cell label="EXP" value={fmtDate(doc.exp_date)} />
          <Cell label="Gross Weight" value={`${doc.gross_weight ?? "-"} ${doc.weight_unit || "kg"}`} />
          <Cell label="Net Weight" value={`${doc.net_weight ?? "-"} ${doc.weight_unit || "kg"}`} />
        </View>

        <Text style={[styles.small2, { marginTop: 12, fontWeight: 700 }]}>รายละเอียดการชั่ง (หน่วย: {unitLabel})</Text>
        <CategoryBlock
          label="ชั่งต่อชิ้น (Per Pcs)"
          meta={per100 ? "Per 100 Pcs" : "Per 1 Pcs"}
          unit={unitLabel}
          values={perPcsValues}
          data={perPcs}
          first
          skipped={!!doc.skip_per_pcs}
          reason={doc.skip_reason_per_pcs}
          extra={
            per100 && perPcs.count > 0
              ? `น้ำหนักต่อ 1 ชิ้น ≈ ${fmt(perPcs.avg / 100, 5)} ${unitLabel}`
              : undefined
          }
        />
        <CategoryBlock
          label="ชั่งต่อถุง/ถาด (Per Inner)"
          meta={qtyPerInner ? `${qtyPerInner} ชิ้น / Inner` : undefined}
          unit={unitLabel}
          values={perInnerValues}
          data={perInner}
          skipped={!!doc.skip_per_inner}
          reason={doc.skip_reason_per_inner}
        />
        <CategoryBlock
          label="ชั่งต่อลัง (Per Carton)"
          unit={unitLabel}
          values={perCartonValues}
          data={perCarton}
          skipped={!!doc.skip_per_carton}
          reason={doc.skip_reason_per_carton}
        />

        <Text style={[styles.small2, { marginTop: 8, fontWeight: 700 }]}>
          ปัญหาที่พบ ({issueList.length})
        </Text>
        {issueList.length === 0 ? (
          <Text style={styles.small}>ไม่มีปัญหา </Text>
        ) : (
          <View style={[styles.table, { marginTop: 4 }]}>
            <View style={styles.tr}>
              <Text style={[styles.th, { flex: 1.2 }]}>ประเภท </Text>
              <Text style={[styles.th, { flex: 1.5 }]}>รหัสของเสีย </Text>
              <Text style={[styles.th, { flex: 0.6 }]}>จำนวน </Text>
              <Text style={[styles.th, { flex: 2 }]}>หมายเหตุ </Text>
            </View>
            {issueList.map((it: any, i: number) => (
              <View style={styles.tr} key={i}>
                <Text style={[styles.td, { flex: 1.2 }]}>{issueTypeLabel(it.issue_type)}</Text>
                <Text style={[styles.td, { flex: 1.5 }]}>{defectLabel(it.defect_code)}</Text>
                <Text style={[styles.td, { flex: 0.6 }]}>{it.quantity ?? "-"}</Text>
                <Text style={[styles.td, { flex: 2 }]}>{it.notes ? noClip(it.notes) : "-"}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ marginTop: 12 }}>
          <Text style={styles.small2}>เริ่ม: {fmtDateTime(doc.started_at)}</Text>
          <Text style={styles.small2}>สิ้นสุด: {fmtDateTime(doc.ended_at)}</Text>
          <Text style={styles.small2}>Lead Time: {noClip(leadTimeText(doc.started_at, doc.ended_at))}</Text>
          <Text style={styles.small2}>
            Cartons ชั่งแล้ว: ({doc.qty_per_carton ?? 0} x {cartonCount} ลัง) + เศษ {remainderPcs} = {totalPcs.toLocaleString()} ชิ้น{" "}
          </Text>
          <Text style={styles.small2}>หมายเหตุ: {doc.remarks ? noClip(doc.remarks) : "-"}</Text>
        </View>

        <SigBox preparedBy={preparedBy} checkedBy={checkedBy} />
      </Page>
    </Document>
  );
}

function SigBox({ preparedBy, checkedBy }: { preparedBy?: string; checkedBy?: string }) {
  return (
    <View style={styles.sigBox}>
      <SigCol name={preparedBy} role="(ผู้จัดทำ)" />
      <SigCol name={checkedBy} role="(ผู้ตรวจสอบ)" />
    </View>
  );
}

function SigCol({ name, role }: { name?: string; role: string }) {
  return (
    <View style={styles.sig}>
      <View style={styles.sigSpace} />
      {name ? <Text style={styles.sigName}>{noClip(name)}</Text> : null}
      <View style={styles.sigLine} />
      <Text style={styles.sigLabel}>{noClip(role)}</Text>
    </View>
  );
}

export function CountSheetPdf({ doc, grid, preparedBy, checkedBy }: any) {
  const rows = reorganizeGridToRows(grid);
  const { avg, min, max, count } = countGridStats(grid);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.row}>
          <View>
            <Text style={styles.h1}>COMETS GR — Count Sheet</Text>
            <Text style={styles.small}>ใบตรวจนับสินค้า / Count Sheet</Text>
          </View>
          <View>
            <Text style={styles.h1}>{doc.wh_number}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <Cell label="LOT" value={doc.lot} />
          <Cell label="Item" value={softBreak(doc.item_code)} />
          <Cell label="Lot Number" value={doc.lot_number} />
          <Cell label="Description" value={noClip(softBreak(doc.description))} full />
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

        <SigBox preparedBy={preparedBy} checkedBy={checkedBy} />
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

