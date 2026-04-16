import { describe, it, expect } from "vitest";
import type { UserRole } from "./types";
import {
  canAccessAdminQueue,
  canAccessTeam,
  canAccessItemMaster,
  canAccessDashboard,
  canManageUsers,
  seesOnlyOwnDocuments,
  homeRouteFor,
} from "./permissions";

const ALL_ROLES: UserRole[] = ["operator", "qc", "manager", "admin_sap", "admin"];

describe("canAccessAdminQueue()", () => {
  it.each(["admin_sap", "admin", "qc"] as const)("allows %s", (role) => {
    expect(canAccessAdminQueue(role)).toBe(true);
  });
  it.each(["operator", "manager"] as const)("blocks %s", (role) => {
    expect(canAccessAdminQueue(role)).toBe(false);
  });
});

describe("canAccessTeam()", () => {
  it.each(["qc", "manager", "admin"] as const)("allows %s", (role) => {
    expect(canAccessTeam(role)).toBe(true);
  });
  it.each(["operator", "admin_sap"] as const)("blocks %s", (role) => {
    expect(canAccessTeam(role)).toBe(false);
  });
});

describe("canAccessItemMaster()", () => {
  it.each(["admin", "admin_sap"] as const)("allows %s", (role) => {
    expect(canAccessItemMaster(role)).toBe(true);
  });
  it.each(["operator", "qc", "manager"] as const)("blocks %s", (role) => {
    expect(canAccessItemMaster(role)).toBe(false);
  });
});

describe("canAccessDashboard()", () => {
  it.each(["qc", "manager", "admin_sap", "admin"] as const)("allows %s", (role) => {
    expect(canAccessDashboard(role)).toBe(true);
  });
  it("blocks operator", () => {
    expect(canAccessDashboard("operator")).toBe(false);
  });
});

describe("canManageUsers()", () => {
  it("allows admin only", () => {
    expect(canManageUsers("admin")).toBe(true);
  });
  it.each(["operator", "qc", "manager", "admin_sap"] as const)("blocks %s", (role) => {
    expect(canManageUsers(role)).toBe(false);
  });
});

describe("seesOnlyOwnDocuments()", () => {
  it("is true for operator", () => {
    expect(seesOnlyOwnDocuments("operator")).toBe(true);
  });
  it.each(["qc", "manager", "admin_sap", "admin"] as const)(
    "is false for %s (they see all docs)",
    (role) => {
      expect(seesOnlyOwnDocuments(role)).toBe(false);
    }
  );
});

describe("homeRouteFor()", () => {
  it.each([
    ["operator", "/home"],
    ["qc", "/home"],
    ["manager", "/dashboard"],
    ["admin_sap", "/admin"],
    ["admin", "/users"],
  ] as const)("routes %s → %s", (role, expected) => {
    expect(homeRouteFor(role)).toBe(expected);
  });

  it("returns a route for every known UserRole (no missing cases)", () => {
    for (const role of ALL_ROLES) {
      expect(homeRouteFor(role)).toMatch(/^\/[a-z]+$/);
    }
  });
});
