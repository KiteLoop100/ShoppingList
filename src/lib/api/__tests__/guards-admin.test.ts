import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerFromRequest: vi.fn() }));

import { isAdminRequest, adminOnlyResponse } from "../guards";
import { signAdminToken } from "../admin-token";
import { ADMIN_COOKIE_NAME } from "../config";

const SECRET = "a".repeat(64);

function withCookie(cookie: string): Request {
  return new Request("http://localhost/api/x", { headers: { cookie } });
}

describe("isAdminRequest", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SESSION_SECRET", SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a valid signed admin cookie, also among other cookies", () => {
    const token = signAdminToken(SECRET, 3600);
    expect(isAdminRequest(withCookie(`${ADMIN_COOKIE_NAME}=${token}`))).toBe(true);
    expect(
      isAdminRequest(withCookie(`sb-access=abc; ${ADMIN_COOKIE_NAME}=${token}; theme=dark`)),
    ).toBe(true);
  });

  it("rejects a missing cookie, a tampered token, an expired token and a wrong secret", () => {
    expect(isAdminRequest(new Request("http://localhost/api/x"))).toBe(false);
    expect(isAdminRequest(withCookie("sb-access=abc"))).toBe(false);

    const token = signAdminToken(SECRET, 3600);
    expect(isAdminRequest(withCookie(`${ADMIN_COOKIE_NAME}=${token}x`))).toBe(false);

    const expired = signAdminToken(SECRET, -10);
    expect(isAdminRequest(withCookie(`${ADMIN_COOKIE_NAME}=${expired}`))).toBe(false);

    const other = signAdminToken("b".repeat(64), 3600);
    expect(isAdminRequest(withCookie(`${ADMIN_COOKIE_NAME}=${other}`))).toBe(false);
  });

  it("is never admin when ADMIN_SESSION_SECRET is not configured", () => {
    const token = signAdminToken(SECRET, 3600);
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    expect(isAdminRequest(withCookie(`${ADMIN_COOKIE_NAME}=${token}`))).toBe(false);
  });

  it("adminOnlyResponse is a 403", async () => {
    const res = adminOnlyResponse();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/admin/i);
  });
});
