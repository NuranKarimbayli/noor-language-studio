let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {
      // Ignore autoplay restriction errors
    });
  }
  return sharedAudioCtx;
}

/**
 * Cleanup the shared AudioContext. Call this when the app unmounts
 * to prevent memory leaks and ensure proper resource cleanup.
 */
export function cleanupAudioContext(): void {
  if (sharedAudioCtx) {
    try {
      sharedAudioCtx.close();
    } catch {
      // Ignore errors during cleanup
    }
    sharedAudioCtx = null;
  }
}

function playTone(
  ctx: AudioContext,
  freqStart: number,
  freqEnd: number,
  startOffsetSec: number,
  durationSec: number,
  type: OscillatorType,
  peakGain: number
) {
  const now = ctx.currentTime + startOffsetSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, now);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durationSec);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peakGain, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

/**
 * Soft, pleasant ascending chime for correct answers.
 */
export function playCorrectSound(muted: boolean): void {
  if (muted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    playTone(ctx, 587.33, 587.33, 0, 0.11, 'sine', 0.09); // D5
    playTone(ctx, 880, 880, 0.075, 0.18, 'triangle', 0.08); // A5
  } catch {
    // Fail silently if Web Audio is unavailable
  }
}

/**
 * Gentle, low muted thud for incorrect answers or timeouts.
 */
export function playIncorrectSound(muted: boolean): void {
  if (muted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    playTone(ctx, 175, 118, 0, 0.18, 'triangle', 0.11);
  } catch {
    // Fail silently
  }
}

/**
 * Warm three-note chime when finishing a quiz or study session.
 */
export function playCompleteSound(muted: boolean): void {
  if (muted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    playTone(ctx, 523.25, 523.25, 0, 0.14, 'sine', 0.085);      // C5
    playTone(ctx, 659.25, 659.25, 0.09, 0.16, 'sine', 0.085);   // E5
    playTone(ctx, 783.99, 783.99, 0.18, 0.22, 'triangle', 0.08); // G5
    playTone(ctx, 1046.5, 1046.5, 0.28, 0.34, 'sine', 0.08);    // C6
  } catch {
    // Fail silently
  }
}
