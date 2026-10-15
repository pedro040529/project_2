/**
 * Audio 100% sintetizado con Web Audio API (osciladores + ruido blanco
 * filtrado + envolventes). Cero dependencia de archivos de sonido de
 * terceros: nada que licenciar, nada que descargar, cero riesgo de bloqueo
 * de red — y sigue cubriendo cada evento pedido por el brief (recoger,
 * error, puntuación, disparo, destrucción, globo/bomba, cuenta regresiva,
 * explosión, transición, victoria) más una música ambiental generativa para
 * lobby y una pista dinámica más rítmica durante los minijuegos.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicNodes: { stop: () => void } | null = null;
  private _muted = false;

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.7;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.35;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Debe llamarse tras la primera interacción del usuario (autoplay policy). */
  unlock(): void {
    this.ensureCtx();
  }

  get muted(): boolean {
    return this._muted;
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    if (this.master) this.master.gain.value = this._muted ? 0 : 0.7;
    return this._muted;
  }

  // ---------------- SFX ----------------

  private tone(freq: number, duration: number, type: OscillatorType, gain = 0.5, glideTo?: number): void {
    const ctx = this.ensureCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), ctx.currentTime + duration);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  private noiseBurst(duration: number, gain = 0.4, filterFreq = 1200): void {
    const ctx = this.ensureCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain!);
    src.start();
  }

  pickupGood(): void {
    this.tone(520, 0.12, "triangle", 0.4, 880);
    setTimeout(() => this.tone(880, 0.14, "triangle", 0.35), 60);
  }

  pickupBad(): void {
    this.tone(220, 0.22, "sawtooth", 0.35, 110);
    this.noiseBurst(0.15, 0.15, 500);
  }

  scoreTick(): void {
    this.tone(660, 0.08, "square", 0.2);
  }

  shoot(): void {
    this.tone(900, 0.06, "square", 0.25, 300);
  }

  destroyTarget(good: boolean): void {
    if (good) {
      this.tone(700, 0.16, "triangle", 0.4, 1200);
      this.noiseBurst(0.08, 0.12, 3000);
    } else {
      this.tone(180, 0.24, "sawtooth", 0.35, 90);
      this.noiseBurst(0.18, 0.2, 400);
    }
  }

  balloonPass(): void {
    this.tone(440, 0.09, "sine", 0.3, 560);
  }

  countdownBeep(final = false): void {
    this.tone(final ? 880 : 520, final ? 0.3 : 0.12, "square", 0.4);
  }

  explosion(): void {
    this.noiseBurst(0.4, 0.5, 900);
    this.tone(90, 0.35, "sawtooth", 0.4, 40);
  }

  transition(): void {
    this.tone(300, 0.3, "sine", 0.3, 700);
  }

  victory(): void {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, "triangle", 0.4), i * 130));
  }

  uiClick(): void {
    this.tone(400, 0.05, "square", 0.18, 500);
  }

  // ---------------- Música generativa ----------------

  private startLoop(baseFreqs: number[], tempo: number, waveform: OscillatorType, gainScale: number): { stop: () => void } {
    const ctx = this.ensureCtx();
    let stepIndex = 0;
    let stopped = false;
    const step = () => {
      if (stopped) return;
      const freq = baseFreqs[stepIndex % baseFreqs.length];
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = waveform;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18 * gainScale, ctx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + tempo * 0.9);
      osc.connect(g);
      g.connect(this.musicGain!);
      osc.start();
      osc.stop(ctx.currentTime + tempo);
      stepIndex++;
      timeoutId = window.setTimeout(step, tempo * 1000);
    };
    let timeoutId = window.setTimeout(step, 0);
    return {
      stop: () => {
        stopped = true;
        window.clearTimeout(timeoutId);
      }
    };
  }

  playLobbyMusic(): void {
    this.stopMusic();
    this.musicNodes = this.startLoop([392, 440, 523.25, 440, 329.63, 392, 349.23, 440], 0.42, "sine", 0.8);
  }

  /**
   * Música de minijuego: más "competitiva" (lead + bajo + percusión suave,
   * no una sola línea de melodía sola) y con el ritmo pisando el acelerador
   * cerca del final — `getIntensity` (0..1) la llama cada compás.
   */
  playMinigameMusic(getIntensity?: () => number): void {
    this.stopMusic();
    this.musicNodes = this.startGameLoop(getIntensity ?? (() => 0));
  }

  private startGameLoop(getIntensity: () => number): { stop: () => void } {
    const ctx = this.ensureCtx();
    // patrón alegre tipo arcade, en Do mayor pentatónico — nada solemne
    const lead = [523.25, 659.25, 587.33, 783.99, 659.25, 523.25, 587.33, 440.0];
    const bass = [130.81, 130.81, 164.81, 196.0];
    let stepIndex = 0;
    let stopped = false;
    let timeoutId = 0;

    const BASE_TEMPO = 0.23;
    const MIN_TEMPO = 0.13;

    const step = () => {
      if (stopped) return;
      const intensity = Math.min(1, Math.max(0, getIntensity()));
      const tempo = BASE_TEMPO - (BASE_TEMPO - MIN_TEMPO) * intensity;

      const leadFreq = lead[stepIndex % lead.length];
      const oscL = ctx.createOscillator();
      const gL = ctx.createGain();
      oscL.type = "triangle";
      oscL.frequency.value = leadFreq;
      gL.gain.setValueAtTime(0.0001, ctx.currentTime);
      gL.gain.exponentialRampToValueAtTime(0.17, ctx.currentTime + 0.018);
      gL.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + tempo * 0.85);
      oscL.connect(gL);
      gL.connect(this.musicGain!);
      oscL.start();
      oscL.stop(ctx.currentTime + tempo);

      if (stepIndex % 2 === 0) {
        const bassFreq = bass[Math.floor(stepIndex / 2) % bass.length];
        const oscB = ctx.createOscillator();
        const gB = ctx.createGain();
        oscB.type = "square";
        oscB.frequency.value = bassFreq;
        gB.gain.setValueAtTime(0.0001, ctx.currentTime);
        gB.gain.exponentialRampToValueAtTime(0.13, ctx.currentTime + 0.02);
        gB.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + tempo * 1.7);
        oscB.connect(gB);
        gB.connect(this.musicGain!);
        oscB.start();
        oscB.stop(ctx.currentTime + tempo * 1.8);
      }

      // "hi-hat" suave: le da pulso de percusión sin necesitar samples
      this.noiseBurst(0.03, 0.05, 6000);

      stepIndex++;
      timeoutId = window.setTimeout(step, tempo * 1000);
    };
    timeoutId = window.setTimeout(step, 0);

    return {
      stop: () => {
        stopped = true;
        window.clearTimeout(timeoutId);
      }
    };
  }

  stopMusic(): void {
    this.musicNodes?.stop();
    this.musicNodes = null;
  }
}
