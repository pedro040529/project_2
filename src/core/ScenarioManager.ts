import rewardsData from "../data/rewards.json";
import messagesData from "../data/messages.json";
import pressureData from "../data/pressureSituations.json";
import type { MessageDef, PressureSituationDef, RewardDef, ScenarioKind } from "./types";
import { mulberry32, shuffle } from "../utils/rng";

const REWARDS = rewardsData as RewardDef[];
const MESSAGES = messagesData as MessageDef[];
const PRESSURE = pressureData as PressureSituationDef[];

export interface MessageComposition {
  legitima: number;
  enganosa: number;
  ambigua: number;
}

/**
 * Dueño de todo el contenido de escenarios (pools JSON) y de cómo se
 * sortean subconjuntos por partida con composición controlada. Añadir más
 * situaciones a los JSON nunca requiere tocar esta clase ni los minijuegos.
 */
export class ScenarioManager {
  private rand: () => number;

  constructor(seed?: number) {
    this.rand = seed !== undefined ? mulberry32(seed) : Math.random;
  }

  reseed(seed: number): void {
    this.rand = mulberry32(seed);
  }

  // ---------- Rewards (Atrapa o Evita) ----------

  getAllRewards(): RewardDef[] {
    return REWARDS;
  }

  getRewardsByType(tipo: ScenarioKind): RewardDef[] {
    return REWARDS.filter((r) => r.tipo === tipo);
  }

  getRewardsByRareza(rareza: RewardDef["rareza"]): RewardDef[] {
    return REWARDS.filter((r) => r.rareza === rareza && r.tipo === "legitima");
  }

  drawReward(pool: RewardDef[]): RewardDef {
    if (pool.length === 0) throw new Error("ScenarioManager: pool de rewards vacío");
    return pool[Math.floor(this.rand() * pool.length)];
  }

  // ---------- Messages (Cazaengaños) ----------

  getAllMessages(): MessageDef[] {
    return MESSAGES;
  }

  /**
   * Sortea un subconjunto de mensajes para la partida con composición
   * controlada (ej: 4 legítimos, 5 engañosos, 3 ambiguos de un pool de 40)
   * para que ninguna partida sea "todo engañoso" ni se memoricen respuestas.
   * Intenta además variar categorías dentro de cada tipo.
   */
  drawMessageSet(composition: MessageComposition): MessageDef[] {
    const byType: Record<ScenarioKind, MessageDef[]> = {
      legitima: MESSAGES.filter((m) => m.tipo === "legitima"),
      enganosa: MESSAGES.filter((m) => m.tipo === "enganosa"),
      ambigua: MESSAGES.filter((m) => m.tipo === "ambigua")
    };

    const pickN = (list: MessageDef[], n: number): MessageDef[] => {
      if (n > list.length) {
        throw new Error(`ScenarioManager: se pidieron ${n} mensajes de tipo pero el pool solo tiene ${list.length}`);
      }
      return this.pickVariedByCategory(list, n);
    };

    const chosen = [
      ...pickN(byType.legitima, composition.legitima),
      ...pickN(byType.enganosa, composition.enganosa),
      ...pickN(byType.ambigua, composition.ambigua)
    ];

    return shuffle(chosen, this.rand);
  }

  /** Selecciona n elementos priorizando no repetir 'categoria' consecutiva/duplicada cuando es posible. */
  private pickVariedByCategory<T extends { categoria: string }>(list: T[], n: number): T[] {
    const shuffled = shuffle(list, this.rand);
    const byCategory = new Map<string, T[]>();
    for (const item of shuffled) {
      const arr = byCategory.get(item.categoria) ?? [];
      arr.push(item);
      byCategory.set(item.categoria, arr);
    }
    const categories = shuffle([...byCategory.keys()], this.rand);
    const result: T[] = [];
    let cursor = 0;
    while (result.length < n) {
      const cat = categories[cursor % categories.length];
      const bucket = byCategory.get(cat)!;
      if (bucket.length > 0) {
        result.push(bucket.shift()!);
      }
      cursor++;
      if (cursor > n * categories.length + list.length) break; // salvaguarda anti-loop
    }
    // relleno de emergencia si por algún motivo no se llegó a n (pools muy chicos)
    if (result.length < n) {
      for (const item of shuffled) {
        if (result.length >= n) break;
        if (!result.includes(item)) result.push(item);
      }
    }
    return result.slice(0, n);
  }

  // ---------- Pressure situations (Bajo Presión) ----------

  getAllPressureSituations(): PressureSituationDef[] {
    return PRESSURE;
  }

  /** Secuencia sorteada de situaciones para una partida, sin repetir hasta agotar el pool. */
  drawPressureSequence(count: number): PressureSituationDef[] {
    const shuffled = shuffle(PRESSURE, this.rand);
    const sequence: PressureSituationDef[] = [];
    while (sequence.length < count) {
      for (const s of shuffled) {
        if (sequence.length >= count) break;
        sequence.push(s);
      }
    }
    return sequence;
  }
}
