import { describe, test, expect, vi, afterEach } from "vitest";

function createMocks() {
  const mockOscillator = {
    type: "" as string,
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };

  const mockGain = {
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };

  const mockCtxInstance = {
    state: "running" as string,
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => mockOscillator),
    createGain: vi.fn(() => mockGain),
  };

  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  class MockAudioContext {
    state = mockCtxInstance.state;
    currentTime = mockCtxInstance.currentTime;
    destination = mockCtxInstance.destination;
    resume = mockCtxInstance.resume;
    createOscillator = mockCtxInstance.createOscillator;
    createGain = mockCtxInstance.createGain;
  }

  return { mockOscillator, mockGain, mockCtxInstance, MockAudioContext };
}

describe("playScanBeep", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("creates oscillator at 880Hz and plays for ~100ms", async () => {
    vi.resetModules();
    const { mockOscillator, mockCtxInstance, MockAudioContext } = createMocks();
    vi.stubGlobal("window", { AudioContext: MockAudioContext });

    const { playScanBeep } = await import("../scan-beep");
    playScanBeep();

    expect(mockCtxInstance.createOscillator).toHaveBeenCalled();
    expect(mockOscillator.type).toBe("sine");
    expect(mockOscillator.frequency.value).toBe(880);
    expect(mockOscillator.start).toHaveBeenCalledWith(0);
    expect(mockOscillator.stop).toHaveBeenCalledWith(0.1);
  });

  test("gain ramps from 0.15 down to 0.001", async () => {
    vi.resetModules();
    const { mockGain, MockAudioContext } = createMocks();
    vi.stubGlobal("window", { AudioContext: MockAudioContext });

    const { playScanBeep } = await import("../scan-beep");
    playScanBeep();

    expect(mockGain.gain.setValueAtTime).toHaveBeenCalledWith(0.15, 0);
    expect(mockGain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 0.1);
  });

  test("resumes suspended AudioContext", async () => {
    vi.resetModules();
    const { mockCtxInstance, MockAudioContext } = createMocks();
    mockCtxInstance.state = "suspended";
    vi.stubGlobal("window", { AudioContext: MockAudioContext });

    const { playScanBeep } = await import("../scan-beep");
    playScanBeep();

    expect(mockCtxInstance.resume).toHaveBeenCalled();
  });

  test("does not throw when AudioContext is unavailable", async () => {
    vi.resetModules();
    vi.stubGlobal("window", {});

    const { playScanBeep } = await import("../scan-beep");
    expect(() => playScanBeep()).not.toThrow();
  });
});

describe("playScanFeedback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("calls vibrate(50) when available", async () => {
    vi.resetModules();
    const { MockAudioContext } = createMocks();
    vi.stubGlobal("window", { AudioContext: MockAudioContext });
    const vibrateMock = vi.fn();
    vi.stubGlobal("navigator", { vibrate: vibrateMock });

    const { playScanFeedback } = await import("../scan-beep");
    playScanFeedback();

    expect(vibrateMock).toHaveBeenCalledWith(50);
  });

  test("works without navigator.vibrate", async () => {
    vi.resetModules();
    const { MockAudioContext } = createMocks();
    vi.stubGlobal("window", { AudioContext: MockAudioContext });
    vi.stubGlobal("navigator", {});

    const { playScanFeedback } = await import("../scan-beep");
    expect(() => playScanFeedback()).not.toThrow();
  });
});
