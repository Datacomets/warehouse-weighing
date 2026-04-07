import { clsx } from "clsx";

export function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="label-base">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-outline mt-1">{hint}</p>}
    </div>
  );
}

export function SectionHeader({ icon, title, accent }: { icon?: string; title: string; accent?: boolean }) {
  return (
    <div className={clsx("flex items-center gap-2 mt-2 mb-3", accent && "border-l-4 border-primary-container pl-3")}>
      {icon && <span className="material-symbols-outlined text-primary text-base">{icon}</span>}
      <h2 className="font-headline font-bold text-sm uppercase tracking-wider text-primary">
        {title}
      </h2>
    </div>
  );
}
