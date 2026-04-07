import { fmt } from "@/lib/stats";

export function StatsCard({
  avg,
  min,
  max,
  digits = 3,
}: {
  avg: number;
  min: number;
  max: number;
  digits?: number;
}) {
  return (
    <div className="card grid grid-cols-3 divide-x divide-surface-container">
      <Stat label="AVG" value={fmt(avg, digits)} />
      <Stat label="MIN" value={fmt(min, digits)} />
      <Stat label="MAX" value={fmt(max, digits)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center px-2">
      <span className="text-[10px] font-bold text-outline uppercase tracking-widest">
        {label}
      </span>
      <span className="text-xl font-headline font-bold text-primary mt-1">{value}</span>
    </div>
  );
}
