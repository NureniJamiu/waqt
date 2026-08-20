import { SoundOption } from "../types";

export function playSineOscillator(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    
    const ctx = new AudioCtx();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 1.2);
    osc2.stop(ctx.currentTime + 1.2);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1500);
  } catch {
    // Ignore Web Audio API errors
  }
}

let currentAudio: HTMLAudioElement | null = null;

export function stopSound(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // Ignore pause errors
    }
    currentAudio = null;
  }
}

export function playSound(option?: SoundOption, enabled: boolean = true): void {
  if (!enabled) return;
  stopSound();

  const sound = option === "takbeer" ? "takbeer" : "chime";
  const audioPath = `/assets/${sound}.mp3`;

  try {
    const audio = new Audio(audioPath);
    audio.volume = 0.6;
    currentAudio = audio;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn(`[Waqt Sound] Audio playback for ${sound} failed, falling back to Web Audio oscillator:`, err);
        playSineOscillator();
      });
    }
  } catch (err) {
    console.warn(`[Waqt Sound] Error creating Audio object for ${sound}, falling back to Web Audio oscillator:`, err);
    playSineOscillator();
  }
}
