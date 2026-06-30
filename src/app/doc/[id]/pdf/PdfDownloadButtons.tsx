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
}: {
  doc: any;
  grid: any[];
  items?: any[];
  perPcs: any;
  perInner: any;
  perCarton: any;
  issues?: any[];
}) {
  return (
    <>
      <PDFDownloadLink
        document={
          <WeightSheetPdf doc={doc} grid={grid} items={items} perPcs={perPcs} perInner={perInner} perCarton={perCarton} issues={issues} />
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
        document={<CountSheetPdf doc={doc} grid={grid} />}
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
