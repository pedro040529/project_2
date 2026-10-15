// Tipos compartidos de todo el juego. Mantenerlos aquí evita dependencias
// cruzadas entre managers y minijuegos.

export type ParticipantId = "human" | "nova" | "kiro" | "pixel";

export type ControllerKind = "human" | "ai" | "network";

export interface NpcTraits {
  /** unidades / s en el plano XZ */
  movementSpeed: number;
  /** segundos que tarda en reaccionar a un evento nuevo del mundo */
  reactionTime: number;
  /** 0..1 probabilidad de tomar la decisión / acción correcta cuando reacciona */
  accuracy: number;
  /** 0..1 qué tan dispuesto está a ir por recompensas grandes/ambiguas */
  riskTolerance: number;
  /** segundos que tarda en decidir una acción bajo presión (minijuego 3) */
  decisionDelay: number;
}

export interface AvatarDef {
  id: ParticipantId;
  name: string;
  /** color primario del "fieltro" del cuerpo */
  primaryColor: number;
  /** color secundario (acentos, remaches, costuras) */
  accentColor: number;
  /** rasgo de silueta: forma del tocado/orejas para distinguir a distancia */
  silhouette: "mohawk" | "ears" | "antenna" | "cap";
  tagline: string;
  traits: NpcTraits | null; // null para el humano (no aplica IA)
}

export type ScenarioKind = "legitima" | "ambigua" | "enganosa";

export interface RewardDef {
  scenarioID: string;
  tipo: ScenarioKind;
  nombre: string;
  texto: string;
  contexto: string;
  senales: string[];
  /** acción objetivamente correcta, incluso para las ambiguas (siempre hay una señal suficiente) */
  accionEsperada: "recoger" | "evitar";
  explicacion: string;
  dificultad: 1 | 2 | 3;
  categoria: string;
  puntosBase: number; // referencia; el valor real final viene de Config
  rareza: "pequena" | "especial" | "rara";
}

export interface MessageDef {
  scenarioID: string;
  tipo: ScenarioKind;
  autor: string;
  texto: string;
  contexto: string;
  senales: string[];
  accionEsperada: "destruir" | "ignorar";
  explicacion: string;
  dificultad: 1 | 2 | 3;
  categoria: string;
}

export interface PressureOption {
  id: string;
  texto: string;
  calidad: "buena" | "mala" | "neutra";
}

export interface PressureSituationDef {
  scenarioID: string;
  tipo: ScenarioKind;
  texto: string;
  contexto: string;
  senales: string[];
  opciones: PressureOption[];
  explicacion: string;
  dificultad: 1 | 2 | 3;
  categoria: string;
}

export interface MinigameResultEntry {
  participantId: ParticipantId;
  pointsEarned: number;
  correctCalls: number;
  incorrectCalls: number;
}

export type MinigameId = "atrapa_o_evita" | "cazaenganos" | "bajo_presion";

export interface MatchSummaryStats {
  detections: { correct: number; total: number };
  categoryPerformance: Record<string, { correct: number; total: number }>;
  pressureAccuracy: { correct: number; total: number };
}
