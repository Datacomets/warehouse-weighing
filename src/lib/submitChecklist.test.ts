import { describe, it, expect } from "vitest";
import { computeSubmitChecklist } from "./submitChecklist";

describe("computeSubmitChecklist()", () => {
  it("returns all false for an empty document", () => {
    expect(
      computeSubmitChecklist({ measurementKinds: [], gridCount: 0, remainderPcs: null })
    ).toEqual({
      hasPcs: false,
      hasInner: false,
      hasCarton: false,
      hasRemainder: false,
      hasAll: false,
    });
  });

  it("hasAll=true when all four steps are complete", () => {
    const result = computeSubmitChecklist({
      measurementKinds: ["per_pcs", "per_inner", "per_carton"],
      gridCount: 5,
      remainderPcs: 0,
    });
    expect(result).toEqual({
      hasPcs: true,
      hasInner: true,
      hasCarton: true,
      hasRemainder: true,
      hasAll: true,
    });
  });

  it("remainderPcs=0 counts as recorded (not missing)", () => {
    const result = computeSubmitChecklist({
      measurementKinds: ["per_pcs", "per_inner"],
      gridCount: 3,
      remainderPcs: 0,
    });
    expect(result.hasRemainder).toBe(true);
    expect(result.hasAll).toBe(true);
  });

  it("remainderPcs=undefined is treated the same as null (not recorded)", () => {
    const result = computeSubmitChecklist({
      measurementKinds: ["per_pcs", "per_inner"],
      gridCount: 3,
      remainderPcs: undefined,
    });
    expect(result.hasRemainder).toBe(false);
    expect(result.hasAll).toBe(false);
  });

  it("hasAll=false when per_pcs is missing", () => {
    const result = computeSubmitChecklist({
      measurementKinds: ["per_inner", "per_carton"],
      gridCount: 5,
      remainderPcs: 0,
    });
    expect(result.hasPcs).toBe(false);
    expect(result.hasAll).toBe(false);
  });

  it("hasAll=false when per_inner is missing", () => {
    const result = computeSubmitChecklist({
      measurementKinds: ["per_pcs", "per_carton"],
      gridCount: 5,
      remainderPcs: 0,
    });
    expect(result.hasInner).toBe(false);
    expect(result.hasAll).toBe(false);
  });

  it("hasCarton is derived from gridCount, not from measurementKinds", () => {
    // gridCount is authoritative for per_carton — measurements.kind='per_carton' shouldn't matter
    const withKindNoGrid = computeSubmitChecklist({
      measurementKinds: ["per_pcs", "per_inner", "per_carton"],
      gridCount: 0,
      remainderPcs: 0,
    });
    expect(withKindNoGrid.hasCarton).toBe(false);

    const withGridNoKind = computeSubmitChecklist({
      measurementKinds: ["per_pcs", "per_inner"],
      gridCount: 1,
      remainderPcs: 0,
    });
    expect(withGridNoKind.hasCarton).toBe(true);
  });

  it("hasRemainder requires hasCarton: remainder recorded with no cartons is still false", () => {
    const result = computeSubmitChecklist({
      measurementKinds: ["per_pcs", "per_inner"],
      gridCount: 0,
      remainderPcs: 5,
    });
    expect(result.hasRemainder).toBe(false);
    expect(result.hasAll).toBe(false);
  });

  it("handles duplicate kinds (Set semantics)", () => {
    const result = computeSubmitChecklist({
      measurementKinds: ["per_pcs", "per_pcs", "per_inner", "per_inner"],
      gridCount: 2,
      remainderPcs: 10,
    });
    expect(result.hasPcs).toBe(true);
    expect(result.hasInner).toBe(true);
  });

  it("ignores unknown measurement kinds", () => {
    const result = computeSubmitChecklist({
      measurementKinds: ["gibberish", "per_pcs", "per_inner"],
      gridCount: 1,
      remainderPcs: 0,
    });
    expect(result.hasAll).toBe(true);
  });
});
