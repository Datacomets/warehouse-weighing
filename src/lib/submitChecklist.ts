import type { WeightKind } from "./types";

export interface SubmitChecklistInput {
  measurementKinds: Iterable<WeightKind | string>;
  gridCount: number;
  remainderPcs: number | null | undefined;
  skipPerPcs?: boolean;
  skipPerInner?: boolean;
  skipPerCarton?: boolean;
}

export interface SubmitChecklist {
  hasPcs: boolean;
  hasInner: boolean;
  hasCarton: boolean;
  hasRemainder: boolean;
  hasAll: boolean;
}

/**
 * Rule for allowing submission (status → pending_sap):
 *   - At least one per_pcs measurement (or the tab is explicitly skipped)
 *   - At least one per_inner measurement (or the tab is explicitly skipped)
 *   - At least one count_grid_entry (or the tab is explicitly skipped)
 *   - Remainder recorded (non-null; can be 0). Only required if the carton tab
 *     was actually weighed — a skipped carton tab skips remainder too.
 */
export function computeSubmitChecklist(input: SubmitChecklistInput): SubmitChecklist {
  const kinds = new Set<string>();
  for (const k of input.measurementKinds) kinds.add(String(k));

  const hasPcs = kinds.has("per_pcs") || !!input.skipPerPcs;
  const hasInner = kinds.has("per_inner") || !!input.skipPerInner;
  const cartonWeighed = input.gridCount > 0;
  const hasCarton = cartonWeighed || !!input.skipPerCarton;
  const hasRemainder = !!input.skipPerCarton
    ? true
    : cartonWeighed && input.remainderPcs != null;
  const hasAll = hasPcs && hasInner && hasCarton && hasRemainder;

  return { hasPcs, hasInner, hasCarton, hasRemainder, hasAll };
}
