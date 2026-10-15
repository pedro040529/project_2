import * as THREE from "three";
import type { IController, MoveIntent } from "./IController";
import type { NpcTraits } from "../../core/types";

/**
 * Controlador de NPC: NO decide qué hacer (eso lo decide cada minijuego,
 * leyendo `traits` para simular reacción/precisión/riesgo), solo convierte
 * "quiero ir a este punto" en movimiento físico creíble. Así el mismo
 * controlador sirve para los 3 minijuegos.
 */
export class AIController implements IController {
  readonly kind = "ai" as const;
  readonly moveIntent: MoveIntent = { x: 0, z: 0 };

  private target: THREE.Vector3 | null = null;
  private wanderTarget = new THREE.Vector3();
  private wanderTimer = 0;
  private arrivalRadius = 0.5;

  constructor(
    readonly traits: NpcTraits,
    private getPosition: () => THREE.Vector3,
    private arenaRadius: number
  ) {
    this.pickWanderPoint();
  }

  /** El minijuego fija (o limpia con null) hacia dónde quiere que corra el NPC. */
  setTarget(point: THREE.Vector3 | null, arrivalRadius = 0.5): void {
    this.target = point;
    this.arrivalRadius = arrivalRadius;
  }

  hasTarget(): boolean {
    return this.target !== null;
  }

  distanceToTarget(): number {
    if (!this.target) return Infinity;
    return this.getPosition().distanceTo(this.target);
  }

  hasArrived(): boolean {
    return this.distanceToTarget() <= this.arrivalRadius;
  }

  private pickWanderPoint(): void {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * this.arenaRadius * 0.55;
    this.wanderTarget.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    this.wanderTimer = 2 + Math.random() * 2.5;
  }

  update(dt: number): void {
    const pos = this.getPosition();
    let goal: THREE.Vector3;

    if (this.target && this.hasArrived()) {
      this.moveIntent.x = this.moveIntent.z = 0;
      return;
    }
    if (this.target && this.distanceToTarget() > this.arrivalRadius) {
      goal = this.target;
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0 || pos.distanceTo(this.wanderTarget) < 0.8) {
        this.pickWanderPoint();
      }
      goal = this.wanderTarget;
    }

    const dir = new THREE.Vector3(goal.x - pos.x, 0, goal.z - pos.z);
    const dist = dir.length();
    if (dist < 0.05) {
      this.moveIntent.x = 0;
      this.moveIntent.z = 0;
      return;
    }
    dir.normalize();
    // frena un poco al acercarse al objetivo real (no al wander) para no "vibrar" sobre el punto
    const speedScale = this.target ? Math.min(1, dist / 0.6) : 1;
    this.moveIntent.x = dir.x * speedScale;
    this.moveIntent.z = dir.z * speedScale;
  }
}
