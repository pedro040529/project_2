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
import { NPC_AVATARS, buildHumanAvatar, type PlayerAvatarOption } from "../data/characters";
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
  disposeLobbyShowcase?: () => void;
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

  private buildParticipants(nickname: string, avatarOption: PlayerAvatarOption): Participant[] {
    const human = new Participant("human", buildHumanAvatar(avatarOption, nickname), "human");
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

  async runMatch(nickname: string, avatarOption: PlayerAvatarOption): Promise<void> {
    const { ui, audio } = this.deps;

    for (;;) {
      const participants = this.buildParticipants(nickname, avatarOption);
      const scoreManager = new ScoreManager();
      const scenarios = new ScenarioManager(makeSeed());
      const summary = new SummaryAccumulator();

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

      await ui.showRosterIntro(participants);
      this.deps.disposeLobbyShowcase?.();

      const order = Config.match.minigameOrder;
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

        const roundRanking = ScoreManager.rankByMinigame(participants);
        const totalRanking = ScoreManager.rankByTotal(participants);
        mg.dispose();
        this.currentMinigame = null;

        audio.stopMusic();
        audio.victory();
        await ui.showMinigameResults({
          minigameTitle: mg.title,
          roundRanking,
          totalRanking,
          colorOf: this.colorOf(participants),
          isLast: i === order.length - 1
        });
      }

      const finalRanking = ScoreManager.rankByTotal(participants);
      audio.victory();
      await ui.showFinalResults(finalRanking, this.colorOf(participants), summary.build());
      const action = await ui.showMatchSummary(summary.build());
      if (action !== "replay") break;
    }
  }
}
