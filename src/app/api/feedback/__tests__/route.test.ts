import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  feedbackRateLimit: { fake: true },
  checkRateLimit: vi.fn(),
  getIdentifier: vi.fn(() => "test-user"),
}));

vi.mock("@/lib/api/guards", () => ({
  requireAuth: vi.fn(),
  requireAdminAuth: vi.fn(),
  requireSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { POST } from "../route";
import { requireAuth, requireSupabaseAdmin } from "@/lib/api/guards";
import { checkRateLimit } from "@/lib/api/rate-limit";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeSupabase(dupes: unknown[] = []) {
  const single = vi.fn().mockResolvedValue({
    data: { feedback_id: "fb-1" },
    error: null,
  });
  const insertSelect = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select: insertSelect }));

  const gte = vi.fn().mockResolvedValue({ data: dupes, error: null });
  const eqChain = vi.fn(() => ({ gte, eq: eqChain }));
  const selectQuery = vi.fn(() => ({ eq: eqChain }));
  const from = vi.fn(() => ({ select: selectQuery, insert }));

  return { from, insert, selectQuery, single };
}

const validFeedback = {
  feedback_type: "general" as const,
  category: "suggestion",
  message: "This app is great and I have some detailed feedback to share.",
};

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-123" } as never,
    });
    vi.mocked(checkRateLimit).mockResolvedValue(null);

    const sb = fakeSupabase();
    vi.mocked(requireSupabaseAdmin).mockReturnValue(sb as never);
  });

  it("returns 400 when feedback_type is missing", async () => {
    const res = await POST(
      makeRequest({ category: "bug", message: "Something is broken in the app." }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 400 when feedback_type is invalid", async () => {
    const res = await POST(
      makeRequest({
        feedback_type: "invalid_type",
        category: "bug",
        message: "Something is broken in the app.",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when category is missing", async () => {
    const res = await POST(
      makeRequest({
        feedback_type: "general",
        message: "Something is broken in the app.",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is too short (< 10 chars)", async () => {
    const res = await POST(
      makeRequest({
        feedback_type: "general",
        category: "bug",
        message: "short",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "}{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(requireAuth).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await POST(makeRequest(validFeedback));
    expect(res.status).toBe(401);
  });

  it("returns 200 with feedback_id for valid feedback", async () => {
    const res = await POST(makeRequest(validFeedback));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.feedback_id).toBe("fb-1");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(
      NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 },
      ),
    );

    const res = await POST(makeRequest(validFeedback));
    expect(res.status).toBe(429);
  });
});
