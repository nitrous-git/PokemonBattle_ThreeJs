/** Original synthesized cues. No external audio files or game music. */
export class AudioService {
  constructor() {
    this.settings = { volume: 0.3, mute: false, music: false };
    this.step = 0;
  }
  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') this.context.resume();
    this.apply();
  }
  apply(settings = this.settings) {
    this.settings = settings;
    if (this.master) this.master.gain.value = settings.mute ? 0 : settings.volume * 0.28;
    if (settings.music && !this.timer) this.timer = setInterval(() => this.loop(), 320);
    if (!settings.music && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  tone(freq, duration = 0.15, type = 'sine', delay = 0, volume = 0.4, endFreq = null) {
    if (!this.context || this.context.state !== 'running') return;
    const o = this.context.createOscillator(),
      g = this.context.createGain(),
      t = this.context.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.03);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  cue(kind, type) {
    if (kind === 'intro-entry') {
      this.tone(180, 0.22, 'sine', 0, 0.16, 640);
      return;
    }
    if (kind === 'intro-impact') {
      this.tone(110, 0.18, 'triangle', 0, 0.32, 55);
      this.tone(587, 0.22, 'sine', 0, 0.16);
      return;
    }
    if (kind === 'select') {
      this.tone(660, 0.07, 'sine');
      return;
    }
    if (kind === 'purchase' || kind === 'victory' || kind === 'level') {
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', i * 0.1));
      return;
    }
    if (kind === 'defeat') {
      [392, 330, 262].forEach((f, i) => this.tone(f, 0.4, 'triangle', i * 0.12));
      return;
    }
    if (kind === 'start') {
      [196, 294, 392, 587].forEach((f, i) => this.tone(f, 0.22, 'triangle', i * 0.07));
      return;
    }
    if (kind === 'hit') {
      const f =
        { fire: 180, electric: 1100, water: 500, psychic: 700, ghost: 150, grass: 440 }[type] ||
        240;
      this.tone(f, 0.22, type === 'electric' ? 'sawtooth' : 'triangle', 0, 0.5, f * 0.5);
      this.tone(f * 2, 0.1, 'sine', 0.05, 0.2);
      return;
    }
    if (kind === 'status') {
      this.tone(440, 0.24, 'sine');
      this.tone(660, 0.25, 'sine', 0.15);
    } else this.tone(180, 0.1, 'triangle');
  }
  loop() {
    if (!this.context) return;
    const notes = [
      261.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66, 261.63, 392, 523.25, 493.88, 440,
      329.63, 293.66, 196,
    ];
    this.tone(notes[this.step % 16], 0.6, 'sine', 0, 0.07);
    if (this.step % 4 === 0)
      this.tone([130.81, 110, 98, 130.81][Math.floor(this.step / 4) % 4], 1, 'triangle', 0, 0.07);
    this.step++;
  }
}
