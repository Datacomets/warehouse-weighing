"use client";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { WeightSheetPdf, CountSheetPdf } from "./pdfDocs";
import { Icon } from "@/components/Icon";

export default function PdfDownloadButtons({
  doc,
  grid,
  perPcs,
  perInner,
  perCarton,
}: {
  doc: any;
  grid: any[];
  perPcs: any;
  perInner: any;
  perCarton: any;
}) {
  return (
    <>
      <PDFDownloadLink
        document={
          <WeightSheetPdf doc={doc} perPcs={perPcs} perInner={perInner} perCarton={perCarton} />
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
