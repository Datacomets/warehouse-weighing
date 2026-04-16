import type { WeightKind } from "./types";

export interface SubmitChecklistInput {
  measurementKinds: Iterable<WeightKind | string>;
  gridCount: number;
  remainderPcs: number | null | undefined;
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
 *   - At least one per_pcs measurement
 *   - At least one per_inner measurement
 *   - At least one count_grid_entry (per_carton weighing)
 *   - Remainder recorded (non-null; can be 0). Only meaningful if at least one
 *     carton was weighed.
 */
export function computeSubmitChecklist(input: SubmitChecklistInput): SubmitChecklist {
  const kinds = new Set<string>();
  for (const k of input.measurementKinds) kinds.add(String(k));

  const hasPcs = kinds.has("per_pcs");
  const hasInner = kinds.has("per_inner");
  const hasCarton = input.gridCount > 0;
  const hasRemainder = hasCarton && input.remainderPcs != null;
  const hasAll = hasPcs && hasInner && hasCarton && hasRemainder;

  return { hasPcs, hasInner, hasCarton, hasRemainder, hasAll };
}
