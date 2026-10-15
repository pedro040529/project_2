import * as THREE from "three";
import { Config } from "../core/Config";
import type { InputManager } from "./InputManager";

/** Cámara estable con giro explícito y posición física interpolada por CharacterRig. */
export class CameraRig {
  private yaw = -Math.PI / 2;
  private pitch = 0.55;
  private currentPos = new THREE.Vector3();
  private currentLook = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private initialized = false;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: InputManager
  ) {}

  getYaw(): number {
    return this.yaw;
  }

  snapTo(targetPos: THREE.Vector3): void {
    const desired = this.computeDesiredPosition(targetPos);
    this.currentPos.copy(desired);
    this.currentLook.set(targetPos.x, targetPos.y + Config.camera.lookHeight, targetPos.z);
    this.camera.position.copy(desired);
    this.camera.lookAt(this.currentLook);
    this.initialized = true;
  }

  private computeDesiredPosition(targetPos: THREE.Vector3): THREE.Vector3 {
    const { followDistance, followHeight } = Config.camera;
    const horizontalDist = Math.cos(this.pitch) * followDistance;
    const height = followHeight + Math.sin(this.pitch) * followDistance * 0.7;
    return new THREE.Vector3(
      targetPos.x - Math.sin(this.yaw) * horizontalDist,
      targetPos.y + height,
      targetPos.z - Math.cos(this.yaw) * horizontalDist
    );
  }

  update(
    dt: number,
    targetPos: THREE.Vector3,
    obstacles: THREE.Object3D[] = [],
    autoFollow?: { heading: number; active: boolean } | null
  ): void {
    const { dx, dy } = this.input.consumeMouseDelta();
    if (dx !== 0 || dy !== 0) {
      // clamp por frame: un salto grande de un solo frame (stutter, cambio
      // de pestaña, etc.) no debe girar la cámara de golpe.
      const clampedDx = THREE.MathUtils.clamp(dx, -80, 80);
      const clampedDy = THREE.MathUtils.clamp(dy, -80, 80);
      this.yaw -= clampedDx * Config.camera.mouseSensitivity;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - clampedDy * Config.camera.mouseSensitivity,
        Config.camera.minPitch,
        Config.camera.maxPitch
      );
    }

    void autoFollow; // El rumbo solo cambia por una acción explícita del jugador.

    let desired = this.computeDesiredPosition(targetPos);

    if (obstacles.length > 0) {
      const from = new THREE.Vector3(targetPos.x, targetPos.y + Config.camera.lookHeight, targetPos.z);
      const toDesired = desired.clone().sub(from);
      const dist = toDesired.length();
      if (dist > 0.001) {
        this.raycaster.set(from, toDesired.normalize());
        this.raycaster.far = dist;
        const hits = this.raycaster.intersectObjects(obstacles, true);
        if (hits.length > 0 && hits[0].distance < dist) {
          desired = from.clone().add(toDesired.multiplyScalar(Math.max(1.2, hits[0].distance - 0.3)));
        }
      }
    }

    if (!this.initialized) {
      this.snapTo(targetPos);
      return;
    }

    // Sin arrastre orbital ni desplazamiento residual después de soltar el mouse.
    this.currentPos.copy(desired);
    this.currentLook.set(targetPos.x, targetPos.y + Config.camera.lookHeight, targetPos.z);

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
  }
}
