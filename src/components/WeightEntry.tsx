"use client";
import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WeightKind, WeightMeasurement } from "@/lib/types";
import { stats, fmt } from "@/lib/stats";
import { StatsCard } from "./StatsCard";
import { Icon } from "./Icon";
import { clsx } from "clsx";

interface Props {
  documentId: string;
  kind: WeightKind;
  initial: WeightMeasurement[];
  readOnly?: boolean;
  showPer100Toggle?: boolean;       // per_pcs only
  showQtyPerInner?: boolean;        // per_inner only
  expectedCount?: number | null;    // per_carton only — actual_count
}

export function WeightEntry({
  documentId,
  kind,
  initial,
  readOnly,
  showPer100Toggle,
  showQtyPerInner,
  expectedCount,
}: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<WeightMeasurement[]>(initial);
  const [per100, setPer100] = useState<boolean>(initial[0]?.per_100 || false);
  const [qtyPerInner, setQtyPerInner] = useState<number | "">(initial[0]?.qty_per_inner || "");
  const [draft, setDraft] = useState<string>("");
  const [, startTransition] = useTransition();

  const values = items.map((i) => Number(i.value));
  const s = stats(values);

  // Highlight outliers: values significantly away from the average
  function isOutlier(v: number) {
    if (s.count < 3) return false;
    const range = s.max - s.min;
    if (range === 0) return false;
    return Math.abs(v - s.avg) > range * 0.45;
  }

  async function addValue() {
    const v = Number(draft);
    if (!Number.isFinite(v) || v <= 0) return;
    const seq = items.length + 1;
    const row: any = {
      document_id: documentId,
      kind,
      seq,
      value: v,
      per_100: showPer100Toggle ? per100 : false,
      qty_per_inner: showQtyPerInner && qtyPerInner ? Number(qtyPerInner) : null,
    };
    const { data, error } = await supabase
      .from("weight_measurements")
      .insert(row)
      .select("*")
      .single();
    if (!error && data) {
      setItems([...items, data as WeightMeasurement]);
      setDraft("");
    } else if (error) {
      alert(error.message);
    }
  }

  async function removeValue(id: string) {
    const { error } = await supabase.from("weight_measurements").delete().eq("id", id);
    if (!error) setItems(items.filter((i) => i.id !== id));
  }

  // Update qty_per_inner / per_100 across rows when toggled
  useEffect(() => {
    if (!showPer100Toggle || items.length === 0) return;
    startTransition(async () => {
      await supabase
        .from("weight_measurements")
        .update({ per_100: per100 })
        .eq("document_id", documentId)
        .eq("kind", "per_pcs");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [per100]);

  useEffect(() => {
    if (!showQtyPerInner || items.length === 0) return;
    if (qtyPerInner === "") return;
    startTransition(async () => {
      await supabase
        .from("weight_measurements")
        .update({ qty_per_inner: Number(qtyPerInner) })
        .eq("document_id", documentId)
        .eq("kind", "per_inner");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qtyPerInner]);

  return (
    <div className="flex flex-col gap-4">
      {showPer100Toggle && (
        <div className="card">
          <span className="section-title">หน่วยที่ชั่ง</span>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setPer100(false)}
              className={!per100 ? "btn-primary flex-1 h-11 text-sm" : "btn-secondary flex-1 h-11 text-sm"}
            >
              Per 1 Pcs
            </button>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setPer100(true)}
              className={per100 ? "btn-primary flex-1 h-11 text-sm" : "btn-secondary flex-1 h-11 text-sm"}
            >
              Per 100 Pcs
            </button>
          </div>
        </div>
      )}

      {showQtyPerInner && (
        <div className="card">
          <label className="label-base">จำนวนชิ้น / Inner</label>
          <input
            disabled={readOnly}
            type="number"
            inputMode="numeric"
            value={qtyPerInner}
            onChange={(e) => setQtyPerInner(e.target.value === "" ? "" : Number(e.target.value))}
            className="input-base"
            placeholder="เช่น 10"
          />
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <span className="section-title">บันทึกค่าที่ชั่ง</span>
          {expectedCount && (
            <span className="text-[11px] font-bold text-on-tertiary-container">
              ชั่งแล้ว {items.length} / {expectedCount} ลัง
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {items.map((m, i) => {
            const v = Number(m.value);
            const out = isOutlier(v);
            return (
              <div
                key={m.id}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border",
                  out
                    ? "bg-error-container/60 border-error/40"
                    : "bg-surface-container-low border-outline-variant/30"
                )}
              >
                <span className="w-8 text-xs font-bold text-outline">#{i + 1}</span>
                <span className="flex-1 font-headline font-bold text-primary">
                  {fmt(v)} <span className="text-xs text-outline font-normal">kg</span>
                </span>
                {out && (
                  <span className="text-error" title="ค่าผิดปกติ">
                    <Icon name="warning" className="text-base" />
                  </span>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeValue(m.id)}
                    className="p-1 text-outline hover:text-error transition-colors"
                  >
                    <Icon name="delete" className="text-base" />
                  </button>
                )}
              </div>
            );
          })}
          {items.length === 0 && (
            <p className="text-center text-xs text-outline py-4">ยังไม่มีค่าที่ชั่ง</p>
          )}
        </div>

        {!readOnly && (
          <div className="flex gap-2 mt-3">
            <input
              type="number"
              inputMode="decimal"
              step="0.001"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addValue();
                }
              }}
              className="input-base flex-1"
              placeholder="0.000 kg"
            />
            <button type="button" onClick={addValue} className="btn-primary px-4">
              <Icon name="add" />
              เพิ่ม
            </button>
          </div>
        )}
      </div>

      <StatsCard avg={s.avg} min={s.min} max={s.max} />

      {showPer100Toggle && per100 && s.count > 0 && (
        <div className="card border-l-4 border-tertiary-fixed-dim">
          <span className="section-title">น้ำหนักต่อ 1 ชิ้น (คำนวณ)</span>
          <p className="text-xl font-headline font-bold text-primary mt-1">
            {fmt(s.avg / 100, 5)} <span className="text-xs text-outline font-normal">kg</span>
          </p>
        </div>
      )}
    </div>
  );
}
