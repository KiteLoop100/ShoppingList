import { describe, test, expect, vi, afterEach } from "vitest";

/**
 * The model constants are evaluated at import time, so every case resets the
 * module registry and imports config.ts fresh after stubbing the env.
 */
async function loadConfig() {
  vi.resetModules();
  return import("../config");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Claude model IDs (config.ts)", () => {
  test("defaults point at the current model generation", async () => {
    vi.stubEnv("CLAUDE_MODEL_MAIN", "");
    vi.stubEnv("CLAUDE_MODEL_FAST", "");
    vi.stubEnv("CLAUDE_MODEL_OPUS", "");
    const cfg = await loadConfig();

    expect(cfg.CLAUDE_MODEL_MAIN).toBe("claude-sonnet-5-5");
    expect(cfg.CLAUDE_MODEL_FAST).toBe("claude-haiku-5-5");
    expect(cfg.CLAUDE_MODEL_OPUS).toBe("claude-opus-5-5");
  });

  test("env variables override each tier independently", async () => {
    vi.stubEnv("CLAUDE_MODEL_MAIN", "claude-sonnet-4-5-20250929");
    vi.stubEnv("CLAUDE_MODEL_FAST", "claude-haiku-4-5-20251001");
    vi.stubEnv("CLAUDE_MODEL_OPUS", "claude-opus-4-6");
    const cfg = await loadConfig();

    expect(cfg.CLAUDE_MODEL_MAIN).toBe("claude-sonnet-4-5-20250929");
    expect(cfg.CLAUDE_MODEL_FAST).toBe("claude-haiku-4-5-20251001");
    expect(cfg.CLAUDE_MODEL_OPUS).toBe("claude-opus-4-6");
  });

  test("empty or whitespace-only env values fall back to the default", async () => {
    vi.stubEnv("CLAUDE_MODEL_MAIN", "   ");
    vi.stubEnv("CLAUDE_MODEL_FAST", "");
    vi.stubEnv("CLAUDE_MODEL_OPUS", "claude-opus-5-5");
    const cfg = await loadConfig();

    expect(cfg.CLAUDE_MODEL_MAIN).toBe("claude-sonnet-5-5");
    expect(cfg.CLAUDE_MODEL_FAST).toBe("claude-haiku-5-5");
  });

  test("surrounding whitespace in an override is trimmed", async () => {
    vi.stubEnv("CLAUDE_MODEL_MAIN", "  claude-sonnet-custom  ");
    const cfg = await loadConfig();

    expect(cfg.CLAUDE_MODEL_MAIN).toBe("claude-sonnet-custom");
  });
});
