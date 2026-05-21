export type HomeTab = "in_progress" | "completed";

/** Fields that the home search matches against (with ILIKE). */
export const HOME_SEARCH_FIELDS = [
  "wh_number",
  "lot",
  "po_number",
  "item_code",
  "description",
] as const;

/** Normalizes the `?tab=` query param to a known tab value. Unknown → in_progress. */
export function parseHomeTab(raw: string | undefined | null): HomeTab {
  return raw === "completed" ? "completed" : "in_progress";
}

/** Trim + coerce nullish to empty string. */
export function normalizeSearchQuery(raw: string | undefined | null): string {
  return (raw || "").trim();
}

/**
 * Escapes characters that have special meaning in SQL LIKE / ILIKE patterns:
 *   - `%`  (any sequence)
 *   - `_`  (any single char)
 *   - `\`  (the escape char itself)
 *
 * This is critical for user-entered search strings. Without escape, a user
 * searching for "100%" would match everything after "100".
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

/**
 * Builds the PostgREST `.or(...)` expression for home search. Runs the input
 * through escapeLikePattern first, wraps with % on both sides, and produces
 * `field.ilike.%q%,field2.ilike.%q%,...` across all HOME_SEARCH_FIELDS.
 *
 * Returns `null` when the query is empty (caller should skip the .or() call).
 */
export function homeSearchOrExpression(rawQuery: string): string | null {
  const q = normalizeSearchQuery(rawQuery);
  if (!q) return null;
  const escaped = escapeLikePattern(q);
  return HOME_SEARCH_FIELDS.map((f) => `${f}.ilike.%${escaped}%`).join(",");
}
