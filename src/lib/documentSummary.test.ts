import { describe, it, expect } from "vitest";
import {
  weightUnitLabel,
  totalPiecesCount,
  weightStatsByKind,
  countGridStats,
  reorganizeGridToRows,
  type GridEntryLike,
  type MeasurementLike,
} from "./documentSummary";

describe("weightUnitLabel()", () => {
  it.each([
    ["kg", "kg"],
    ["g", "g"],
    ["pcs", "ชิ้น"],
  ])("maps %s → %s", (input, expected) => {
    expect(weightUnitLabel(input)).toBe(expected);
  });

  it.each([null, undefined, "", "unknown"])("falls back to 'kg' for %s", (input) => {
    expect(weightUnitLabel(input)).toBe("kg");
  });
});

describe("totalPiecesCount()", () => {
  it("multiplies qty_per_carton × cartons + remainder", () => {
    expect(
      totalPiecesCount({ qtyPerCarton: 90, cartonCount: 12, remainderPcs: 45 })
    ).toBe(90 * 12 + 45);
  });

  it("treats null/undefined qty and remainder as 0", () => {
    expect(
      totalPiecesCount({ qtyPerCarton: null, cartonCount: 5, remainderPcs: undefined })
    ).toBe(0);
  });

  it("accepts string-form numbers (Supabase numeric returns strings)", () => {
    expect(
      totalPiecesCount({ qtyPerCarton: "10", cartonCount: 3, remainderPcs: "7" })
    ).toBe(37);
  });

  it("returns 0 for empty doc (no qty, no cartons, no remainder)", () => {
    expect(totalPiecesCount({ qtyPerCarton: 0, cartonCount: 0, remainderPcs: 0 })).toBe(0);
  });
});

describe("weightStatsByKind()", () => {
  const items: MeasurementLike[] = [
    { kind: "per_pcs", value: 1.0 },
    { kind: "per_pcs", value: 2.0 },
    { kind: "per_pcs", value: 3.0 },
    { kind: "per_inner", value: 100 },
    { kind: "per_carton", value: 5000 },
  ];

  it("aggregates only measurements of the requested kind", () => {
    expect(weightStatsByKind(items, "per_pcs")).toEqual({
      avg: 2,
      min: 1,
      max: 3,
      count: 3,
    });
  });

  it("returns zero-stats when no measurement matches the kind", () => {
    expect(
      weightStatsByKind(
        [{ kind: "per_pcs", value: 1 }],
        "per_carton"
      )
    ).toEqual({ avg: 0, min: 0, max: 0, count: 0 });
  });

  it("coerces string-form numeric values", () => {
    const strs: MeasurementLike[] = [
      { kind: "per_inner", value: "2" as any },
      { kind: "per_inner", value: "4" as any },
    ];
    expect(weightStatsByKind(strs, "per_inner")).toEqual({
      avg: 3,
      min: 2,
      max: 4,
      count: 2,
    });
  });
});

describe("countGridStats()", () => {
  it("aggregates grid values regardless of row/col position", () => {
    const grid: GridEntryLike[] = [
      { row_index: 0, col_index: 0, value: 10 },
      { row_index: 0, col_index: 5, value: 20 },
      { row_index: 2, col_index: 1, value: 30 },
    ];
    expect(countGridStats(grid)).toEqual({ avg: 20, min: 10, max: 30, count: 3 });
  });

  it("returns zeros for empty grid", () => {
    expect(countGridStats([])).toEqual({ avg: 0, min: 0, max: 0, count: 0 });
  });
});

describe("reorganizeGridToRows()", () => {
  it("places each entry at [row_index][col_index]", () => {
    const grid: GridEntryLike[] = [
      { row_index: 0, col_index: 0, value: 10 },
      { row_index: 0, col_index: 9, value: 20 },
      { row_index: 1, col_index: 5, value: 30 },
    ];
    const rows = reorganizeGridToRows(grid);
    expect(rows[0][0]).toBe(10);
    expect(rows[0][9]).toBe(20);
    expect(rows[1][5]).toBe(30);
  });

  it("leaves sparse cells undefined (not 0)", () => {
    const rows = reorganizeGridToRows([
      { row_index: 0, col_index: 2, value: 5 },
    ]);
    expect(rows[0][0]).toBeUndefined();
    expect(rows[0][1]).toBeUndefined();
    expect(rows[0][2]).toBe(5);
  });

  it("handles out-of-order input (row 2 before row 0)", () => {
    const rows = reorganizeGridToRows([
      { row_index: 2, col_index: 0, value: 30 },
      { row_index: 0, col_index: 0, value: 10 },
    ]);
    expect(rows[0][0]).toBe(10);
    expect(rows[2][0]).toBe(30);
    // rows[1] is undefined (sparse) — matches current behavior
    expect(rows[1]).toBeUndefined();
  });

  it("returns empty array for empty input", () => {
    expect(reorganizeGridToRows([])).toEqual([]);
  });

  it("converts string-form numeric values to Number", () => {
    const rows = reorganizeGridToRows([
      { row_index: 0, col_index: 0, value: "12.5" as any },
    ]);
    expect(rows[0][0]).toBe(12.5);
  });
});
