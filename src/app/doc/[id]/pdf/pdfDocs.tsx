"use client";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { fmt, fmtDate, fmtDateTime, leadTimeText } from "@/lib/stats";
import { countGridStats, reorganizeGridToRows } from "@/lib/documentSummary";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Helvetica", color: "#191c1d" },
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
});

export function WeightSheetPdf({ doc, perPcs, perInner, perCarton }: any) {
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

        <View style={{ marginTop: 12 }}>
          <Text style={styles.small2}>เริ่ม: {fmtDateTime(doc.started_at)}</Text>
          <Text style={styles.small2}>สิ้นสุด: {fmtDateTime(doc.ended_at)}</Text>
          <Text style={styles.small2}>Lead Time: {leadTimeText(doc.started_at, doc.ended_at)}</Text>
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
