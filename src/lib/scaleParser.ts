/**
 * Extracts a weight reading from a raw scale line.
 *
 * Handles these common protocols:
 *   - Generic ASCII: `ST,GS,  0.450 kg\r\n`
 *   - A&D:           `ST,+  0.4500  g\r\n`
 *   - Ohaus:         `   0.450 kg\r\n`
 *   - Mettler:       `S S     0.450 kg\r\n`
 *
 * Returns `null` when:
 *   - The line has no numeric value
 *   - The value is not finite (NaN / ±Infinity)
 *   - The value is ≤ 0 (treated as "scale not stable yet"; the hook
 *     waits for a positive reading before reporting)
 */
export function parseWeight(raw: string): number | null {
  // Strip control characters (keep \n \t \r but drop the rest)
  const cleaned = raw.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, "").trim();
  if (!cleaned) return null;

  // First number pattern with optional sign
  const match = cleaned.match(/[+-]?\s*\d+\.?\d*/);
  if (!match) return null;

  const val = parseFloat(match[0].replace(/\s/g, ""));
  if (!Number.isFinite(val)) return null;
  if (val <= 0) return null;

  return val;
}
