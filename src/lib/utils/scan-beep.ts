/**
 * Audio feedback for barcode scans via Web Audio API.
 * Plays a short sine wave (~100ms, 880Hz) at low volume.
 * Respects device volume and mute mode — AudioContext output
 * is routed through the system audio path.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

export function playScanBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.15;

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  oscillator.start(now);
  oscillator.stop(now + 0.1);
}

export function playScanFeedback(): void {
  playScanBeep();
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(50);
  }
}
