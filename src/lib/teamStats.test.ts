import { describe, it, expect } from "vitest";
import {
  countDocsByUser,
  buildOperatorRows,
  teamTotals,
  emptyCounts,
  type TeamDoc,
  type Operator,
} from "./teamStats";

const SOD = new Date("2026-04-16T00:00:00Z");

describe("countDocsByUser()", () => {
  it("tallies inProgress / pending / completed counts per user", () => {
    const docs: TeamDoc[] = [
      { created_by: "u1", status: "in_progress" },
      { created_by: "u1", status: "in_progress" },
      { created_by: "u1", status: "pending_sap" },
      { created_by: "u2", status: "completed", closed_at: "2026-04-16T10:00:00Z" },
    ];
    const m = countDocsByUser(docs, SOD);
    expect(m.get("u1")).toEqual({
      inProgress: 2,
      pending: 1,
      completedToday: 0,
      completedTotal: 0,
    });
    expect(m.get("u2")).toEqual({
      inProgress: 0,
      pending: 0,
      completedToday: 1,
      completedTotal: 1,
    });
  });

  it("distinguishes completedToday vs completedTotal based on closed_at ≥ startOfDay", () => {
    const docs: TeamDoc[] = [
      { created_by: "u1", status: "completed", closed_at: "2026-04-15T23:00:00Z" }, // before SOD
      { created_by: "u1", status: "completed", closed_at: "2026-04-16T00:00:00Z" }, // boundary — counts
      { created_by: "u1", status: "completed", closed_at: "2026-04-16T15:00:00Z" }, // today
    ];
    expect(countDocsByUser(docs, SOD).get("u1")).toEqual({
      inProgress: 0,
      pending: 0,
      completedToday: 2,
      completedTotal: 3,
    });
  });

  it("skips docs with null created_by", () => {
    const docs: TeamDoc[] = [{ created_by: null, status: "in_progress" }];
    expect(countDocsByUser(docs, SOD).size).toBe(0);
  });

  it("skips completed docs with null closed_at in completedToday check", () => {
    const docs: TeamDoc[] = [
      { created_by: "u1", status: "completed", closed_at: null },
    ];
    expect(countDocsByUser(docs, SOD).get("u1")).toEqual({
      inProgress: 0,
      pending: 0,
      completedToday: 0,
      completedTotal: 1,
    });
  });

  it("unknown statuses add the user with zero counts (no increment)", () => {
    const docs: TeamDoc[] = [{ created_by: "u1", status: "archived" }];
    expect(countDocsByUser(docs, SOD).get("u1")).toEqual(emptyCounts());
  });

  it("emptyCounts() returns all zeros", () => {
    expect(emptyCounts()).toEqual({
      inProgress: 0,
      pending: 0,
      completedToday: 0,
      completedTotal: 0,
    });
  });
});

describe("buildOperatorRows()", () => {
  const ops: Operator[] = [
    { id: "u1", full_name: "Alice" },
    { id: "u2", full_name: "Bob" },
    { id: "u3", full_name: "Charlie" },
  ];

  it("sorts by inProgress desc, then pending desc", () => {
    const counts = new Map([
      ["u1", { inProgress: 1, pending: 5, completedToday: 0, completedTotal: 0 }],
      ["u2", { inProgress: 3, pending: 1, completedToday: 0, completedTotal: 0 }],
      ["u3", { inProgress: 3, pending: 5, completedToday: 0, completedTotal: 0 }],
    ]);
    const rows = buildOperatorRows(ops, counts);
    expect(rows.map((r) => r.user.id)).toEqual(["u3", "u2", "u1"]);
  });

  it("fills empty counts for operators with no docs", () => {
    const rows = buildOperatorRows(ops, new Map());
    expect(rows).toHaveLength(3);
    rows.forEach((r) => {
      expect(r.counts).toEqual(emptyCounts());
    });
  });

  it("returns empty array when no operators given", () => {
    expect(buildOperatorRows([], new Map())).toEqual([]);
  });
});

describe("teamTotals()", () => {
  it("sums counts across all rows", () => {
    const rows = buildOperatorRows(
      [
        { id: "u1", full_name: "A" },
        { id: "u2", full_name: "B" },
      ],
      new Map([
        ["u1", { inProgress: 2, pending: 1, completedToday: 3, completedTotal: 10 }],
        ["u2", { inProgress: 4, pending: 0, completedToday: 1, completedTotal: 5 }],
      ])
    );
    expect(teamTotals(rows)).toEqual({
      totalInProgress: 6,
      totalPending: 1,
      totalCompletedToday: 4,
    });
  });

  it("returns zeros for empty rows", () => {
    expect(teamTotals([])).toEqual({
      totalInProgress: 0,
      totalPending: 0,
      totalCompletedToday: 0,
    });
  });
});
