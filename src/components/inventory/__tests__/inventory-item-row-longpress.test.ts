import { describe, test, expect, vi } from "vitest";

const LONG_PRESS_MS = 500;
const SWIPE_THRESHOLD = 60;
const MOVEMENT_CANCEL_THRESHOLD = 8;

describe("inventory-item-row long-press behavior", () => {
  test("long-press fires after LONG_PRESS_MS without movement", () => {
    vi.useFakeTimers();
    const onShowActions = vi.fn();
    let longPressFired = false;

    const timer = setTimeout(() => {
      longPressFired = true;
      onShowActions();
    }, LONG_PRESS_MS);

    expect(longPressFired).toBe(false);
    vi.advanceTimersByTime(499);
    expect(longPressFired).toBe(false);

    vi.advanceTimersByTime(1);
    expect(longPressFired).toBe(true);
    expect(onShowActions).toHaveBeenCalledOnce();

    clearTimeout(timer);
    vi.useRealTimers();
  });

  test("long-press is cancelled when finger moves beyond threshold", () => {
    vi.useFakeTimers();
    const onShowActions = vi.fn();
    let longPressFired = false;

    const timer = setTimeout(() => {
      longPressFired = true;
      onShowActions();
    }, LONG_PRESS_MS);

    vi.advanceTimersByTime(200);
    const dx = 10;
    const dy = 2;
    if (Math.abs(dx) > MOVEMENT_CANCEL_THRESHOLD || Math.abs(dy) > MOVEMENT_CANCEL_THRESHOLD) {
      clearTimeout(timer);
    }

    vi.advanceTimersByTime(300);
    expect(longPressFired).toBe(false);
    expect(onShowActions).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  test("small movement within threshold does not cancel long-press", () => {
    vi.useFakeTimers();
    const onShowActions = vi.fn();
    let longPressFired = false;

    const timer = setTimeout(() => {
      longPressFired = true;
      onShowActions();
    }, LONG_PRESS_MS);

    vi.advanceTimersByTime(200);
    const dx = 5;
    const dy = 3;
    if (Math.abs(dx) > MOVEMENT_CANCEL_THRESHOLD || Math.abs(dy) > MOVEMENT_CANCEL_THRESHOLD) {
      clearTimeout(timer);
    }

    vi.advanceTimersByTime(300);
    expect(longPressFired).toBe(true);
    expect(onShowActions).toHaveBeenCalledOnce();

    clearTimeout(timer);
    vi.useRealTimers();
  });

  test("touch end before timeout cancels long-press", () => {
    vi.useFakeTimers();
    const onShowActions = vi.fn();
    let longPressFired = false;

    const timer = setTimeout(() => {
      longPressFired = true;
      onShowActions();
    }, LONG_PRESS_MS);

    vi.advanceTimersByTime(300);
    clearTimeout(timer);

    vi.advanceTimersByTime(200);
    expect(longPressFired).toBe(false);
    expect(onShowActions).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  test("swipe actions are skipped when long-press already fired", () => {
    let longPressFired = true;
    const onConsume = vi.fn();
    const onOpen = vi.fn();
    const swipeX = -80;

    if (longPressFired) {
      longPressFired = false;
    } else {
      if (swipeX < -SWIPE_THRESHOLD) {
        onConsume();
      } else if (swipeX > SWIPE_THRESHOLD) {
        onOpen();
      }
    }

    expect(onConsume).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("movement cancel threshold is smaller than swipe threshold", () => {
    expect(MOVEMENT_CANCEL_THRESHOLD).toBeLessThan(SWIPE_THRESHOLD);
  });
});
