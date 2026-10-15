import * as THREE from "three";
import type { Participant } from "../entities/Participant";
import type { InputManager } from "../world/InputManager";
import type { LabelRenderer } from "../world/LabelRenderer";
import type { UIManager, InstructionsSpec } from "../core/UIManager";
import type { AudioManager } from "../audio/AudioManager";
import type { ScenarioManager } from "../core/ScenarioManager";
import type { ScoreManager } from "../core/ScoreManager";
import type { SummaryAccumulator } from "../core/ResultsManager";
import type { MinigameId } from "../core/types";

export interface MinigameContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  labelRenderer: LabelRenderer;
  input: InputManager;
  ui: UIManager;
  audio: AudioManager;
  scenarios: ScenarioManager;
  scoreManager: ScoreManager;
  summary: SummaryAccumulator;
  /** [human, nova, kiro, pixel] — siempre el mismo orden y las mismas instancias durante toda la partida. */
  participants: Participant[];
}

export interface IMinigame {
  readonly id: MinigameId;
  readonly title: string;

  /** Construye escena/física/UI del minijuego. Se llama al entrar a su instrucción (carga diferida). */
  load(ctx: MinigameContext): Promise<void>;

  getInstructions(): InstructionsSpec;

  /** Arranca el reloj de juego (después del countdown 3-2-1). */
  start(): void;

  /** Llamado una vez por frame mientras isFinished() sea false. */
  update(dt: number): void;

  isFinished(): boolean;

  /** Libera meshes/física/listeners y saca todo de ctx.scene. */
  dispose(): void;
}
