"use client";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { WeightSheetPdf, CountSheetPdf } from "./pdfDocs";
import { Icon } from "@/components/Icon";

export default function PdfDownloadButtons({
  doc,
  grid,
  items = [],
  perPcs,
  perInner,
  perCarton,
  issues = [],
  preparedBy = "",
  checkedBy = "",
}: {
  doc: any;
  grid: any[];
  items?: any[];
  perPcs: any;
  perInner: any;
  perCarton: any;
  issues?: any[];
  preparedBy?: string;
  checkedBy?: string;
}) {
  return (
    <>
      <PDFDownloadLink
        document={
          <WeightSheetPdf doc={doc} grid={grid} items={items} perPcs={perPcs} perInner={perInner} perCarton={perCarton} issues={issues} preparedBy={preparedBy} checkedBy={checkedBy} />
        }
        fileName={`${doc.wh_number}-weight.pdf`}
        className="btn-primary"
      >
        {({ loading }) => (
          <>
            <Icon name="download" />
            {loading ? "กำลังสร้าง..." : "Download ใบชั่งน้ำหนัก (PDF)"}
          </>
        )}
      </PDFDownloadLink>

      <PDFDownloadLink
        document={<CountSheetPdf doc={doc} grid={grid} preparedBy={preparedBy} checkedBy={checkedBy} />}
        fileName={`${doc.wh_number}-count.pdf`}
        className="btn-secondary"
      >
        {({ loading }) => (
          <>
            <Icon name="download" />
            {loading ? "กำลังสร้าง..." : "Download ใบตรวจนับ (PDF)"}
          </>
        )}
      </PDFDownloadLink>
    </>
  );
}
