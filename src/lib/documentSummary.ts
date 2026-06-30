import { stats } from "./stats";
import type { WeightKind } from "./types";

export type WeightUnit = "kg" | "g" | "pcs" | string | null | undefined;

/** Maps a stored weight unit code to the Thai label used in UI + PDF. */
export function weightUnitLabel(unit: WeightUnit): string {
  if (unit === "g") return "g";
  if (unit === "pcs") return "ชิ้น";
  return "kg";
}

/** Total pieces = qty/carton × full-carton count + remainder pieces. */
export function totalPiecesCount({
  qtyPerCarton,
  cartonCount,
  remainderPcs,
}: {
  qtyPerCarton: number | string | null | undefined;
  cartonCount: number;
  remainderPcs: number | string | null | undefined;
}): number {
  const q = Number(qtyPerCarton) || 0;
  const r = Number(remainderPcs) || 0;
  return q * cartonCount + r;
}

/** Minimal weight-measurement shape the summary consumes. */
export interface MeasurementLike {
  kind?: WeightKind | string;
  value?: number | string | null;
}

/** stats() over all measurements matching the given kind. */
export function weightStatsByKind(items: MeasurementLike[], kind: WeightKind) {
  return stats(
    items.filter((i) => i.kind === kind).map((i) => Number(i.value))
  );
}

/** Sortable measurement shape with seq + metadata used for detail listings. */
interface MeasurementDetailLike extends MeasurementLike {
  seq?: number | null;
}

/** Individual measurement values for a kind, ordered by seq (entry order). */
export function weightValuesByKind(
  items: MeasurementDetailLike[],
  kind: WeightKind
): number[] {
  return items
    .filter((i) => i.kind === kind)
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    .map((i) => Number(i.value));
}

/** Grid (per-carton) values ordered row-major, matching how they were entered. */
export function gridValuesSorted(grid: GridEntryLike[]): number[] {
  return [...grid]
    .sort((a, b) => a.row_index - b.row_index || a.col_index - b.col_index)
    .map((g) => Number(g.value));
}

export interface GridEntryLike {
  row_index: number;
  col_index: number;
  value?: number | string | null;
}

/** stats() over every numeric value in the count grid. */
export function countGridStats(grid: GridEntryLike[]) {
  return stats(grid.map((g) => Number(g.value)));
}

/**
 * Reorganizes sparse grid entries into a 2D array indexed by [row][col].
 * Missing cells are `undefined`; rows are extended so that downstream
 * rendering can iterate by index without null-checking row existence.
 */
export function reorganizeGridToRows(
  grid: GridEntryLike[]
): (number | undefined)[][] {
  const rows: (number | undefined)[][] = [];
  for (const g of grid) {
    if (!rows[g.row_index]) rows[g.row_index] = [];
    rows[g.row_index][g.col_index] = Number(g.value);
  }
  return rows;
}
