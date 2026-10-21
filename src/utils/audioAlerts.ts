/**
 * Native Web Audio Synthesizer for TurfSheet Race Day Alerts
 * 
 * Generates pleasant, latency-free synthesized chimes and fanfares using
 * standard HTML5 Web Audio API (AudioContext) with zero external media files.
 */

const STORAGE_KEY_AUDIO_MUTED = "turfsheet_audio_muted_v1";

class TurfSheetAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUDIO_MUTED);
      this.isMuted = stored === "true";
    } catch {
      this.isMuted = false;
    }
  }

  private initContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      localStorage.setItem(STORAGE_KEY_AUDIO_MUTED, String(muted));
    } catch {
      // ignore
    }
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Ascending victory chime for race winners (D5 -> A5 harmonious bell)
   */
  public playRaceWinnerChime(): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 587.33, start: 0.0, dur: 0.35, gain: 0.22 }, // D5
      { freq: 880.0, start: 0.16, dur: 0.65, gain: 0.28 },  // A5
    ];

    notes.forEach(({ freq, start, dur, gain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);

      gainNode.gain.setValueAtTime(0.001, now + start);
      gainNode.gain.exponentialRampToValueAtTime(gain, now + start + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + dur);
    });
  }

  /**
   * Harmonious 4-chord fanfare for Trifecta and Quaddie hits (C-E-G-C)
   */
  public playTrifectaFanfare(): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const arpeggio = [
      { freq: 523.25, start: 0.0, dur: 0.3 },  // C5
      { freq: 659.25, start: 0.12, dur: 0.3 }, // E5
      { freq: 783.99, start: 0.24, dur: 0.35 },// G5
      { freq: 1046.5, start: 0.38, dur: 0.8 }, // C6
    ];

    arpeggio.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + start);

      gainNode.gain.setValueAtTime(0.001, now + start);
      gainNode.gain.exponentialRampToValueAtTime(0.24, now + start + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + dur);
    });
  }

  /**
   * Subtle soft click for button taps and state refreshes
   */
  public playTapClick(): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.04);

    gainNode.gain.setValueAtTime(0.06, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Subtle crisp mechanical click for runner selection (1st, 2nd, 3rd ranks)
   */
  public playSelectionClick(rank: 1 | 2 | 3 = 1): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Subtle crisp pitch: 1400Hz for 1st, 1200Hz for 2nd, 1000Hz for 3rd
    const freq = rank === 1 ? 1400 : rank === 2 ? 1200 : 1000;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.028);

    gainNode.gain.setValueAtTime(0.09, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.028);
  }

  /**
   * Safe native device vibration haptic pulse
   */
  public triggerHapticFeedback(pattern: number | number[] = 15): void {
    try {
      if (typeof window !== "undefined" && "vibrate" in navigator && typeof navigator.vibrate === "function") {
        navigator.vibrate(pattern);
      }
    } catch {
      // ignore
    }
  }
}

export const audioAlerts = new TurfSheetAudioSynthesizer();
