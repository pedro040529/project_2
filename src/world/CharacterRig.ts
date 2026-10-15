import * as THREE from "three";
import { Participant } from "../entities/Participant";
import type { IController } from "../entities/controllers/IController";
import { CraftCharacter, createCraftCharacter } from "./CharacterFactory";
import type { PhysicsWorld } from "./PhysicsWorld";
import { Config } from "../core/Config";

/**
 * Une Participant (datos) + IController (decisión de movimiento) +
 * CraftCharacter (mesh + animación) + PhysicsWorld (integración). Es lo que
 * permite que un mismo Participant se comporte igual sin importar el
 * minijuego que lo esté usando.
 */
export class CharacterRig {
  readonly character: CraftCharacter;
  private currentHeading = 0;
  private lastSpeed01 = 0;
  private aimTime = 0;
  /** Con el movimiento bloqueado el personaje se queda en su puesto (Bajo Presión). */
  movementLocked = false;

  faceTarget(target: THREE.Vector3, duration = 0.35): void {
    this.currentHeading = Math.atan2(target.x - this.root.position.x, target.z - this.root.position.z);
    this.aimTime = duration;
    this.character.setHeading(this.currentHeading);
    this.participant.heading = this.currentHeading;
  }

  constructor(
    readonly participant: Participant,
    readonly controller: IController,
    private physics: PhysicsWorld,
    private maxSpeed: number
  ) {
    this.character = createCraftCharacter(participant.avatar);
    physics.addCharacterBody(participant.id);
  }

  get root(): THREE.Group {
    return this.character.root;
  }

  setSpawn(x: number, z: number): void {
    const body = this.physics.getBody(this.participant.id);
    if (body) {
      body.position.set(x, 0.38, z);
      body.velocity.set(0, 0, 0);
      body.previousPosition.copy(body.position);
      body.interpolatedPosition.copy(body.position);
    }
    this.character.root.position.set(x, 0, z);
    this.participant.setPosition(x, 0, z);
  }

  /** Mira hacia un punto y conserva ese rumbo mientras está quieto. */
  lookAt(target: THREE.Vector3): void {
    this.currentHeading = Math.atan2(target.x - this.root.position.x, target.z - this.root.position.z);
    this.character.setHeading(this.currentHeading);
    this.participant.heading = this.currentHeading;
  }

  /** Llamar antes de physics.step(): traduce la decisión del controlador en velocidad física. */
  preStep(dt: number): void {
    this.controller.update(dt);
    const { x, z } = this.movementLocked ? { x: 0, z: 0 } : this.controller.moveIntent;
    const speedScale = this.controller.kind === "ai" ? 1 : 1;
    this.physics.driveVelocity(this.participant.id, x, z, this.maxSpeed * speedScale);
    void speedScale;
  }

  /** Llamar después de physics.step(): sincroniza visual + anima + orienta. */
  postStep(dt: number): void {
    const body = this.physics.getBody(this.participant.id);
    if (!body) return;
    this.character.root.position.set(body.interpolatedPosition.x, 0, body.interpolatedPosition.z);
    this.participant.setPosition(body.interpolatedPosition.x, 0, body.interpolatedPosition.z);

    const vx = body.velocity.x;
    const vz = body.velocity.z;
    const speed = Math.hypot(vx, vz);
    const speed01 = THREE.MathUtils.clamp(speed / this.maxSpeed, 0, 1);
    this.lastSpeed01 = THREE.MathUtils.lerp(this.lastSpeed01, speed01, 1 - Math.exp(-14 * dt));

    if (speed > 0.35) {
      const targetHeading = Math.atan2(vx, vz);
      if (this.aimTime <= 0) this.currentHeading = smoothAngle(this.currentHeading, targetHeading, 1 - Math.exp(-dt * Config.player.turnSmoothing));
      this.character.setHeading(this.currentHeading);
      this.participant.heading = this.currentHeading;
      if (this.participant.state === "idle") this.participant.state = "running";
    } else if (this.participant.state === "running") {
      this.participant.state = "idle";
    }

    this.aimTime = Math.max(0, this.aimTime - dt);
    this.character.update(dt, this.lastSpeed01, this.participant.state);
  }

  dispose(): void {
    this.character.root.removeFromParent();
  }
}

function smoothAngle(current: number, target: number, t: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * THREE.MathUtils.clamp(t, 0, 1);
}
