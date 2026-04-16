import { describe, it, expect } from "vitest";
import { isOutlier, isOutlierIn } from "./outlier";
import { stats } from "./stats";

describe("isOutlier()", () => {
  it("is false when fewer than 3 samples", () => {
    expect(isOutlier(100, stats([100]))).toBe(false);
    expect(isOutlier(100, stats([100, 200]))).toBe(false);
  });

  it("is false when all values are identical (range = 0)", () => {
    expect(isOutlier(5, stats([5, 5, 5, 5]))).toBe(false);
  });

  it("is false for zero or negative candidate values", () => {
    const s = stats([1, 2, 3, 4, 100]);
    expect(isOutlier(0, s)).toBe(false);
    expect(isOutlier(-5, s)).toBe(false);
  });

  it("is false for non-finite candidate values", () => {
    const s = stats([1, 2, 3, 4, 100]);
    expect(isOutlier(NaN, s)).toBe(false);
    expect(isOutlier(Infinity, s)).toBe(false);
  });

  it("flags a value outside 45% of the range", () => {
    // values: [10, 10, 10, 100] → min=10, max=100, avg=32.5, range=90, threshold=40.5
    // |100 - 32.5| = 67.5 > 40.5 → outlier
    const s = stats([10, 10, 10, 100]);
    expect(isOutlier(100, s)).toBe(true);
  });

  it("does not flag values within 45% of the range", () => {
    // values: [10, 20, 30] → avg=20, range=20, threshold=9
    // |20-20|=0 → not outlier; |28-20|=8 → not outlier
    const s = stats([10, 20, 30]);
    expect(isOutlier(20, s)).toBe(false);
    expect(isOutlier(28, s)).toBe(false);
  });

  it("boundary: deviation exactly equal to 45% threshold is NOT an outlier (strict >)", () => {
    // Construct stats so avg=50, min=50, max=100 (range=50, threshold=22.5)
    // Use [50, 50, 50, 100] → avg=62.5, max=100, min=50, range=50, threshold=22.5
    // |40 - 62.5| = 22.5 → NOT outlier (strict >)
    const s = stats([50, 50, 50, 100]);
    expect(isOutlier(40, s)).toBe(false);
    // |39 - 62.5| = 23.5 > 22.5 → outlier
    expect(isOutlier(39, s)).toBe(true);
  });

  it("handles realistic scale weight scenario (grams)", () => {
    // 10 weighings clustered around 100g, plus one wild reading
    const readings = [100, 101, 99, 100, 102, 98, 100, 101, 99, 250];
    const s = stats(readings);
    expect(isOutlier(250, s)).toBe(true);
    expect(isOutlier(100, s)).toBe(false);
  });
});

describe("isOutlierIn() convenience wrapper", () => {
  it("equals isOutlier(stats(values)) for the same value", () => {
    const values = [1, 2, 3, 4, 100];
    expect(isOutlierIn(100, values)).toBe(isOutlier(100, stats(values)));
    expect(isOutlierIn(2, values)).toBe(isOutlier(2, stats(values)));
  });

  it("returns false for an empty dataset", () => {
    expect(isOutlierIn(10, [])).toBe(false);
  });
});
