import { stats } from "./stats";

export interface OutlierStats {
  avg: number;
  min: number;
  max: number;
  count: number;
}

/**
 * A value is flagged as an outlier when it deviates from the mean by more than
 * 45% of the observed range. Requires at least 3 finite samples and a non-zero
 * range, otherwise no value is ever an outlier.
 */
export function isOutlier(value: number, s: OutlierStats): boolean {
  if (s.count < 3) return false;
  if (!Number.isFinite(value) || value <= 0) return false;
  const range = s.max - s.min;
  if (range === 0) return false;
  return Math.abs(value - s.avg) > range * 0.45;
}

/** Convenience: compute stats AND outlier check from a raw value list. */
export function isOutlierIn(value: number, values: number[]): boolean {
  return isOutlier(value, stats(values));
}
