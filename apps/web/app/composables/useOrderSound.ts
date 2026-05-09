/**
 * Order notification sound composable.
 *
 * Plays a short notification beep when new pending orders arrive.
 * Uses the Web Audio API to generate the sound programmatically
 * (no external audio file needed).
 *
 * Mute preference is persisted in localStorage.
 *
 * Usage:
 *   const { muted, toggleMute, playNotification } = useOrderSound();
 */

const MUTE_KEY = "nova-order-sound-muted";

export function useOrderSound() {
  const muted = ref(false);

  // Load mute preference from localStorage
  if (import.meta.client) {
    try {
      muted.value = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      // localStorage unavailable
    }
  }

  /** Toggle mute on/off and persist. */
  function toggleMute() {
    muted.value = !muted.value;
    try {
      localStorage.setItem(MUTE_KEY, muted.value ? "1" : "0");
    } catch {
      // localStorage unavailable
    }
  }

  /**
   * Play a short notification beep using Web Audio API.
   *
   * Two-tone beep (440Hz + 520Hz) for 120ms each, pleasant and
   * recognizable without being annoying. Fails silently if audio
   * context is not available (e.g., user hasn't interacted yet).
   */
  function playNotification() {
    if (muted.value || !import.meta.client) return;

    try {
      const ctx = new AudioContext();

      // First tone: 440Hz (A4)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.value = 440;
      gain1.gain.value = 0.3;
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.12);

      // Second tone: 520Hz (slightly higher), starts after first
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.value = 520;
      gain2.gain.value = 0.3;
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.27);

      // Clean up after playback
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 500);
    } catch {
      // AudioContext not available or blocked by browser policy
    }
  }

  return {
    muted: readonly(muted),
    toggleMute,
    playNotification,
  };
}
