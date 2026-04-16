import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted mocks — these MUST use vi.hoisted so they're available to vi.mock factories.
const mocks = vi.hoisted(() => {
  // SSR client (caller identity + profile lookup)
  const getUser = vi.fn();
  const profileSingle = vi.fn();
  const serverClient = {
    auth: { getUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: profileSingle,
        })),
      })),
    })),
  };

  // Service-role client (admin.createUser + profile update)
  const createUser = vi.fn();
  const profileUpdate = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }));
  const adminClient = {
    auth: { admin: { createUser } },
    from: vi.fn(() => ({
      update: profileUpdate,
    })),
  };

  return { getUser, profileSingle, serverClient, createUser, profileUpdate, adminClient };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.serverClient,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mocks.adminClient,
}));

// Import AFTER mocks are registered.
import { POST } from "./route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  email: "newuser@example.com",
  password: "secret123",
  full_name: "New User",
  role: "operator",
};

describe("POST /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated admin caller
    mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-user-id" } } });
    mocks.profileSingle.mockResolvedValue({ data: { role: "admin" } });
    mocks.createUser.mockResolvedValue({
      data: { user: { id: "new-user-id", email: validBody.email } },
      error: null,
    });
  });

  describe("authorization", () => {
    it("returns 401 when no session", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: null } });

      const res = await POST(makeRequest(validBody));

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
      expect(mocks.createUser).not.toHaveBeenCalled();
    });

    it.each(["operator", "qc", "admin_sap", "manager"] as const)(
      "returns 403 when caller role is %s (not admin)",
      async (role) => {
        mocks.profileSingle.mockResolvedValue({ data: { role } });

        const res = await POST(makeRequest(validBody));

        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: "Admin only" });
        expect(mocks.createUser).not.toHaveBeenCalled();
      }
    );

    it("returns 403 when profile is missing (role undefined)", async () => {
      mocks.profileSingle.mockResolvedValue({ data: null });

      const res = await POST(makeRequest(validBody));

      expect(res.status).toBe(403);
    });
  });

  describe("payload validation", () => {
    it.each([
      ["email", { ...validBody, email: "" }],
      ["password", { ...validBody, password: "" }],
      ["full_name", { ...validBody, full_name: "" }],
    ])("returns 400 when %s is missing", async (_field, body) => {
      const res = await POST(makeRequest(body));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Missing fields" });
      expect(mocks.createUser).not.toHaveBeenCalled();
    });

    it.each(["no-at-sign", "missing@dot", "@no-local.com", "spaces in@email.com"])(
      "returns 400 for malformed email %s",
      async (email) => {
        const res = await POST(makeRequest({ ...validBody, email }));

        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain("รูปแบบอีเมล");
        expect(mocks.createUser).not.toHaveBeenCalled();
      }
    );

    it.each(["", "a", "12345"])("returns 400 when password is too short (%s)", async (password) => {
      // Empty string hits the missing-fields branch first → 400, different message.
      // Non-empty but <6 hits the length branch → 400 with password message.
      const res = await POST(makeRequest({ ...validBody, password }));
      expect(res.status).toBe(400);
    });

    it("returns 400 with Thai password message when password < 6 chars", async () => {
      const res = await POST(makeRequest({ ...validBody, password: "abc12" }));

      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("6 ตัวอักษร");
      expect(mocks.createUser).not.toHaveBeenCalled();
    });
  });

  describe("happy path", () => {
    it("creates user via admin API and updates profile with role", async () => {
      const res = await POST(makeRequest(validBody));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        ok: true,
        user: { id: "new-user-id", email: validBody.email },
      });

      expect(mocks.createUser).toHaveBeenCalledWith({
        email: validBody.email,
        password: validBody.password,
        email_confirm: true,
        user_metadata: { full_name: validBody.full_name, role: validBody.role },
      });

      expect(mocks.profileUpdate).toHaveBeenCalledWith({
        full_name: validBody.full_name,
        role: validBody.role,
      });
    });
  });

  describe("Supabase admin errors", () => {
    it("returns 400 with Supabase error message when createUser fails", async () => {
      mocks.createUser.mockResolvedValue({
        data: null,
        error: { message: "A user with this email already exists" },
      });

      const res = await POST(makeRequest(validBody));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "A user with this email already exists",
      });
      expect(mocks.profileUpdate).not.toHaveBeenCalled();
    });
  });
});
