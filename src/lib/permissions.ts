import type { UserRole } from "./types";

/**
 * Central role-based access spec. Each page's redirect logic should derive
 * from these allow-lists so the permission model stays in one place.
 */

export const ADMIN_QUEUE_ROLES: readonly UserRole[] = ["admin_sap", "admin", "qc"];
export const TEAM_ROLES: readonly UserRole[] = ["qc", "manager", "admin"];
export const ITEM_MASTER_ROLES: readonly UserRole[] = ["admin", "admin_sap"];
export const DASHBOARD_ROLES: readonly UserRole[] = ["qc", "manager", "admin_sap", "admin"];

export function canAccessAdminQueue(role: UserRole): boolean {
  return ADMIN_QUEUE_ROLES.includes(role);
}

export function canAccessTeam(role: UserRole): boolean {
  return TEAM_ROLES.includes(role);
}

export function canAccessItemMaster(role: UserRole): boolean {
  return ITEM_MASTER_ROLES.includes(role);
}

export function canAccessDashboard(role: UserRole): boolean {
  return DASHBOARD_ROLES.includes(role);
}

export function canManageUsers(role: UserRole): boolean {
  return role === "admin";
}

/** Only operators are scoped to their own documents on /home. */
export function seesOnlyOwnDocuments(role: UserRole): boolean {
  return role === "operator";
}

/** Landing redirect for `/` — depends on role's primary responsibility. */
export function homeRouteFor(role: UserRole): string {
  switch (role) {
    case "admin_sap":
      return "/admin";
    case "manager":
      return "/dashboard";
    case "admin":
      return "/users";
    case "qc":
    case "operator":
    default:
      return "/home";
  }
}
