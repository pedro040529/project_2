import atrapaData from "../data/atrapaSituations.json";
import cazaData from "../data/cazaSituations.json";
import bajoData from "../data/bajoPresionSituations.json";
import type { AtrapaSituation, BajoPresionSituation, CazaSituation } from "./types";
import { mulberry32, shuffle } from "../utils/rng";

const ATRAPA = atrapaData as AtrapaSituation[];
const CAZA_ALL = cazaData as CazaSituation[];
const BAJO = bajoData as BajoPresionSituation[];

/**
 * Mazo barajado: reparte todas las situaciones antes de repetir cualquiera
 * (evita repetir un mismo objetivo mientras queden otros) y, al agotarse,
 * vuelve a barajar sin que la primera repita la última.
 */
export class Deck<T> {
  private order: T[] = [];
  private cursor = 0;
  private last: T | null = null;

  constructor(
    private items: T[],
    private rand: () => number
  ) {
    if (items.length === 0) throw new Error("Deck: sin elementos");
    this.reshuffle();
  }

  private reshuffle(): void {
    this.order = shuffle(this.items, this.rand);
    if (this.items.length > 1 && this.order[0] === this.last) {
      [this.order[0], this.order[1]] = [this.order[1], this.order[0]];
    }
    this.cursor = 0;
  }

  draw(): T {
    if (this.cursor >= this.order.length) this.reshuffle();
    const item = this.order[this.cursor++];
    this.last = item;
    return item;
  }

  get size(): number {
    return this.items.length;
  }
}

/**
 * Dueño del contenido educativo (banco de 72 situaciones) y de cómo se reparte
 * en cada partida. Añadir situaciones a los JSON no requiere tocar esta clase
 * ni los minijuegos. Las situaciones marcadas `pendienteRevision` se conservan
 * en los datos pero no entran al juego.
 */
export class ScenarioManager {
  private rand: () => number;

  constructor(seed?: number) {
    this.rand = seed !== undefined ? mulberry32(seed) : Math.random;
  }

  reseed(seed: number): void {
    this.rand = mulberry32(seed);
  }

  getAtrapaSituations(): AtrapaSituation[] {
    return ATRAPA;
  }

  /** Todas las del banco, incluidas las pendientes de revisión. */
  getAllCazaSituations(): CazaSituation[] {
    return CAZA_ALL;
  }

  /** Solo las aprobadas para jugar. */
  getCazaSituations(): CazaSituation[] {
    return CAZA_ALL.filter((s) => !s.pendienteRevision);
  }

  getBajoPresionSituations(): BajoPresionSituation[] {
    return BAJO;
  }

  atrapaDeck(): Deck<AtrapaSituation> {
    return new Deck(ATRAPA, this.rand);
  }

  cazaDeck(): Deck<CazaSituation> {
    return new Deck(this.getCazaSituations(), this.rand);
  }

  bajoPresionDeck(): Deck<BajoPresionSituation> {
    return new Deck(BAJO, this.rand);
  }
}
