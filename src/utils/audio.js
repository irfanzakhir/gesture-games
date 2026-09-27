/**
 * Lightweight audio manager using Web Audio API.
 * Includes procedural sound generation — no audio files needed!
 */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.enabled = true;
    this._initialized = false;
  }

  /** Initialize AudioContext (safe to call multiple times) */
  init() {
    if (this._initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._initialized = true;
      this._generateProceduralSounds();
    } catch (e) {
      console.warn('Web Audio API not available:', e);
    }
  }

  /** Ensure AudioContext is ready (call before playing) */
  _ensureContext() {
    if (!this._initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** Load a sound file from URL */
  async load(name, url) {
    this._ensureContext();
    if (!this.ctx) return;
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers.set(name, audioBuffer);
    } catch (e) {
      console.warn(`Failed to load sound "${name}":`, e);
    }
  }

  /** Play a loaded sound */
  play(name, volume = 0.5) {
    if (!this.enabled || !this.ctx) return;
    this._ensureContext();
    const buffer = this.buffers.get(name);
    if (!buffer) {
      // Try procedural fallback
      this._playProcedural(name, volume);
      return;
    }
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(0);
  }

  /** Toggle sound on/off */
  toggle() { this.enabled = !this.enabled; }

  // ─── Procedural Sound Generation ───

  /** Generate all game sounds procedurally */
  _generateProceduralSounds() {
    if (!this.ctx) return;
    this.buffers.set('pop', this._createPop());
    this.buffers.set('slice', this._createSlice());
    this.buffers.set('bomb', this._createBomb());
    this.buffers.set('coin', this._createCoin());
    this.buffers.set('combo', this._createCombo());
    this.buffers.set('countdown', this._createBeep(440, 0.15));
    this.buffers.set('countdownFinal', this._createBeep(880, 0.3));
    this.buffers.set('win', this._createWin());
    this.buffers.set('lose', this._createLose());
    this.buffers.set('crash', this._createCrash());
    this.buffers.set('select', this._createBeep(660, 0.1));
    this.buffers.set('hover', this._createBeep(330, 0.05));
    this.buffers.set('gameOver', this._createGameOver());
    this.buffers.set('engine', this._createEngine());

    // Piano notes C4 through B4
    const noteFreqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88];
    const noteNames = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];
    noteFreqs.forEach((freq, i) => {
      this.buffers.set(`piano_${noteNames[i]}`, this._createPianoNote(freq));
    });
  }

  /** Play a procedural sound by name */
  _playProcedural(name, volume) {
    // No-op if buffer doesn't exist
  }

  // ─── Sound Generators ───

  /** Balloon pop: short burst of noise with pitch drop */
  _createPop() {
    const duration = 0.15;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      const env = Math.exp(-t * 30);
      data[i] = (Math.random() * 2 - 1) * env * 0.5;
      // Add a pitched component
      data[i] += Math.sin(2 * Math.PI * 800 * t * (1 - t * 5)) * env * 0.3;
    }
    return buffer;
  }

  /** Fruit slice: short swoosh */
  _createSlice() {
    const duration = 0.2;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      const env = Math.exp(-t * 15) * Math.min(t * 50, 1);
      const freq = 2000 + t * 3000;  // Rising swoosh
      data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3;
      data[i] += (Math.random() * 2 - 1) * env * 0.15;  // Noise component
    }
    return buffer;
  }

  /** Bomb explosion: low rumble */
  _createBomb() {
    const duration = 0.4;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      const env = Math.exp(-t * 5);
      data[i] = (Math.random() * 2 - 1) * env * 0.6;
      data[i] += Math.sin(2 * Math.PI * 80 * t) * env * 0.4;
      data[i] += Math.sin(2 * Math.PI * 40 * t) * env * 0.3;
    }
    return buffer;
  }

  /** Coin collect: pleasant ding */
  _createCoin() {
    const duration = 0.3;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      const env = Math.exp(-t * 10);
      data[i] = Math.sin(2 * Math.PI * 1200 * t) * env * 0.3;
      data[i] += Math.sin(2 * Math.PI * 1800 * t) * env * 0.2;
    }
    return buffer;
  }

  /** Combo: ascending tones */
  _createCombo() {
    const duration = 0.4;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      const env = Math.exp(-t * 6);
      const freq = 600 + t * 1200;  // Ascending
      data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3;
      data[i] += Math.sin(2 * Math.PI * freq * 1.5 * t) * env * 0.15;
    }
    return buffer;
  }

  /** Simple beep at given frequency */
  _createBeep(freq, duration) {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      const env = Math.min(t * 100, 1) * Math.min((duration - t) * 100, 1);
      data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3;
    }
    return buffer;
  }

  /** Win fanfare: ascending major arpeggio */
  _createWin() {
    const duration = 0.8;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      const noteIdx = Math.min(Math.floor(t / (duration / notes.length)), notes.length - 1);
      const localT = t - noteIdx * (duration / notes.length);
      const env = Math.exp(-localT * 5) * 0.3;
      data[i] = Math.sin(2 * Math.PI * notes[noteIdx] * t) * env;
    }
    return buffer;
  }

  /** Lose sound: descending sad tones */
  _createLose() {
    const duration = 0.6;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      const env = Math.exp(-t * 4);
      const freq = 400 - t * 300;  // Descending
      data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3;
      data[i] += Math.sin(2 * Math.PI * freq * 0.5 * t) * env * 0.2;
    }
    return buffer;
  }

  /** Car crash: impact + crunch */
  _createCrash() {
    const duration = 0.5;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      const env = Math.exp(-t * 8);
      data[i] = (Math.random() * 2 - 1) * env * 0.5;
      data[i] += Math.sin(2 * Math.PI * 150 * t) * env * 0.3;
    }
    return buffer;
  }

  /** Game over: dramatic descending */
  _createGameOver() {
    const duration = 1.0;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      const env = Math.exp(-t * 2);
      const freq = 600 * Math.exp(-t * 2);
      data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3;
      data[i] += Math.sin(2 * Math.PI * freq * 0.75 * t) * env * 0.2;
      data[i] += (Math.random() * 2 - 1) * env * 0.1;
    }
    return buffer;
  }

  /** Engine hum: low frequency loop */
  _createEngine() {
    const duration = 0.5;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      data[i] = Math.sin(2 * Math.PI * 80 * t) * 0.15;
      data[i] += Math.sin(2 * Math.PI * 120 * t) * 0.1;
      data[i] += (Math.random() * 2 - 1) * 0.05;
    }
    return buffer;
  }

  /** Piano-like note with harmonics and decay */
  _createPianoNote(freq) {
    const duration = 1.5;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      const attack = Math.min(t * 200, 1);
      const decay = Math.exp(-t * 3);
      const env = attack * decay;
      // Fundamental + harmonics for richness
      data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.35;
      data[i] += Math.sin(2 * Math.PI * freq * 2 * t) * env * 0.15;
      data[i] += Math.sin(2 * Math.PI * freq * 3 * t) * env * 0.08;
      data[i] += Math.sin(2 * Math.PI * freq * 4 * t) * env * 0.04;
    }
    return buffer;
  }
}

export const audio = new AudioManager();
