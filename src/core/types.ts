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

export type BodyColorId = "azul" | "rojo" | "verde" | "morado" | "rosa" | "amarillo" | "negro" | "blanco";
export type HeadAccessoryId = "none" | "cap" | "glasses" | "headphones" | "hood" | "hat";
export type ExtraAccessoryId = "none" | "scarf" | "cape" | "backpack";

/** Apariencia elegible de un Guardián Digital (la misma estructura para humano y bots). */
export interface Appearance {
  color: BodyColorId;
  head: HeadAccessoryId;
  extra: ExtraAccessoryId;
}

export interface AvatarDef {
  id: ParticipantId;
  name: string;
  appearance: Appearance;
  /** color del casco/cuerpo (derivado de la apariencia; se usa también en HUD y podio) */
  primaryColor: number;
  /** color de acentos y brillo del visor */
  accentColor: number;
  tagline: string;
  traits: NpcTraits | null; // null para el humano (no aplica IA)
}

export type CategoryId =
  | "datos_personales"
  | "interacciones_seguras"
  | "suplantacion"
  | "intercambios_recompensas"
  | "anuncios_fuentes"
  | "enlaces_externos"
  | "presion_de_grupo"
  | "contrasenas_acceso"
  | "convivencia_digital";

/** Campos comunes del banco educativo (72 situaciones, v2.1). Las categorías son internas: no se muestran antes de responder. */
interface SituationBase {
  /** ID estable (AT-01, CA-07, BP-12…). No reutilizar ni renumerar. */
  id: string;
  /** 1 fácil, 2 intermedio, 3 difícil. No multiplica puntos. */
  dificultad: 1 | 2 | 3;
  categoria: CategoryId;
  remitente: string;
}

/** Atrapa o evita: un mensaje flotante que se recoge (acción correcta "recoger") o se evita. */
export interface AtrapaSituation extends SituationBase {
  contexto: string;
  texto: string;
  accionCorrecta: "recoger" | "evitar";
}

/** Cazaengaños: una publicación-objetivo que se dispara o se deja pasar. */
export interface CazaSituation extends SituationBase {
  /** procedencia visible (p. ej. "Oficial verificado", "No verificado") */
  contexto: string;
  texto: string;
  accionCorrecta: "disparar" | "no_disparar";
  /** Requiere revisión editorial: se conserva en los datos pero NO entra al juego. */
  pendienteRevision?: boolean;
}

export type OptionId = "A" | "B" | "C";

/** Bajo Presión: pregunta con tres opciones y una sola correcta. */
export interface BajoPresionSituation extends SituationBase {
  pregunta: string;
  opciones: { id: OptionId; texto: string }[];
  correcta: OptionId;
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
