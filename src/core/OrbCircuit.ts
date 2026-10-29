/**
 * Lógica pura (sin three.js ni DOM) de la circulación del orbe de Bajo
 * Presión. Vive aparte del minijuego para poder probarla de forma aislada:
 *  - quién recibe el orbe después de cada pase (el humano vuelve a recibirlo
 *    con regularidad, ningún NPC lo acapara);
 *  - cuánta carga lleva el orbe y cuándo explota (independiente de si las
 *    respuestas fueron correctas o no).
 */

export interface OrbCircuitOptions {
  /** ids de los 4 participantes */
  ids: string[];
  humanId: string;
  /** máximo de NPC seguidos que pueden tener el orbe antes de que le toque al humano */
  maxNpcHolds?: number;
  /** probabilidad base de que el pase de un NPC vaya al humano */
  humanBias?: number;
  rand?: () => number;
}

export class OrbCircuit {
  private readonly ids: string[];
  private readonly humanId: string;
  private readonly maxNpcHolds: number;
  private readonly humanBias: number;
  private readonly rand: () => number;

  holderId: string;
  private previousHolderId: string | null = null;
  private npcHoldsSinceHuman = 0;

  constructor(opts: OrbCircuitOptions) {
    this.ids = opts.ids;
    this.humanId = opts.humanId;
    this.maxNpcHolds = opts.maxNpcHolds ?? 2;
    this.humanBias = opts.humanBias ?? 0.45;
    this.rand = opts.rand ?? Math.random;
    this.holderId = opts.humanId;
  }

  /** Elige a quién pasa el orbe quien lo tiene ahora. Nunca devuelve al mismo holder. */
  chooseNext(): string {
    const others = this.ids.filter((id) => id !== this.holderId);
    let next: string;
    if (this.holderId === this.humanId) {
      const pool = others.filter((id) => id !== this.previousHolderId);
      const list = pool.length > 0 ? pool : others;
      next = list[Math.floor(this.rand() * list.length)];
    } else if (this.npcHoldsSinceHuman >= this.maxNpcHolds - 1 || this.rand() < this.humanBias) {
      next = this.humanId;
    } else {
      const npcs = others.filter((id) => id !== this.humanId);
      const pool = npcs.filter((id) => id !== this.previousHolderId);
      const list = pool.length > 0 ? pool : npcs;
      next = list[Math.floor(this.rand() * list.length)];
    }
    return next;
  }

  /** Registra que el orbe llegó a `next` (llamar al terminar el vuelo). */
  arrive(next: string): void {
    this.previousHolderId = this.holderId;
    this.holderId = next;
    this.npcHoldsSinceHuman = next === this.humanId ? 0 : this.npcHoldsSinceHuman + 1;
  }

  /** Tras una explosión el orbe reaparece en alguien distinto del que explotó. */
  respawn(): string {
    const others = this.ids.filter((id) => id !== this.holderId);
    const next = others[Math.floor(this.rand() * others.length)];
    this.previousHolderId = null;
    this.holderId = next;
    this.npcHoldsSinceHuman = next === this.humanId ? 0 : this.npcHoldsSinceHuman + 1;
    return next;
  }
}

export type OrbStatus = "active" | "exploded" | "stabilized";

export interface OrbEnergyOptions {
  initial: number;
  max?: number;
}

/**
 * Energía del orbe (0..100 %). No depende del tiempo: solo cambia con las
 * decisiones. Al llegar a 100 explota; al llegar a 0 se estabiliza y termina
 * esa ronda. Quien lo cambia queda registrado para penalizar / premiar.
 */
export class OrbEnergy {
  private _value: number;
  private readonly initial: number;
  private readonly max: number;

  constructor(opts: OrbEnergyOptions) {
    this.initial = opts.initial;
    this.max = opts.max ?? 100;
    this._value = opts.initial;
  }

  get value(): number {
    return this._value;
  }

  get ratio(): number {
    return this._value / this.max;
  }

  get status(): OrbStatus {
    if (this._value >= this.max) return "exploded";
    if (this._value <= 0) return "stabilized";
    return "active";
  }

  /** Suma `delta` puntos porcentuales (negativo = enfría) y devuelve el nuevo estado. */
  apply(delta: number): OrbStatus {
    this._value = Math.min(this.max, Math.max(0, this._value + delta));
    return this.status;
  }

  reset(): void {
    this._value = this.initial;
  }
}
