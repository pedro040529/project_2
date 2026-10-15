import type { Participant } from "../entities/Participant";
import type { MinigameId, ParticipantId } from "./types";

export interface RankingEntry {
  participantId: ParticipantId;
  name: string;
  score: number;
  rank: number; // 1-based; empates comparten rank
}

export interface MinigameScoreLog {
  minigameId: MinigameId;
  participantId: ParticipantId;
  points: number;
  reason: string;
  timestamp: number;
}

/**
 * Única fuente de verdad del puntaje. Los minijuegos NUNCA tocan
 * participant.totalScore directamente: siempre pasan por award().
 * Esto es lo que permite testear puntuación y ranking de forma aislada.
 */
export class ScoreManager {
  private log: MinigameScoreLog[] = [];

  award(participant: Participant, points: number, reason: string, minigameId: MinigameId, now = Date.now()): number {
    const newTotal = participant.addPoints(points);
    this.log.push({ minigameId, participantId: participant.id, points, reason, timestamp: now });
    return newTotal;
  }

  getLog(minigameId?: MinigameId): MinigameScoreLog[] {
    return minigameId ? this.log.filter((l) => l.minigameId === minigameId) : [...this.log];
  }

  /** Ranking por puntaje TOTAL de la partida (para tabla entre minijuegos / final). */
  static rankByTotal(participants: Participant[]): RankingEntry[] {
    return ScoreManager.rank(participants, (p) => p.totalScore);
  }

  /** Ranking por puntaje del minijuego actual únicamente (para el podio de la ronda). */
  static rankByMinigame(participants: Participant[]): RankingEntry[] {
    return ScoreManager.rank(participants, (p) => p.minigameScore);
  }

  private static rank(participants: Participant[], scoreOf: (p: Participant) => number): RankingEntry[] {
    const sorted = [...participants].sort((a, b) => scoreOf(b) - scoreOf(a));
    const entries: RankingEntry[] = [];
    let lastScore: number | null = null;
    let lastRank = 0;
    sorted.forEach((p, idx) => {
      const score = scoreOf(p);
      const rank = score === lastScore ? lastRank : idx + 1;
      lastScore = score;
      lastRank = rank;
      entries.push({ participantId: p.id, name: p.name, score, rank });
    });
    return entries;
  }

  static winner(participants: Participant[]): Participant {
    return [...participants].sort((a, b) => b.totalScore - a.totalScore)[0];
  }

  reset(): void {
    this.log = [];
  }
}
