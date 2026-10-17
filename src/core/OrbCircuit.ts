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

export interface OrbChargeOptions {
  minFuseSeconds?: number;
  maxFuseSeconds?: number;
  rand?: () => number;
}

/** Carga 0..1 del orbe. Solo sube con el tiempo; decisiones buenas pueden estabilizarlo un poco. */
export class OrbCharge {
  private readonly minFuse: number;
  private readonly maxFuse: number;
  private readonly rand: () => number;
  private fuse: number;
  private elapsed = 0;

  constructor(opts: OrbChargeOptions = {}) {
    this.minFuse = opts.minFuseSeconds ?? 13;
    this.maxFuse = opts.maxFuseSeconds ?? 22;
    this.rand = opts.rand ?? Math.random;
    this.fuse = this.rollFuse();
  }

  private rollFuse(): number {
    return this.minFuse + this.rand() * (this.maxFuse - this.minFuse);
  }

  get value(): number {
    return Math.min(1, this.elapsed / this.fuse);
  }

  get exploded(): boolean {
    return this.elapsed >= this.fuse;
  }

  tick(dt: number): void {
    this.elapsed += dt;
  }

  /** Una buena decisión baja la carga (ventaja); nunca provoca ni evita por sí sola una explosión inminente. */
  stabilize(fraction: number): void {
    this.elapsed = Math.max(0, this.elapsed - this.fuse * fraction);
  }

  reset(): void {
    this.elapsed = 0;
    this.fuse = this.rollFuse();
  }
}
