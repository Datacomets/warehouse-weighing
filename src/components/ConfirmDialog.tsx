"use client";
import { useCallback, useRef, useState } from "react";
import { Icon } from "./Icon";
import { clsx } from "clsx";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);
  pendingRef.current = pending;

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    const p = pendingRef.current;
    if (!p) return;
    setPending(null);
    p.resolve(ok);
  }, []);

  const DialogElement = pending ? (
    <ConfirmDialog
      title={pending.title}
      message={pending.message}
      confirmLabel={pending.confirmLabel}
      cancelLabel={pending.cancelLabel}
      destructive={pending.destructive}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  ) : null;

  return { confirm, DialogElement };
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 animate-fade-in"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-surface-container-high rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col gap-4"
      >
        <div className="flex items-start gap-3">
          <span
            className={clsx(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              destructive ? "bg-error-container" : "bg-primary-container"
            )}
          >
            <Icon
              name={destructive ? "warning" : "help"}
              className={destructive ? "text-on-error-container" : "text-on-primary-container"}
            />
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="confirm-title" className="font-headline font-bold text-base leading-tight">
              {title}
            </h2>
            {message && <p className="text-sm text-outline mt-2">{message}</p>}
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary flex-1 h-12"
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={clsx(
              "flex-1 h-12 rounded-full font-bold text-sm",
              destructive
                ? "bg-error text-on-error hover:bg-error/90"
                : "btn-primary"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
