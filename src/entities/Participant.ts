import type { AvatarDef, ControllerKind, ParticipantId } from "../core/types";

export type ParticipantState = "idle" | "running" | "celebrating" | "losing" | "deciding" | "acting";

/**
 * Representa a uno de los 4 competidores (humano o NPC) de forma agnóstica
 * al controlador que lo mueve y al minijuego que lo esté usando.
 */
export class Participant {
  readonly id: ParticipantId;
  readonly name: string;
  readonly avatar: AvatarDef;
  readonly controllerKind: ControllerKind;

  totalScore = 0;
  minigameScore = 0;

  position: [number, number, number] = [0, 0, 0];
  heading = 0; // radianes, Y-up
  state: ParticipantState = "idle";

  constructor(id: ParticipantId, avatar: AvatarDef, controllerKind: ControllerKind) {
    this.id = id;
    this.name = avatar.name;
    this.avatar = avatar;
    this.controllerKind = controllerKind;
  }

  resetForNewMinigame(): void {
    this.minigameScore = 0;
    this.state = "idle";
  }

  addPoints(points: number): number {
    this.minigameScore += points;
    this.totalScore += points;
    return this.minigameScore;
  }

  setPosition(x: number, y: number, z: number): void {
    this.position = [x, y, z];
  }
}
