import Link from "next/link";
import { Icon } from "./Icon";
import { canExportReport } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";

/**
 * Floating "Export Report" button. It used to dump every document to CSV in the
 * browser; that is now the Report page's job (filters, Thai headers, Excel/PDF/CSV,
 * all columns), so the button simply takes the user there.
 */
export function ExportFab({ role }: { role: UserRole }) {
  if (!canExportReport(role)) return null;
  return (
    <Link
      href="/report"
      title="ไปหน้า Report เพื่อเลือกข้อมูลและดาวน์โหลด"
      aria-label="ไปหน้า Report"
      className="fixed bottom-24 right-6 z-30 inline-flex items-center justify-center gap-2 h-14 px-6 rounded-xl bg-primary-container text-on-primary font-headline font-bold tracking-tight shadow-fab active:scale-95 transition no-print"
    >
      <Icon name="download" filled />
      <span>Export Report</span>
    </Link>
  );
}
