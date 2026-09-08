import { SoundTone } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playTone(tone: SoundTone = 'zen-chime', volume: number = 75) {
    if (volume <= 0) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const masterGain = ctx.createGain();
      const gainVal = Math.min(1, Math.max(0, volume / 100)) * 0.45;
      masterGain.gain.setValueAtTime(gainVal, ctx.currentTime);
      masterGain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (tone === 'zen-chime') {
        // Ethereal harmonics: 528Hz, 792Hz, 1056Hz
        const freqs = [528, 792, 1056];
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.08);

          noteGain.gain.setValueAtTime(0, now + i * 0.08);
          noteGain.gain.linearRampToValueAtTime(1 / (i + 1), now + i * 0.08 + 0.03);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 1.6);

          osc.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 1.8);
        });
      } else if (tone === 'soft-bell') {
        // Bell with shimmer
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.8);

        noteGain.gain.setValueAtTime(1, now);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 1.3);
      } else if (tone === 'marimba') {
        // Warm double pop
        [440, 659.25].forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + idx * 0.12);

          noteGain.gain.setValueAtTime(0, now + idx * 0.12);
          noteGain.gain.linearRampToValueAtTime(0.8, now + idx * 0.12 + 0.01);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.4);

          osc.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.5);
        });
      } else if (tone === 'sonar') {
        // Subtle futuristic pulse
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);

        noteGain.gain.setValueAtTime(0.7, now);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.7);
      }
    } catch {
      // AudioContext fallback handling
    }
  }

  // Full multi-pulse timer completion alarm sound
  public playAlarm(tone: SoundTone = 'zen-chime', volume: number = 75) {
    if (volume <= 0) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const masterGain = ctx.createGain();
      const gainVal = Math.min(1, Math.max(0, volume / 100)) * 0.55;
      masterGain.gain.setValueAtTime(gainVal, ctx.currentTime);
      masterGain.connect(ctx.destination);

      const now = ctx.currentTime;

      // Play 3 successive melodic alarm pulse rings
      const pulseDelays = [0, 0.35, 0.7, 1.05];

      pulseDelays.forEach((pulseDelay, pulseIdx) => {
        const pulseTime = now + pulseDelay;

        if (tone === 'zen-chime') {
          // Melodic sequence: C6, E6, G6, C7
          const notes = [1046.5, 1318.5, 1567.98];
          notes.forEach((freq, noteIdx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, pulseTime + noteIdx * 0.06);

            gain.gain.setValueAtTime(0, pulseTime + noteIdx * 0.06);
            gain.gain.linearRampToValueAtTime(0.7 / (noteIdx + 1), pulseTime + noteIdx * 0.06 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, pulseTime + noteIdx * 0.06 + 0.6);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(pulseTime + noteIdx * 0.06);
            osc.stop(pulseTime + noteIdx * 0.06 + 0.65);
          });
        } else if (tone === 'soft-bell') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          const baseFreq = pulseIdx % 2 === 0 ? 880 : 1046.5;
          osc.frequency.setValueAtTime(baseFreq, pulseTime);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, pulseTime + 0.4);

          gain.gain.setValueAtTime(0.9, pulseTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, pulseTime + 0.5);

          osc.connect(gain);
          gain.connect(masterGain);

          osc.start(pulseTime);
          osc.stop(pulseTime + 0.55);
        } else if (tone === 'marimba') {
          const pitches = [523.25, 659.25, 783.99, 1046.5];
          const f = pitches[pulseIdx % pitches.length];
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, pulseTime);

          gain.gain.setValueAtTime(0.9, pulseTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, pulseTime + 0.35);

          osc.connect(gain);
          gain.connect(masterGain);

          osc.start(pulseTime);
          osc.stop(pulseTime + 0.4);
        } else {
          // Sonar / futuristic alarm pulses
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, pulseTime);
          osc.frequency.exponentialRampToValueAtTime(1200, pulseTime + 0.15);

          gain.gain.setValueAtTime(0.8, pulseTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, pulseTime + 0.3);

          osc.connect(gain);
          gain.connect(masterGain);

          osc.start(pulseTime);
          osc.stop(pulseTime + 0.35);
        }
      });
    } catch {
      // AudioContext fallback handling
    }
  }
}

export const soundManager = new AudioEngine();
