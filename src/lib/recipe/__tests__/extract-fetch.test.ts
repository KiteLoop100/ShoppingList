/**
 * SSRF behaviour of recipe extraction: the URL and EVERY redirect hop must be
 * a public https address. Uses the real extractRecipe + safeFetch with only
 * global fetch (and the Claude client) mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api/claude-client", () => ({ callClaudeJSON: vi.fn() }));
vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { extractRecipe } from "@/lib/recipe/extract";
import { safeFetch, UnsafeUrlError, SAFE_FETCH_MAX_REDIRECTS } from "@/lib/api/safe-fetch";

const RECIPE_HTML = `<html><head><script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Testkuchen",
  recipeYield: "4 Portionen",
  recipeIngredient: ["200 g Mehl", "2 Eier"],
})}
</script></head><body></body></html>`;

function html(body = RECIPE_HTML): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
}

function redirectTo(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractRecipe – URL validation (no network before validation)", () => {
  it.each([
    ["http://localhost/rezept", /https/],
    ["http://169.254.169.254/latest/meta-data", /https/],
    ["https://169.254.169.254/latest/meta-data", /private or reserved/],
    ["https://localhost/rezept", /not allowed/],
    ["https://127.0.0.1/rezept", /not allowed/],
    ["https://10.0.0.5/x", /private or reserved/],
    ["https://192.168.1.1/x", /private or reserved/],
    ["https://db.internal/x", /not allowed/],
    ["https://[::1]/x", /not allowed/],
  ])("rejects %s without fetching", async (url, pattern) => {
    await expect(extractRecipe(url)).rejects.toThrow(/^Unsafe URL: /);
    await expect(extractRecipe(url)).rejects.toThrow(pattern);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unparsable URL", async () => {
    await expect(extractRecipe("not a url")).rejects.toThrow("Invalid URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a plain http:// public URL (https only)", async () => {
    await expect(extractRecipe("http://example.com/rezept")).rejects.toThrow(/https/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("extractRecipe – redirects", () => {
  it("refuses a redirect to a private IP and does not fetch the target", async () => {
    fetchMock.mockResolvedValueOnce(redirectTo("https://10.0.0.1/admin"));

    await expect(extractRecipe("https://example.com/rezept")).rejects.toThrow(/Unsafe URL/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a redirect to the cloud metadata endpoint", async () => {
    fetchMock.mockResolvedValueOnce(redirectTo("http://169.254.169.254/latest/meta-data", 301));

    await expect(extractRecipe("https://example.com/rezept")).rejects.toThrow(/Unsafe URL/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a downgrade redirect to http://", async () => {
    fetchMock.mockResolvedValueOnce(redirectTo("http://example.com/rezept"));
    await expect(extractRecipe("https://example.com/rezept")).rejects.toThrow(/https/);
  });

  it("follows a safe redirect (incl. relative Location) and extracts the recipe", async () => {
    fetchMock
      .mockResolvedValueOnce(redirectTo("/neu/rezept"))
      .mockResolvedValueOnce(redirectTo("https://cdn.example.org/final", 307))
      .mockResolvedValueOnce(html());

    const result = await extractRecipe("https://example.com/rezept");
    expect(result.method).toBe("json-ld");
    expect(result.recipe.title).toBe("Testkuchen");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe("https://example.com/neu/rezept");
    expect(fetchMock.mock.calls[2][0]).toBe("https://cdn.example.org/final");
    // Every hop is fetched with manual redirect handling.
    for (const call of fetchMock.mock.calls) {
      expect(call[1]).toMatchObject({ redirect: "manual" });
    }
  });

  it(`stops after ${SAFE_FETCH_MAX_REDIRECTS} hops`, async () => {
    fetchMock.mockImplementation(async (url: string) =>
      redirectTo(`${url.replace(/\/\d*$/, "")}/${fetchMock.mock.calls.length}`),
    );

    await expect(extractRecipe("https://example.com/a")).rejects.toThrow(/Too many redirects/);
    expect(fetchMock).toHaveBeenCalledTimes(SAFE_FETCH_MAX_REDIRECTS + 1);
  });
});

describe("safeFetch – timeout", () => {
  it("aborts after the configured timeout and reports a fetch failure", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );

    const pending = safeFetch("https://example.com/slow", { timeoutMs: 15_000 });
    const assertion = expect(pending).rejects.toThrow(/Failed to fetch URL: timeout/);
    await vi.advanceTimersByTimeAsync(15_001);
    await assertion;
    vi.useRealTimers();
  });

  it("exposes UnsafeUrlError for invalid input", async () => {
    await expect(safeFetch("https://localhost/x")).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});
