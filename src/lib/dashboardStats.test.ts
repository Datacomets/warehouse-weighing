import { describe, it, expect } from "vitest";
import {
  totalGrossWeight,
  todaysDocs,
  leadTimeSummary,
  groupGrossBySupplier,
  supplierChartData,
  dailyLeadTimeAverages,
  DEFAULT_KPI_LEAD_TIME_MINUTES,
  type DashboardDoc,
} from "./dashboardStats";

function doc(overrides: Partial<DashboardDoc> = {}): DashboardDoc {
  return {
    status: "completed",
    created_at: "2026-04-16T00:00:00Z",
    started_at: "2026-04-16T08:00:00Z",
    closed_at: "2026-04-16T09:00:00Z",
    gross_weight: 10,
    actual_count: 5,
    supplier: "ACME",
    ...overrides,
  };
}

describe("totalGrossWeight()", () => {
  it("sums gross × count across docs", () => {
    expect(
      totalGrossWeight([
        doc({ gross_weight: 10, actual_count: 5 }), // 50
        doc({ gross_weight: 3, actual_count: 10 }), // 30
      ])
    ).toBe(80);
  });

  it("treats null / NaN fields as 0", () => {
    expect(
      totalGrossWeight([
        doc({ gross_weight: null, actual_count: 5 }),
        doc({ gross_weight: 10, actual_count: null }),
        doc({ gross_weight: "abc" as any, actual_count: 5 }),
      ])
    ).toBe(0);
  });

  it("accepts string-form numeric fields (DB returns strings for numeric type)", () => {
    expect(totalGrossWeight([doc({ gross_weight: "2.5" as any, actual_count: "4" as any })])).toBe(10);
  });

  it("returns 0 for empty input", () => {
    expect(totalGrossWeight([])).toBe(0);
  });
});

describe("todaysDocs()", () => {
  const start = new Date("2026-04-16T00:00:00Z");

  it("filters docs created on/after startOfDay", () => {
    const result = todaysDocs(
      [
        doc({ created_at: "2026-04-16T00:00:00Z" }), // boundary
        doc({ created_at: "2026-04-16T12:00:00Z" }),
        doc({ created_at: "2026-04-15T23:59:59Z" }),
      ],
      start
    );
    expect(result.length).toBe(2);
  });

  it("excludes docs with null created_at", () => {
    expect(todaysDocs([doc({ created_at: null })], start)).toEqual([]);
  });
});

describe("leadTimeSummary()", () => {
  it("computes avg + over-KPI count across completed docs", () => {
    const docs: DashboardDoc[] = [
      doc({ started_at: "2026-04-16T00:00:00Z", closed_at: "2026-04-16T01:00:00Z" }), // 60 min
      doc({ started_at: "2026-04-16T00:00:00Z", closed_at: "2026-04-16T03:00:00Z" }), // 180 min
      doc({ started_at: "2026-04-16T00:00:00Z", closed_at: "2026-04-16T04:00:00Z" }), // 240 min
    ];
    const s = leadTimeSummary(docs, 120);
    expect(s.leadTimes).toEqual([60, 180, 240]);
    expect(s.avgMinutes).toBe(160);
    expect(s.countOverKpi).toBe(2);
  });

  it("ignores non-completed docs", () => {
    const docs: DashboardDoc[] = [
      doc({ status: "pending_sap", started_at: "2026-04-16T00:00:00Z", closed_at: "2026-04-16T10:00:00Z" }),
      doc({ status: "in_progress", started_at: "2026-04-16T00:00:00Z", closed_at: null }),
    ];
    expect(leadTimeSummary(docs).leadTimes).toEqual([]);
  });

  it("ignores completed docs that lack started_at or closed_at", () => {
    const docs: DashboardDoc[] = [
      doc({ status: "completed", started_at: null, closed_at: "2026-04-16T10:00:00Z" }),
      doc({ status: "completed", started_at: "2026-04-16T00:00:00Z", closed_at: null }),
    ];
    expect(leadTimeSummary(docs).leadTimes).toEqual([]);
  });

  it("returns 0 avg / 0 overKpi for empty dataset", () => {
    expect(leadTimeSummary([])).toEqual({ avgMinutes: 0, countOverKpi: 0, leadTimes: [] });
  });

  it("uses default KPI threshold of 120 minutes", () => {
    expect(DEFAULT_KPI_LEAD_TIME_MINUTES).toBe(120);
    const docs = [
      doc({ started_at: "2026-04-16T00:00:00Z", closed_at: "2026-04-16T02:00:00Z" }), // 120 — boundary
      doc({ started_at: "2026-04-16T00:00:00Z", closed_at: "2026-04-16T02:01:00Z" }), // 121 — over
    ];
    const s = leadTimeSummary(docs);
    expect(s.countOverKpi).toBe(1); // strict > means 120 is NOT over
  });
});

describe("groupGrossBySupplier()", () => {
  it("sums gross × count grouped by supplier", () => {
    const result = groupGrossBySupplier([
      doc({ supplier: "ACME", gross_weight: 10, actual_count: 2 }), // 20
      doc({ supplier: "ACME", gross_weight: 5, actual_count: 4 }),  // 20
      doc({ supplier: "BETA", gross_weight: 3, actual_count: 3 }),  // 9
    ]);
    expect(result).toEqual({ ACME: 40, BETA: 9 });
  });

  it("assigns null supplier to 'ไม่ระบุ'", () => {
    const result = groupGrossBySupplier([
      doc({ supplier: null, gross_weight: 5, actual_count: 2 }),
    ]);
    expect(result).toEqual({ "ไม่ระบุ": 10 });
  });
});

describe("supplierChartData()", () => {
  it("sorts by weight descending", () => {
    const result = supplierChartData({ A: 10, B: 50, C: 30 });
    expect(result.map((r) => r.name)).toEqual(["B", "C", "A"]);
  });

  it("truncates long names with ellipsis", () => {
    const result = supplierChartData({ ["A".repeat(20)]: 1 });
    expect(result[0].name).toBe("A".repeat(14) + "…");
  });

  it("defaults topN to 8", () => {
    const bySupplier: Record<string, number> = {};
    for (let i = 0; i < 15; i++) bySupplier[`S${i}`] = 15 - i;
    const result = supplierChartData(bySupplier);
    expect(result).toHaveLength(8);
  });

  it("respects custom topN", () => {
    const bySupplier: Record<string, number> = { A: 1, B: 2, C: 3 };
    expect(supplierChartData(bySupplier, { topN: 2 })).toHaveLength(2);
  });

  it("returns empty for empty input", () => {
    expect(supplierChartData({})).toEqual([]);
  });
});

describe("dailyLeadTimeAverages()", () => {
  it("groups completed docs by created_at day and averages lead time", () => {
    const docs: DashboardDoc[] = [
      doc({ created_at: "2026-04-15T02:00:00Z", started_at: "2026-04-15T02:00:00Z", closed_at: "2026-04-15T03:00:00Z" }),
      doc({ created_at: "2026-04-15T05:00:00Z", started_at: "2026-04-15T05:00:00Z", closed_at: "2026-04-15T07:00:00Z" }),
      doc({ created_at: "2026-04-16T01:00:00Z", started_at: "2026-04-16T01:00:00Z", closed_at: "2026-04-16T02:30:00Z" }),
    ];
    const result = dailyLeadTimeAverages(docs);
    expect(result).toEqual([
      { day: "04-15", avg: 90 },   // (60 + 120) / 2
      { day: "04-16", avg: 90 },
    ]);
  });

  it("sorts days ascending and keeps only last N", () => {
    const docs: DashboardDoc[] = [];
    for (let d = 1; d <= 20; d++) {
      const day = `2026-04-${String(d).padStart(2, "0")}`;
      docs.push(
        doc({
          created_at: `${day}T01:00:00Z`,
          started_at: `${day}T01:00:00Z`,
          closed_at: `${day}T02:00:00Z`,
        })
      );
    }
    const result = dailyLeadTimeAverages(docs, { windowDays: 3 });
    expect(result.map((r) => r.day)).toEqual(["04-18", "04-19", "04-20"]);
  });

  it("excludes non-completed docs", () => {
    const result = dailyLeadTimeAverages([
      doc({ status: "in_progress" }),
      doc({ status: "pending_sap" }),
    ]);
    expect(result).toEqual([]);
  });
});
