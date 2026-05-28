import Link from "next/link";
import { Icon } from "./Icon";

export function StepButtons({
  prev,
  prevLabel,
  next,
  nextLabel,
  backToAdmin,
}: {
  prev?: string;
  prevLabel?: string;
  next?: string;
  nextLabel?: string;
  /** When provided (admin/manager editing a non-in_progress doc), renders
   *  a third "กลับ Admin" link beside the next button so the editor can
   *  jump back to the admin queue without walking through the rest of the
   *  steps. Callers pass "/admin" — the main queue, not the doc detail. */
  backToAdmin?: string;
}) {
  return (
    <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-background via-background to-transparent px-4 py-4 z-30">
      <div className="flex gap-2">
        {prev && (
          <Link href={prev} className="btn-secondary flex-none px-4">
            <Icon name="arrow_back" /> {prevLabel || "ก่อนหน้า"}
          </Link>
        )}
        {next && (
          <Link href={next} className="btn-primary flex-1">
            {nextLabel || "ถัดไป"} <Icon name="arrow_forward" />
          </Link>
        )}
        {backToAdmin && (
          <Link
            href={backToAdmin}
            className="btn-secondary flex-none px-4 text-tertiary-fixed-dim"
            title="บันทึกอัตโนมัติแล้ว — กลับหน้า Admin"
          >
            <Icon name="check_circle" /> กลับ Admin
          </Link>
        )}
      </div>
    </div>
  );
}
