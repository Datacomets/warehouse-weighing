import { describe, it, expect } from "vitest";
import type { DocStatus } from "./types";
import { canEdit, canSubmit, canEnterSap, canUnlock, nextStatus } from "./workflow";

const ALL_STATUSES: DocStatus[] = ["in_progress", "pending_sap", "completed"];

describe("canEdit() / canSubmit()", () => {
  it("allow in_progress only", () => {
    expect(canEdit("in_progress")).toBe(true);
    expect(canSubmit("in_progress")).toBe(true);
  });
  it.each(["pending_sap", "completed"] as const)("block %s", (s) => {
    expect(canEdit(s)).toBe(false);
    expect(canSubmit(s)).toBe(false);
  });
});

describe("canEnterSap() / canUnlock()", () => {
  it("allow pending_sap only", () => {
    expect(canEnterSap("pending_sap")).toBe(true);
    expect(canUnlock("pending_sap")).toBe(true);
  });
  it.each(["in_progress", "completed"] as const)("block %s", (s) => {
    expect(canEnterSap(s)).toBe(false);
    expect(canUnlock(s)).toBe(false);
  });
});

describe("nextStatus() — happy paths", () => {
  it("submit: in_progress → pending_sap", () => {
    expect(nextStatus("in_progress", "submit")).toBe("pending_sap");
  });
  it("sap_entry: pending_sap → completed", () => {
    expect(nextStatus("pending_sap", "sap_entry")).toBe("completed");
  });
  it("unlock: pending_sap → in_progress", () => {
    expect(nextStatus("pending_sap", "unlock")).toBe("in_progress");
  });
});

describe("nextStatus() — invalid transitions return null", () => {
  it("cannot submit from pending_sap or completed", () => {
    expect(nextStatus("pending_sap", "submit")).toBeNull();
    expect(nextStatus("completed", "submit")).toBeNull();
  });
  it("cannot enter SAP from in_progress or completed", () => {
    expect(nextStatus("in_progress", "sap_entry")).toBeNull();
    expect(nextStatus("completed", "sap_entry")).toBeNull();
  });
  it("cannot unlock from in_progress or completed (terminal)", () => {
    expect(nextStatus("in_progress", "unlock")).toBeNull();
    expect(nextStatus("completed", "unlock")).toBeNull();
  });

  it("completed is terminal — no action leaves it", () => {
    for (const action of ["submit", "sap_entry", "unlock"] as const) {
      expect(nextStatus("completed", action)).toBeNull();
    }
  });
});

describe("workflow invariants", () => {
  it("every status returns a boolean from each guard (no undefined)", () => {
    for (const s of ALL_STATUSES) {
      expect(typeof canEdit(s)).toBe("boolean");
      expect(typeof canSubmit(s)).toBe("boolean");
      expect(typeof canEnterSap(s)).toBe("boolean");
      expect(typeof canUnlock(s)).toBe("boolean");
    }
  });

  it("canEdit and canEnterSap are mutually exclusive (cannot both be true)", () => {
    for (const s of ALL_STATUSES) {
      expect(canEdit(s) && canEnterSap(s)).toBe(false);
    }
  });
});
