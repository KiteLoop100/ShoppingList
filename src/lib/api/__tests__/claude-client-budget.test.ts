import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

const consumeMock = vi.hoisted(() => vi.fn());

vi.mock("../ai-budget", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ai-budget")>();
  return { ...actual, consumeGlobalAiCall: consumeMock };
});

vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/utils/repair-json", () => ({
  tryRepairTruncatedJson: vi.fn(() => null),
}));

import { callClaude, ClaudeApiError } from "../claude-client";
import { AiBudgetError } from "../ai-budget";
import { routeDeadline, ROUTE_DEADLINE_SAFETY_MS } from "../config";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const OPTIONS = {
  max_tokens: 100,
  messages: [{ role: "user" as const, content: "Hello" }],
};

function ok(text = "ok") {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ content: [{ type: "text", text }] }),
    text: () => Promise.resolve(text),
  };
}

function failed(status: number) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve("err"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  consumeMock.mockResolvedValue(undefined);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("callClaude – global daily cap", () => {
  test("counts exactly one call per invocation", async () => {
    mockFetch.mockResolvedValueOnce(ok());
    await callClaude(OPTIONS);
    expect(consumeMock).toHaveBeenCalledTimes(1);
  });

  test("does not count HTTP retries of the same call again", async () => {
    mockFetch.mockResolvedValueOnce(failed(529)).mockResolvedValueOnce(ok());
    await callClaude(OPTIONS);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(consumeMock).toHaveBeenCalledTimes(1);
  }, 10_000);

  test("counts every call separately (e.g. cook-chat retry prompt)", async () => {
    mockFetch.mockResolvedValue(ok());
    await callClaude(OPTIONS);
    await callClaude(OPTIONS);
    await callClaude(OPTIONS);
    expect(consumeMock).toHaveBeenCalledTimes(3);
  });

  test("refuses the call without touching the network when the cap is reached", async () => {
    consumeMock.mockRejectedValue(new AiBudgetError("global_daily_cap", 429, Date.now() + 1000));
    await expect(callClaude(OPTIONS)).rejects.toMatchObject({
      name: "AiBudgetError",
      code: "global_daily_cap",
      status: 429,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("fails closed (503) when the budget service is unavailable", async () => {
    consumeMock.mockRejectedValue(new AiBudgetError("ai_unavailable", 503));
    await expect(callClaude(OPTIONS)).rejects.toMatchObject({ status: 503 });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("does not consume budget when the API key is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(callClaude(OPTIONS)).rejects.toThrow("ANTHROPIC_API_KEY");
    expect(consumeMock).not.toHaveBeenCalled();
  });
});

describe("callClaude – total deadline", () => {
  test("clamps the attempt timeout to the time left before the deadline", async () => {
    const spy = vi.spyOn(AbortSignal, "timeout");
    mockFetch.mockResolvedValueOnce(ok());

    await callClaude({ ...OPTIONS, timeoutMs: 150_000, deadlineAt: Date.now() + 20_000 });

    const used = spy.mock.calls[0][0];
    expect(used).toBeLessThanOrEqual(20_000);
    expect(used).toBeGreaterThan(15_000);
  });

  test("keeps the configured timeout when the deadline is far away", async () => {
    const spy = vi.spyOn(AbortSignal, "timeout");
    mockFetch.mockResolvedValueOnce(ok());
    await callClaude({ ...OPTIONS, timeoutMs: 40_000, deadlineAt: Date.now() + 600_000 });
    expect(spy.mock.calls[0][0]).toBe(40_000);
  });

  test("throws 408 without calling fetch when the deadline has already passed", async () => {
    await expect(
      callClaude({ ...OPTIONS, deadlineAt: Date.now() - 1 }),
    ).rejects.toMatchObject({ name: "ClaudeApiError", status: 408 });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("throws 408 when less than the minimum attempt time is left", async () => {
    await expect(
      callClaude({ ...OPTIONS, deadlineAt: Date.now() + 2_000 }),
    ).rejects.toBeInstanceOf(ClaudeApiError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("does not retry a 529 when the retry cannot fit before the deadline", async () => {
    mockFetch.mockResolvedValue(failed(529));
    await expect(
      callClaude({ ...OPTIONS, deadlineAt: Date.now() + 6_000 }),
    ).rejects.toMatchObject({ status: 529 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("still retries a 529 when the deadline leaves room", async () => {
    mockFetch.mockResolvedValueOnce(failed(529)).mockResolvedValueOnce(ok("recovered"));
    const result = await callClaude({ ...OPTIONS, deadlineAt: Date.now() + 120_000 });
    expect(result).toBe("recovered");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  }, 10_000);

  test("stops retrying timeouts once the deadline is used up", async () => {
    // Every attempt "times out" and burns the remaining budget.
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    mockFetch.mockImplementation(() => {
      now += 12_000;
      return Promise.reject(new DOMException("signal timed out", "TimeoutError"));
    });

    await expect(
      callClaude({ ...OPTIONS, timeoutMs: 150_000, deadlineAt: now + 20_000 }),
    ).rejects.toMatchObject({ status: 408 });
    // 1st attempt 12s used (8s left) -> 2nd attempt (clamped to 8s) -> 0s left -> stop.
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("routeDeadline", () => {
  test("is maxDuration minus the safety margin", () => {
    expect(routeDeadline(300, 1_000)).toBe(1_000 + 300_000 - ROUTE_DEADLINE_SAFETY_MS);
  });

  test("leaves room for retries of the flyer routes: 270 s < 300 s", () => {
    const start = 5_000;
    expect(routeDeadline(300, start) - start).toBeLessThan(300_000);
  });
});
