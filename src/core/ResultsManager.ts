import type { MatchSummaryStats } from "./types";

/**
 * Acumula, durante toda la partida, las estadísticas del HUMANO (nunca de
 * los NPC) que alimentan la pantalla final "Tu partida". Cada minijuego la
 * recibe por referencia y llama a sus métodos cuando el humano toma una
 * decisión evaluable (recoger/evitar, destruir/ignorar, elegir bajo presión).
 */
export class SummaryAccumulator {
  private detectionsCorrect = 0;
  private detectionsTotal = 0;
  private categories = new Map<string, { correct: number; total: number }>();
  private pressureCorrect = 0;
  private pressureTotal = 0;

  recordDetection(correct: boolean, categoria: string): void {
    this.detectionsTotal++;
    if (correct) this.detectionsCorrect++;
    const bucket = this.categories.get(categoria) ?? { correct: 0, total: 0 };
    bucket.total++;
    if (correct) bucket.correct++;
    this.categories.set(categoria, bucket);
  }

  recordPressureDecision(quality: "buena" | "mala" | "neutra"): void {
    this.pressureTotal++;
    if (quality === "buena") this.pressureCorrect++;
  }

  build(): MatchSummaryStats {
    const categoryPerformance: MatchSummaryStats["categoryPerformance"] = {};
    for (const [k, v] of this.categories.entries()) categoryPerformance[k] = { ...v };
    return {
      detections: { correct: this.detectionsCorrect, total: this.detectionsTotal },
      categoryPerformance,
      pressureAccuracy: { correct: this.pressureCorrect, total: this.pressureTotal }
    };
  }
}
