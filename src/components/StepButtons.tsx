import Link from "next/link";
import { Icon } from "./Icon";

export function StepButtons({
  prev,
  prevLabel,
  next,
  nextLabel,
}: {
  prev?: string;
  prevLabel?: string;
  next?: string;
  nextLabel?: string;
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
      </div>
    </div>
  );
}
