// Multi-Channel Background-Capable Audio & Notification Push Engine for TurfSheet
// 1. Trifecta Siren ("WOO-OOO-WOO-OOO!") when the Syndicate lands a Winning Trifecta
// 2. Cash Register ("Ka-Ching!") for Winning Race Selections / Official Race Confirmations
// 3. Game Show Wrong Answer ("Dun-Dun!") for Unplaced Race Selections
//
// Features:
// - Pre-synthesized 16-bit PCM WAV Data URIs for HTML5 <audio> playback (works in background tabs!)
// - Web Audio API Dual-Oscillator Synthesizer
// - Silent background audio keep-alive channel + MediaSession integration so browsers never suspend audio in inactive tabs
// - Auto-unlock on pointermove/mousemove/scroll/wheel/touchstart/keydown/focus + Pending Sound Queue (no button click required)
// - Web Worker unthrottled background timer so background tab polling & sound triggers fire on schedule

import {
  DUN_DUN_LOCAL_MP3_URL,
  DUN_DUN_MP3_DATA_URI,
  DUN_DUN_VOICEMOD_MP3_URL,
  DUN_DUN_VOICEMOD_PAGE_URL,
} from "./dunDunSoundAsset";

export type SoundEffectType =
  | "trifecta"
  | "cash"
  | "wrong"
  | "showmethemoney"
  | "dingding";

let sharedAudioCtx: AudioContext | null = null;
let unlockListenersAttached = false;
let audioUnlockedOnce = false;
let keepAliveAudio: HTMLAudioElement | null = null;
const wavDataUrlCache: Partial<Record<SoundEffectType | "keepalive", string>> = {};
const audioElementPool: Partial<Record<SoundEffectType, HTMLAudioElement[]>> = {};
const pendingSoundQueue: Array<{ type: SoundEffectType; queuedAt: number }> = [];

let dunDunAudioPool: HTMLAudioElement[] | null = null;
let dunDunAudioBuffer: AudioBuffer | null = null;
let isDecodingDunDun = false;

function playVoicemodDunDunAudio(): boolean {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return false;
  }
  try {
    if (!dunDunAudioPool) {
      dunDunAudioPool = [
        new Audio(DUN_DUN_MP3_DATA_URI),
        new Audio(DUN_DUN_MP3_DATA_URI),
        new Audio(DUN_DUN_LOCAL_MP3_URL),
      ];
      dunDunAudioPool.forEach((a) => {
        a.preload = "auto";
        a.volume = 0.95;
      });
    }

    const player =
      dunDunAudioPool.find((a) => a.paused || a.ended) || dunDunAudioPool[0];
    player.currentTime = 0;
    player.volume = 0.95;
    const playPromise = player.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise
        .then(() => {
          audioUnlockedOnce = true;
          ensureBackgroundKeepAlive();
        })
        .catch(() => {
          try {
            const fallback = new Audio(DUN_DUN_VOICEMOD_MP3_URL);
            fallback.volume = 0.95;
            fallback.play().catch(() => {});
          } catch {
            // ignore
          }
        });
    }
    return true;
  } catch {
    return false;
  }
}

function encodeWavFromSamples(samples: Float32Array, sampleRate = 22050): string {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      offset,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true
    );
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function buildSynthesizedWav(type: SoundEffectType | "keepalive"): string {
  const cached = wavDataUrlCache[type];
  if (cached) return cached;

  const sampleRate = 22050;

  if (type === "keepalive") {
    const samples = new Float32Array(sampleRate);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 40 * i) / sampleRate) * 0.00002;
    }
    const url = encodeWavFromSamples(samples, sampleRate);
    wavDataUrlCache[type] = url;
    return url;
  }

  if (type === "trifecta") {
    const duration = 2.15;
    const totalSamples = Math.floor(sampleRate * duration);
    const samples = new Float32Array(totalSamples);
    let phase1 = 0;
    let phase2 = 0;

    const getSirenFreq = (t: number): number => {
      if (t < 0.38) return 420 + ((920 - 420) * t) / 0.38;
      if (t < 0.72) return 920 + ((460 - 920) * (t - 0.38)) / 0.34;
      if (t < 1.12) return 460 + ((980 - 460) * (t - 0.72)) / 0.4;
      if (t < 1.46) return 980 + ((480 - 980) * (t - 1.12)) / 0.34;
      if (t < 1.88) return 480 + ((1040 - 480) * (t - 1.46)) / 0.42;
      return 1040 + ((620 - 1040) * (t - 1.88)) / 0.27;
    };

    const bellNotes = [2093.0, 2637.02, 3135.96, 4186.01];

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const f1 = getSirenFreq(t);
      const f2 = f1 * 1.5;
      phase1 += (2 * Math.PI * f1) / sampleRate;
      phase2 += (2 * Math.PI * f2) / sampleRate;

      const env =
        t < 0.05
          ? t / 0.05
          : t > 1.8
          ? Math.max(0, 1 - (t - 1.8) / 0.35)
          : 1.0;

      // Rich sawtooth/harmonic blend
      const wave1 = Math.sin(phase1) + 0.35 * Math.sin(2 * phase1);
      const wave2 = Math.sin(phase2) * 0.6;
      let val = (wave1 + wave2) * 0.28 * env;

      // Bell fanfare overlay starting at 1.42s
      bellNotes.forEach((bf, idx) => {
        const bStart = 1.42 + idx * 0.11;
        if (t >= bStart && t <= bStart + 0.52) {
          const bt = t - bStart;
          const bEnv = Math.exp(-bt * 6.5);
          val += Math.sin(2 * Math.PI * bf * bt) * 0.24 * bEnv;
        }
      });

      samples[i] = Math.max(-0.98, Math.min(0.98, val));
    }

    const url = encodeWavFromSamples(samples, sampleRate);
    wavDataUrlCache[type] = url;
    return url;
  }

  if (type === "cash") {
    const duration = 1.05;
    const totalSamples = Math.floor(sampleRate * duration);
    const samples = new Float32Array(totalSamples);
    const bellFreqs = [2637.02, 3951.07, 5274.04];

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      let val = 0;

      // 1. "Ka-" mechanical click transient (0.00s - 0.075s)
      if (t < 0.075) {
        const cf = 920 + ((1480 - 920) * t) / 0.075;
        const cEnv = Math.exp(-t * 42);
        val += Math.sin(2 * Math.PI * cf * t) * 0.45 * cEnv;
      }

      // 2. "-Ching!" bright metallic register bell (starts at 0.08s)
      if (t >= 0.08) {
        const bt = t - 0.08;
        bellFreqs.forEach((freq, idx) => {
          const peak = idx === 0 ? 0.38 : idx === 1 ? 0.22 : 0.15;
          const decay = idx === 0 ? 3.8 : 5.2;
          val += Math.sin(2 * Math.PI * freq * bt) * peak * Math.exp(-bt * decay);
        });
      }

      // 3. Coin shimmer overtone at 0.15s
      if (t >= 0.15 && t <= 0.72) {
        const ct = t - 0.15;
        const cf = ct < 0.05 ? 3135.96 : 4186.01;
        val += Math.sin(2 * Math.PI * cf * ct) * 0.24 * Math.exp(-ct * 5.0);
      }

      samples[i] = Math.max(-0.98, Math.min(0.98, val));
    }

    const url = encodeWavFromSamples(samples, sampleRate);
    wavDataUrlCache[type] = url;
    return url;
  }

  if (type === "showmethemoney") {
    // Iconic "SHOW... ME... THE... MON-EY!" Fanfare & Payout Climax (2.55s)
    const duration = 2.55;
    const totalSamples = Math.floor(sampleRate * duration);
    const samples = new Float32Array(totalSamples);
    const bellNotes = [2093.0, 2637.02, 3135.96, 4186.01, 5274.04];

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      let val = 0;

      // Syllable 1: "SHOW" (0.00s - 0.35s, G4 chord)
      if (t < 0.35) {
        const env = t < 0.03 ? t / 0.03 : Math.exp(-(t - 0.03) * 5.2);
        const f1 = 392.0;
        const f2 = 587.33;
        const f3 = 783.99;
        const brass =
          Math.sin(2 * Math.PI * f1 * t) +
          0.6 * Math.sin(2 * Math.PI * f2 * t) +
          0.35 * Math.sin(2 * Math.PI * f3 * t);
        val += brass * 0.32 * env;
      }

      // Syllable 2: "ME" (0.38s - 0.65s, Bb4 chord)
      if (t >= 0.38 && t < 0.65) {
        const st = t - 0.38;
        const env = st < 0.03 ? st / 0.03 : Math.exp(-(st - 0.03) * 5.5);
        const f1 = 466.16;
        const f2 = 698.46;
        const f3 = 932.33;
        const brass =
          Math.sin(2 * Math.PI * f1 * st) +
          0.6 * Math.sin(2 * Math.PI * f2 * st) +
          0.35 * Math.sin(2 * Math.PI * f3 * st);
        val += brass * 0.35 * env;
      }

      // Syllable 3: "THE" (0.68s - 0.90s, C5 chord)
      if (t >= 0.68 && t < 0.90) {
        const st = t - 0.68;
        const env = st < 0.02 ? st / 0.02 : Math.exp(-(st - 0.02) * 6.5);
        const f1 = 523.25;
        const f2 = 783.99;
        const f3 = 1046.5;
        const brass =
          Math.sin(2 * Math.PI * f1 * st) +
          0.6 * Math.sin(2 * Math.PI * f2 * st) +
          0.4 * Math.sin(2 * Math.PI * f3 * st);
        val += brass * 0.36 * env;
      }

      // Syllable 4: "MON-EY!" Grand Triumphant Crescendo + Bell Cascade (0.94s - 2.50s)
      if (t >= 0.94) {
        const st = t - 0.94;
        const sweepFreq = 698.46 + Math.min(st / 0.45, 1) * (1046.5 - 698.46);
        const env =
          st < 0.05
            ? st / 0.05
            : st > 1.2
            ? Math.max(0, 1 - (st - 1.2) / 0.4)
            : 1.0;
        const vibrato = Math.sin(2 * Math.PI * 5.5 * st) * 12;
        const brassClimax =
          Math.sin(2 * Math.PI * (sweepFreq + vibrato) * st) +
          0.5 * Math.sin(4 * Math.PI * (sweepFreq + vibrato) * st) +
          0.3 * Math.sin(2 * Math.PI * 1318.51 * st);
        val += brassClimax * 0.38 * env;

        // Cash register bells overlay
        bellNotes.forEach((bf, idx) => {
          const bStart = 0.98 + idx * 0.12;
          if (t >= bStart && t <= bStart + 0.65) {
            const bt = t - bStart;
            val += Math.sin(2 * Math.PI * bf * bt) * 0.22 * Math.exp(-bt * 5.0);
          }
        });
      }

      samples[i] = Math.max(-0.98, Math.min(0.98, val));
    }

    const url = encodeWavFromSamples(samples, sampleRate);
    wavDataUrlCache[type] = url;
    return url;
  }

  if (type === "wrong") {
    // Official Voicemod Tuna "Wrong Buzzer" / Dun-Dun Meme Sound Effect
    // https://tuna.voicemod.net/sound/c428d6bc-f0aa-4b49-972b-d771dd05863f
    wavDataUrlCache[type] = DUN_DUN_MP3_DATA_URI;
    return DUN_DUN_MP3_DATA_URI;
  }

  if (type === "dingding") {
    const duration = 0.72;
    const totalSamples = Math.floor(sampleRate * duration);
    const dingSamples = new Float32Array(totalSamples);

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      let val = 0;

      // Bell 1: "Ding" (0.00s - 0.25s, E6 ~ 1318.51Hz)
      if (t < 0.25) {
        const env = t < 0.005 ? t / 0.005 : Math.exp(-(t - 0.005) * 9.5);
        val +=
          (Math.sin(2 * Math.PI * 1318.51 * t) +
            0.35 * Math.sin(2 * Math.PI * 2637.02 * t)) *
          0.42 *
          env;
      }

      // Bell 2: "Ding" (0.26s - 0.70s, A6 ~ 1760.0Hz)
      if (t >= 0.26) {
        const st = t - 0.26;
        const env = st < 0.005 ? st / 0.005 : Math.exp(-(st - 0.005) * 7.5);
        val +=
          (Math.sin(2 * Math.PI * 1760.0 * st) +
            0.35 * Math.sin(2 * Math.PI * 3520.0 * st)) *
          0.45 *
          env;
      }

      dingSamples[i] = Math.max(-0.98, Math.min(0.98, val));
    }

    const url = encodeWavFromSamples(dingSamples, sampleRate);
    wavDataUrlCache[type] = url;
    return url;
  }

  return "";
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    try {
      sharedAudioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }
  return sharedAudioCtx;
}

function ensureBackgroundKeepAlive(): void {
  if (typeof window === "undefined") return;
  try {
    if (!keepAliveAudio) {
      keepAliveAudio = new Audio(buildSynthesizedWav("keepalive"));
      keepAliveAudio.loop = true;
      keepAliveAudio.volume = 0.01;
      keepAliveAudio.preload = "auto";
    }
    if (keepAliveAudio.paused) {
      keepAliveAudio.play().catch(() => {});
    }
  } catch {
    // ignore
  }
}

function playHtml5WavSound(type: SoundEffectType): Promise<boolean> {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return Promise.resolve(false);
  }
  try {
    const dataUrl = buildSynthesizedWav(type);
    let pool = audioElementPool[type];
    if (!pool) {
      pool = [new Audio(dataUrl), new Audio(dataUrl)];
      pool.forEach((a) => {
        a.preload = "auto";
        a.volume = 0.95;
      });
      audioElementPool[type] = pool;
    }
    const player = pool.find((a) => a.paused || a.ended) || pool[0];
    player.currentTime = 0;
    player.volume = 0.95;
    const playPromise = player.play();
    if (playPromise && typeof playPromise.then === "function") {
      return playPromise
        .then(() => {
          audioUnlockedOnce = true;
          ensureBackgroundKeepAlive();
          return true;
        })
        .catch(() => false);
    }
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

function enqueuePendingSound(type: SoundEffectType): void {
  const now = Date.now();
  // Keep only recent triggers (within last 60s) and avoid duplicate spam
  while (pendingSoundQueue.length > 0 && now - pendingSoundQueue[0].queuedAt > 60_000) {
    pendingSoundQueue.shift();
  }
  if (pendingSoundQueue.length < 3) {
    pendingSoundQueue.push({ type, queuedAt: now });
  }
}

function flushPendingSounds(): void {
  if (pendingSoundQueue.length === 0) return;
  const now = Date.now();
  const next = pendingSoundQueue.shift();
  if (!next || now - next.queuedAt > 60_000) return;
  if (next.type === "trifecta") {
    playTrifectaSirenSound();
  } else if (next.type === "cash") {
    playCashRegisterSound();
  } else if (next.type === "dingding") {
    playDingDingChime();
  } else {
    playWrongAnswerSound();
  }
}

export function attachSafariAudioUnlock(): void {
  if (typeof window === "undefined" || unlockListenersAttached) return;
  unlockListenersAttached = true;

  // Pre-build WAV Data URIs so background playback is zero-latency
  try {
    buildSynthesizedWav("trifecta");
    buildSynthesizedWav("cash");
    buildSynthesizedWav("wrong");
    buildSynthesizedWav("dingding");
    buildSynthesizedWav("keepalive");
  } catch {
    // ignore
  }

  const unlock = () => {
    try {
      const ctx = getAudioContext();
      if (ctx) {
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
        if (!audioUnlockedOnce) {
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
          audioUnlockedOnce = true;
        }
      }
      ensureBackgroundKeepAlive();
      if (pendingSoundQueue.length > 0) {
        flushPendingSounds();
      }
    } catch {
      // ignore
    }

    // Request browser notification permission opportunistically so background tab alerts work
    try {
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "default"
      ) {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  // Attempt immediate unlock on load
  unlock();

  // Attach broad non-blocking listeners so moving mouse, scrolling, focusing, or touching unlocks audio without needing a button click
  const events = [
    "pointerdown",
    "pointermove",
    "mousedown",
    "mousemove",
    "touchstart",
    "touchmove",
    "wheel",
    "scroll",
    "keydown",
    "keyup",
    "click",
    "focus",
  ];
  events.forEach((evt) => {
    window.addEventListener(evt, unlock, { passive: true });
  });
  document.addEventListener("visibilitychange", unlock, { passive: true });
}

attachSafariAudioUnlock();

function playWebAudioSynthesizer(
  type: SoundEffectType,
  callback: (ctx: AudioContext) => void
): void {
  // Always fire the HTML5 WAV engine in parallel so background tabs play reliably even when Web Audio oscillators are throttled
  playHtml5WavSound(type).then((playedHtml5) => {
    const ctx = getAudioContext();
    if (!ctx) {
      if (!playedHtml5) enqueuePendingSound(type);
      return;
    }

    if (ctx.state === "suspended") {
      ctx
        .resume()
        .then(() => {
          audioUnlockedOnce = true;
          ensureBackgroundKeepAlive();
          // If HTML5 WAV didn't already play, synthesize via Web Audio
          if (!playedHtml5) {
            callback(ctx);
          }
        })
        .catch(() => {
          if (!playedHtml5) {
            enqueuePendingSound(type);
          }
        });
    } else if (!playedHtml5) {
      callback(ctx);
    }
  });
}

/**
 * Speaks the famous energetic movie quote "Show me the money!"
 * using the browser's speech synthesis engine with high-energy Jerry Maguire delivery.
 */
export function speakShowMeTheMoneyQuote(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance("Show me the money!");
      utterance.rate = 1.15;
      utterance.pitch = 1.25;
      utterance.volume = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Natural") ||
              v.name.includes("Male") ||
              v.name.includes("Guy") ||
              v.name.includes("Daniel") ||
              v.name.includes("David") ||
              v.name.includes("Alex"))
        ) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0];
      if (preferred) {
        utterance.voice = preferred;
      }
      window.speechSynthesis.speak(utterance);
    } catch {
      // speech synthesis graceful fallback
    }
  }
}

/**
 * Plays the famous movie quote "SHOW ME THE MONEY!" sound effect:
 * - Speaks "Show me the money!" via browser speech synthesis
 * - Dual-oscillator 4-syllable brass fanfare progression ("SHOW... ME... THE... MON-EY!")
 * - High-harmonic cash register bells & triumphant payout glissando
 * - 16-bit PCM WAV HTML5 background audio playback
 */
export function playShowMeTheMoneySound(): void {
  // 1. Spoken vocal delivery
  speakShowMeTheMoneyQuote();

  // 2. Triumphant musical fanfare & cash bell climax
  playWebAudioSynthesizer("showmethemoney", (ctx) => {
    try {
      const now = ctx.currentTime + 0.01;

      // Syllable 1: "SHOW" (0.00s - 0.35s, G4 chord)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sawtooth";
      osc2.type = "triangle";
      osc1.frequency.setValueAtTime(392.0, now);
      osc2.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.34, now + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc1.connect(gain1);
      osc2.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);

      // Syllable 2: "ME" (0.38s - 0.65s, Bb4 chord)
      const mOsc1 = ctx.createOscillator();
      const mOsc2 = ctx.createOscillator();
      const mGain = ctx.createGain();
      mOsc1.type = "sawtooth";
      mOsc2.type = "triangle";
      mOsc1.frequency.setValueAtTime(466.16, now + 0.38);
      mOsc2.frequency.setValueAtTime(698.46, now + 0.38);
      mGain.gain.setValueAtTime(0.001, now + 0.38);
      mGain.gain.linearRampToValueAtTime(0.36, now + 0.41);
      mGain.gain.exponentialRampToValueAtTime(0.001, now + 0.64);
      mOsc1.connect(mGain);
      mOsc2.connect(mGain);
      mGain.connect(ctx.destination);
      mOsc1.start(now + 0.38);
      mOsc2.start(now + 0.38);
      mOsc1.stop(now + 0.65);
      mOsc2.stop(now + 0.65);

      // Syllable 3: "THE" (0.68s - 0.90s, C5 chord)
      const tOsc1 = ctx.createOscillator();
      const tOsc2 = ctx.createOscillator();
      const tGain = ctx.createGain();
      tOsc1.type = "sawtooth";
      tOsc2.type = "triangle";
      tOsc1.frequency.setValueAtTime(523.25, now + 0.68);
      tOsc2.frequency.setValueAtTime(783.99, now + 0.68);
      tGain.gain.setValueAtTime(0.001, now + 0.68);
      tGain.gain.linearRampToValueAtTime(0.38, now + 0.7);
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.89);
      tOsc1.connect(tGain);
      tOsc2.connect(tGain);
      tGain.connect(ctx.destination);
      tOsc1.start(now + 0.68);
      tOsc2.start(now + 0.68);
      tOsc1.stop(now + 0.9);
      tOsc2.stop(now + 0.9);

      // Syllable 4: "MON-EY!" Grand Triumphant Crescendo + Bell Cascade (0.94s - 2.50s)
      const climOsc1 = ctx.createOscillator();
      const climOsc2 = ctx.createOscillator();
      const climFilter = ctx.createBiquadFilter();
      const climGain = ctx.createGain();
      climOsc1.type = "sawtooth";
      climOsc2.type = "triangle";
      climOsc1.frequency.setValueAtTime(698.46, now + 0.94);
      climOsc1.frequency.exponentialRampToValueAtTime(1046.5, now + 1.45);
      climOsc2.frequency.setValueAtTime(1046.5, now + 0.94);
      climOsc2.frequency.exponentialRampToValueAtTime(1567.98, now + 1.45);
      climFilter.type = "lowpass";
      climFilter.frequency.setValueAtTime(3200, now + 0.94);
      climGain.gain.setValueAtTime(0.001, now + 0.94);
      climGain.gain.linearRampToValueAtTime(0.42, now + 1.0);
      climGain.gain.setValueAtTime(0.42, now + 1.7);
      climGain.gain.exponentialRampToValueAtTime(0.001, now + 2.45);
      climOsc1.connect(climFilter);
      climOsc2.connect(climFilter);
      climFilter.connect(climGain);
      climGain.connect(ctx.destination);
      climOsc1.start(now + 0.94);
      climOsc2.start(now + 0.94);
      climOsc1.stop(now + 2.5);
      climOsc2.stop(now + 2.5);

      // Cash register bells overlay
      const bellFreqs = [2093.0, 2637.02, 3135.96, 4186.01, 5274.04];
      bellFreqs.forEach((freq, idx) => {
        const bStart = now + 1.0 + idx * 0.12;
        const bOsc = ctx.createOscillator();
        const bGain = ctx.createGain();
        bOsc.type = "sine";
        bOsc.frequency.setValueAtTime(freq, bStart);
        bGain.gain.setValueAtTime(0.001, bStart);
        bGain.gain.linearRampToValueAtTime(0.25, bStart + 0.01);
        bGain.gain.exponentialRampToValueAtTime(0.001, bStart + 0.6);
        bOsc.connect(bGain);
        bGain.connect(ctx.destination);
        bOsc.start(bStart);
        bOsc.stop(bStart + 0.65);
      });
    } catch {
      // ignore audio errors
    }
  });
}

/**
 * Plays a celebratory Racecourse Trifecta Siren & "Show Me The Money!" Quote
 * when the syndicate's combined selections successfully land 1st, 2nd & 3rd in a race!
 */
export function playTrifectaSirenSound(): void {
  playShowMeTheMoneySound();
}

/**
 * Plays a realistic, high-fidelity Cash Register "Cha-Ching!" sound effect.
 * If multiple selections place or win, plays the "cha ching" sound as a multiple of the occurrence
 * (e.g., 2 horses placed -> played twice with 400ms cadence; 3 horses placed -> played 3 times).
 */
export function playCashRegisterSound(occurrences: number = 1): void {
  const times = Math.max(1, Math.min(5, Math.floor(occurrences || 1)));

  const playSingleChing = (index: number) => {
    playWebAudioSynthesizer("cash", (ctx) => {
      try {
        const now = ctx.currentTime + 0.01;

        // 1. Mechanical slide & drawer latch ("Cha-")
        const clickOsc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        clickOsc.type = "triangle";
        clickOsc.frequency.setValueAtTime(880, now);
        clickOsc.frequency.exponentialRampToValueAtTime(1520, now + 0.065);

        clickGain.gain.setValueAtTime(0.38, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

        clickOsc.connect(clickGain);
        clickGain.connect(ctx.destination);
        clickOsc.start(now);
        clickOsc.stop(now + 0.08);

        // 2. High-precision dual-harmonic bell ring ("-Ching!")
        const bellStart = now + 0.082;
        // Pitch ascends slightly with successive hits for auditory thrill!
        const pitchMultiplier = 1 + index * 0.04;
        const bellFreqs = [2637.02 * pitchMultiplier, 3951.07 * pitchMultiplier, 5274.04 * pitchMultiplier];

        bellFreqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = idx === 1 ? "triangle" : "sine";
          osc.frequency.setValueAtTime(freq, bellStart);

          const peakGain = idx === 0 ? 0.38 : idx === 1 ? 0.22 : 0.16;
          const duration = idx === 0 ? 0.98 : 0.72;

          gain.gain.setValueAtTime(0.0001, bellStart);
          gain.gain.linearRampToValueAtTime(peakGain, bellStart + 0.007);
          gain.gain.exponentialRampToValueAtTime(0.0008, bellStart + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(bellStart);
          osc.stop(bellStart + duration + 0.02);
        });

        // 3. Shimmering brass coin cascade overtone
        const coinStart = now + 0.15;
        const coinOsc = ctx.createOscillator();
        const coinGain = ctx.createGain();
        coinOsc.type = "sine";
        coinOsc.frequency.setValueAtTime(3135.96 * pitchMultiplier, coinStart);
        coinOsc.frequency.setValueAtTime(4186.01 * pitchMultiplier, coinStart + 0.05);

        coinGain.gain.setValueAtTime(0.24, coinStart);
        coinGain.gain.exponentialRampToValueAtTime(0.001, coinStart + 0.58);

        coinOsc.connect(coinGain);
        coinGain.connect(ctx.destination);
        coinOsc.start(coinStart);
        coinOsc.stop(coinStart + 0.6);
      } catch {
        // ignore audio errors
      }
    });
  };

  for (let i = 0; i < times; i++) {
    setTimeout(() => {
      playSingleChing(i);
    }, i * 420);
  }
}

/**
 * Plays the official "Dun-Dun" / Wrong Answer sound effect:
 * Replaced with Voicemod Tuna: https://tuna.voicemod.net/sound/c428d6bc-f0aa-4b49-972b-d771dd05863f
 * Direct MP3: https://us-tuna-sounds-files.voicemod.net/c428d6bc-f0aa-4b49-972b-d771dd05863f-1641626284572.mp3
 * (Includes embedded base64 Data URI + local /sounds/dun_dun_wrong.mp3 + Web Audio buffer for instant zero-latency playback)
 */
export function playWrongAnswerSound(): void {
  // 1. Play the exact Voicemod Tuna "Wrong Buzzer" / Dun-Dun audio
  const played = playVoicemodDunDunAudio();

  // 2. Also decode & play through Web Audio API for maximum punchiness if context is active
  playWebAudioSynthesizer("wrong", (ctx) => {
    try {
      if (dunDunAudioBuffer) {
        const source = ctx.createBufferSource();
        source.buffer = dunDunAudioBuffer;
        const gain = ctx.createGain();
        gain.gain.value = 0.95;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
        return;
      } else if (!isDecodingDunDun) {
        isDecodingDunDun = true;
        fetch(DUN_DUN_MP3_DATA_URI)
          .then((r) => r.arrayBuffer())
          .then((b) => ctx.decodeAudioData(b))
          .then((decoded) => {
            dunDunAudioBuffer = decoded;
            const source = ctx.createBufferSource();
            source.buffer = decoded;
            const gain = ctx.createGain();
            gain.gain.value = 0.95;
            source.connect(gain);
            gain.connect(ctx.destination);
            source.start(0);
          })
          .catch(() => {})
          .finally(() => {
            isDecodingDunDun = false;
          });
      }
    } catch {
      // ignore
    }

    // Fallback if HTML5 audio and buffer decoding could not fire
    if (!played) {
      try {
        const now = ctx.currentTime + 0.01;
        const playNote = (
          startTime: number,
          duration: number,
          startFreq: number,
          endFreq: number,
          volume: number
        ) => {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();

          osc1.type = "sawtooth";
          osc2.type = "square";

          osc1.frequency.setValueAtTime(startFreq, startTime);
          osc1.frequency.linearRampToValueAtTime(endFreq, startTime + duration);

          osc2.frequency.setValueAtTime(startFreq * 0.992, startTime);
          osc2.frequency.linearRampToValueAtTime(
            endFreq * 0.992,
            startTime + duration
          );

          filter.type = "lowpass";
          filter.frequency.setValueAtTime(1100, startTime);
          filter.frequency.exponentialRampToValueAtTime(
            380,
            startTime + duration
          );

          gain.gain.setValueAtTime(0.0001, startTime);
          gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
          gain.gain.setValueAtTime(
            volume * 0.88,
            startTime + Math.max(0.04, duration - 0.12)
          );
          gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

          osc1.connect(filter);
          osc2.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(startTime);
          osc2.start(startTime);
          osc1.stop(startTime + duration + 0.02);
          osc2.stop(startTime + duration + 0.02);
        };

        playNote(now, 0.24, 196.0, 185.0, 0.42);
        playNote(now + 0.28, 0.65, 138.59, 116.0, 0.46);
      } catch {
        // ignore
      }
    }
  });
}

/**
 * Plays a bright double-bell "Ding-Ding!" announcement chime:
 * - Bell 1: E6 (1318.51Hz)
 * - Bell 2: A6 (1760.0Hz)
 */
export function playDingDingChime(): void {
  playWebAudioSynthesizer("dingding", (ctx) => {
    try {
      const now = ctx.currentTime + 0.01;
      const playBell = (startTime: number, freq: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.38, startTime + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        const harm = ctx.createOscillator();
        const harmGain = ctx.createGain();
        harm.type = "triangle";
        harm.frequency.setValueAtTime(freq * 2.01, startTime);
        harmGain.gain.setValueAtTime(0.001, startTime);
        harmGain.gain.linearRampToValueAtTime(0.16, startTime + 0.005);
        harmGain.gain.exponentialRampToValueAtTime(
          0.001,
          startTime + duration * 0.7
        );

        osc.connect(gain);
        gain.connect(ctx.destination);
        harm.connect(harmGain);
        harmGain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
        harm.start(startTime);
        harm.stop(startTime + duration + 0.02);
      };

      playBell(now, 1318.51, 0.25);
      playBell(now + 0.26, 1760.0, 0.46);
    } catch {
      // ignore
    }
  });
}

/**
 * Plays the official race outcome sound sequence for a race participated by user(s):
 * 1. If a trifecta is successful:
 *    -> Plays "SHOW ME THE MONEY!" from Cuba Gooding Jr in Jerry Maguire!
 * 2. If runners place or win:
 *    -> Plays "cha-ching" cash register sound as a multiple of the occurrence!
 *       (e.g., 2 horses placed/won -> played twice; 3 horses placed/won -> played 3 times)
 * 3. When NO runners win or place:
 *    -> Plays a dramatic "dun-dun" game show wrong sound!
 */
export function playRaceParticipatedResultSound(
  outcome:
    | boolean
    | {
        trifectaHit?: boolean;
        placedOrWonCount?: number;
      },
  legacyOccurrences: number = 1
): void {
  if (typeof outcome === "object" && outcome !== null) {
    if (outcome.trifectaHit) {
      playShowMeTheMoneySound();
      return;
    }
    const count = outcome.placedOrWonCount ?? 0;
    if (count > 0) {
      playCashRegisterSound(count);
    } else {
      playWrongAnswerSound();
    }
    return;
  }

  // Legacy boolean signature
  if (outcome) {
    playCashRegisterSound(legacyOccurrences);
  } else {
    playWrongAnswerSound();
  }
}

/**
 * Dispatches a native OS / Browser Desktop & Mobile notification (plus title flash)
 * so the user gets immediate audible + visual notice even when TurfSheet is in a background browser tab.
 */
export function dispatchBackgroundRaceAlert(options: {
  title: string;
  body: string;
  tag?: string;
}): void {
  if (typeof window === "undefined") return;

  // 1. Flash document title when tab is in the background so user spots it on the tab bar
  try {
    if (typeof document !== "undefined" && document.hidden) {
      const originalTitle = "TurfSheet - Punters club";
      document.title = `🔔 ${options.title} | TurfSheet`;
      const restore = () => {
        if (!document.hidden) {
          document.title = originalTitle;
          document.removeEventListener("visibilitychange", restore);
        }
      };
      document.addEventListener("visibilitychange", restore);
    }
  } catch {
    // ignore
  }

  // 2. Native Web Notification / ServiceWorker Notification (plays OS alert & banner across tabs)
  try {
    if (typeof Notification !== "undefined") {
      const fireNotification = () => {
        try {
          if (
            "serviceWorker" in navigator &&
            navigator.serviceWorker?.controller
          ) {
            navigator.serviceWorker.ready
              .then((reg) => {
                reg.showNotification(options.title, {
                  body: options.body,
                  tag: options.tag || `turfsheet-race-${Date.now()}`,
                  silent: false,
                });
              })
              .catch(() => {
                new Notification(options.title, {
                  body: options.body,
                  tag: options.tag || `turfsheet-race-${Date.now()}`,
                  silent: false,
                });
              });
          } else {
            new Notification(options.title, {
              body: options.body,
              tag: options.tag || `turfsheet-race-${Date.now()}`,
              silent: false,
            });
          }
        } catch {
          // ignore
        }
      };

      if (Notification.permission === "granted") {
        fireNotification();
      } else if (Notification.permission === "default") {
        Notification.requestPermission()
          .then((perm) => {
            if (perm === "granted") fireNotification();
          })
          .catch(() => {});
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Creates an unthrottled 1-second background ticker using a dedicated Web Worker thread.
 * Unlike window.setInterval (which browsers throttle to 60s+ when a tab is in the background),
 * a Web Worker timer continues firing every second even when the page is not the active tab.
 */
export function createUnthrottledBackgroundTicker(
  onTick: () => void,
  intervalMs = 1000
): () => void {
  if (typeof window === "undefined") return () => {};

  let worker: Worker | null = null;
  let workerUrl: string | null = null;
  let fallbackId: number | null = null;

  try {
    const workerCode = `
      let timer = setInterval(() => {
        postMessage("tick");
      }, ${Math.max(250, intervalMs)});
      onmessage = (e) => {
        if (e.data === "stop" && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    `;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    workerUrl = URL.createObjectURL(blob);
    worker = new Worker(workerUrl);
    worker.onmessage = () => {
      onTick();
    };
  } catch {
    fallbackId = window.setInterval(onTick, intervalMs);
  }

  return () => {
    if (worker) {
      try {
        worker.postMessage("stop");
        worker.terminate();
      } catch {
        // ignore
      }
      worker = null;
    }
    if (workerUrl) {
      try {
        URL.revokeObjectURL(workerUrl);
      } catch {
        // ignore
      }
      workerUrl = null;
    }
    if (fallbackId !== null) {
      window.clearInterval(fallbackId);
      fallbackId = null;
    }
  };
}
