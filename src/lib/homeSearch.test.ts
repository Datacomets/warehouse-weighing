import { describe, it, expect } from "vitest";
import {
  parseHomeTab,
  normalizeSearchQuery,
  escapeLikePattern,
  homeSearchOrExpression,
  HOME_SEARCH_FIELDS,
} from "./homeSearch";

describe("parseHomeTab()", () => {
  it("returns 'completed' when raw === 'completed'", () => {
    expect(parseHomeTab("completed")).toBe("completed");
  });

  it.each([undefined, null, "", "in_progress", "pending_sap", "garbage", "COMPLETED"])(
    "falls back to 'in_progress' for %s",
    (raw) => {
      expect(parseHomeTab(raw)).toBe("in_progress");
    }
  );
});

describe("normalizeSearchQuery()", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeSearchQuery("  WH-2604  ")).toBe("WH-2604");
  });
  it("returns empty string for null/undefined", () => {
    expect(normalizeSearchQuery(null)).toBe("");
    expect(normalizeSearchQuery(undefined)).toBe("");
  });
  it("collapses whitespace-only to empty string", () => {
    expect(normalizeSearchQuery("   ")).toBe("");
  });
});

describe("escapeLikePattern()", () => {
  it("leaves plain strings untouched", () => {
    expect(escapeLikePattern("WH-2604-002")).toBe("WH-2604-002");
  });

  it("escapes %", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
  });

  it("escapes _", () => {
    expect(escapeLikePattern("lot_1")).toBe("lot\\_1");
  });

  it("escapes backslash (the escape char itself)", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("escapes all special chars in one string", () => {
    expect(escapeLikePattern("a%b_c\\d")).toBe("a\\%b\\_c\\\\d");
  });

  it("escapes repeated specials", () => {
    expect(escapeLikePattern("%%__")).toBe("\\%\\%\\_\\_");
  });

  it("returns empty string for empty input", () => {
    expect(escapeLikePattern("")).toBe("");
  });
});

describe("homeSearchOrExpression()", () => {
  it("returns null for empty or whitespace-only query", () => {
    expect(homeSearchOrExpression("")).toBeNull();
    expect(homeSearchOrExpression("   ")).toBeNull();
  });

  it("builds ilike clauses for every HOME_SEARCH_FIELDS entry", () => {
    const expr = homeSearchOrExpression("WH-2604");
    expect(expr).not.toBeNull();
    for (const field of HOME_SEARCH_FIELDS) {
      expect(expr).toContain(`${field}.ilike.%WH-2604%`);
    }
    // Clauses are comma-separated, one per field
    expect(expr!.split(",")).toHaveLength(HOME_SEARCH_FIELDS.length);
  });

  it("wraps the query with % on both sides (substring match)", () => {
    expect(homeSearchOrExpression("X")).toContain("wh_number.ilike.%X%");
  });

  it("escapes SQL LIKE wildcards before embedding", () => {
    const expr = homeSearchOrExpression("100%");
    expect(expr).toContain("wh_number.ilike.%100\\%%");
  });

  it("matches current home/page.tsx output exactly (regression lock)", () => {
    expect(homeSearchOrExpression("test")).toBe(
      "wh_number.ilike.%test%,lot.ilike.%test%,po_number.ilike.%test%,item_code.ilike.%test%,description.ilike.%test%"
    );
  });

  it("matches PO number queries (added per warehouse user request)", () => {
    const expr = homeSearchOrExpression("5888");
    expect(expr).toContain("po_number.ilike.%5888%");
  });

  it("trims whitespace before escaping", () => {
    expect(homeSearchOrExpression("  abc  ")).toContain("wh_number.ilike.%abc%");
  });
});
