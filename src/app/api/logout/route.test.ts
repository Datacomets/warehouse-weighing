import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const signOut = vi.fn();
  const client = { auth: { signOut } };
  return { signOut, client };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.client,
}));

import { POST } from "./route";

type NextRequestLike = Parameters<typeof POST>[0];

function makeRequest(url = "http://localhost/api/logout"): NextRequestLike {
  return new Request(url, { method: "POST" }) as unknown as NextRequestLike;
}

describe("POST /api/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("calls supabase.auth.signOut()", async () => {
    await POST(makeRequest());
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("returns a 303 redirect to /login", async () => {
    const res = await POST(makeRequest("http://localhost:3000/api/logout"));

    expect(res.status).toBe(303);
    const location = res.headers.get("location");
    expect(location).toBeTruthy();
    expect(new URL(location!).pathname).toBe("/login");
  });

  it("resolves /login relative to the request origin", async () => {
    const res = await POST(makeRequest("https://comets.example.com/api/logout"));
    const location = res.headers.get("location")!;
    expect(new URL(location).origin).toBe("https://comets.example.com");
  });
});
