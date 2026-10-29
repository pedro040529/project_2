import * as THREE from "three";
import { Config } from "./Config";
import { ScoreManager } from "./ScoreManager";
import { ScenarioManager } from "./ScenarioManager";
import { SummaryAccumulator } from "./ResultsManager";
import { UIManager } from "./UIManager";
import type { AudioManager } from "../audio/AudioManager";
import type { InputManager } from "../world/InputManager";
import type { LabelRenderer } from "../world/LabelRenderer";
import { Participant } from "../entities/Participant";
import { NPC_AVATARS, buildHumanAvatar } from "../data/characters";
import type { PlayerProfile } from "./Profile";
import { PodiumStage, RosterStage, type Stage } from "../world/Stages";
import { MinigameManager } from "../minigames/MinigameManager";
import type { IMinigame, MinigameContext } from "../minigames/IMinigame";
import { makeSeed } from "../utils/rng";

export interface MatchDeps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  labelRenderer: LabelRenderer;
  input: InputManager;
  ui: UIManager;
  audio: AudioManager;
  /** Cambia el escenario 3D de fondo de los menús (null = ninguno, p. ej. durante un minijuego). */
  setStage: (stage: Stage | null) => void;
}

/**
 * Dueño del flujo completo de una sesión de juego: crea a los 4
 * Participants, recorre los 3 minijuegos en orden, muestra resultados
 * intermedios y finales, y vuelve a jugar si el jugador lo pide — todo
 * sobre la misma arquitectura, sin "tres demos separadas".
 */
export class MatchManager {
  private minigameManager = new MinigameManager();
  private currentMinigame: IMinigame | null = null;
  private playing = false;

  constructor(private deps: MatchDeps) {}

  /** Llamado una vez por frame por GameManager mientras haya un minijuego activo. */
  frame(dt: number): void {
    if (this.playing && this.currentMinigame) {
      this.currentMinigame.update(dt);
    }
  }

  private colorOf(participants: Participant[]) {
    return (id: string) => participants.find((p) => p.id === id)!.avatar.primaryColor;
  }

  private buildParticipants(profile: PlayerProfile): Participant[] {
    const human = new Participant("human", buildHumanAvatar(profile.appearance, profile.nickname), "human");
    const nova = new Participant("nova", NPC_AVATARS.nova, "ai");
    const kiro = new Participant("kiro", NPC_AVATARS.kiro, "ai");
    const pixel = new Participant("pixel", NPC_AVATARS.pixel, "ai");
    return [human, nova, kiro, pixel];
  }

  private waitForFinish(mg: IMinigame): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (mg.isFinished()) resolve();
        else requestAnimationFrame(check);
      };
      check();
    });
  }

  /** Una competencia completa (3 desafíos en orden fijo). Devuelve cuando el jugador vuelve al menú. */
  async runMatch(profile: PlayerProfile): Promise<"menu"> {
    const { ui, audio } = this.deps;

    for (;;) {
      // Todo se crea de nuevo en cada competencia: ningún puntaje ni estadística se arrastra.
      const participants = this.buildParticipants(profile);
      const scoreManager = new ScoreManager();
      const scenarios = new ScenarioManager(makeSeed());
      const summary = new SummaryAccumulator();
      const avatars = new Map(participants.map((p) => [p.id, p.avatar]));
      const order = Config.match.minigameOrder;

      const ctx: MinigameContext = {
        scene: this.deps.scene,
        camera: this.deps.camera,
        renderer: this.deps.renderer,
        labelRenderer: this.deps.labelRenderer,
        input: this.deps.input,
        ui,
        audio,
        scenarios,
        scoreManager,
        summary,
        participants
      };

      // Presentación de participantes
      this.deps.setStage(new RosterStage(this.deps.scene, this.deps.camera, this.deps.labelRenderer, participants));
      await ui.showRosterIntro();
      this.deps.setStage(null);

      for (let i = 0; i < order.length; i++) {
        const id = order[i];
        participants.forEach((p) => p.resetForNewMinigame());

        const mg = this.minigameManager.create(id);
        await ui.showInstructions(mg.getInstructions());
        await mg.load(ctx);
        audio.transition();
        mg.start();

        this.currentMinigame = mg;
        this.playing = true;
        await this.waitForFinish(mg);
        this.playing = false;
        mg.dispose();
        this.currentMinigame = null;
        audio.stopMusic();
        audio.victory();

        // Podio y tabla salen de la MISMA clasificación calculada una sola vez.
        const round = ScoreManager.rankByMinigame(participants);
        const totals = new Map(participants.map((p) => [p.id, p.totalScore]));
        this.deps.setStage(new PodiumStage(this.deps.scene, this.deps.camera, this.deps.labelRenderer, round, avatars, false, 0.42));
        await ui.showMinigameResults({
          step: i + 1,
          minigameTitle: mg.title,
          round,
          totals,
          humanId: "human",
          isLast: i === order.length - 1
        });
        this.deps.setStage(null);
      }

      const ranking = ScoreManager.rankByTotal(participants);
      audio.victory();
      this.deps.setStage(new PodiumStage(this.deps.scene, this.deps.camera, this.deps.labelRenderer, ranking, avatars, true, 0.5));
      const action = await ui.showFinalResults({
        ranking,
        perMinigame: scoreManager.perMinigame(participants, order),
        humanId: "human",
        stats: summary.build()
      });
      this.deps.setStage(null);
      if (action === "menu") return "menu";
    }
  }
}
