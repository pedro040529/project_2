import * as THREE from "three";
import { Config } from "../core/Config";
import type { InputManager } from "./InputManager";
import { Settings } from "../core/Settings";

/** Cámara estable con giro explícito y posición física interpolada por CharacterRig. */
export class CameraRig {
  private yaw = -Math.PI / 2;
  private pitch = 0.3;
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

  /** Dirección en la que mira la cámara (yaw/pitch); la mira del centro apunta por aquí. */
  private viewDirection(): THREE.Vector3 {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(Math.sin(this.yaw) * cp, -Math.sin(this.pitch), Math.cos(this.yaw) * cp);
  }

  snapTo(targetPos: THREE.Vector3): void {
    this.placeCamera(this.computeDesiredPosition(targetPos));
    this.initialized = true;
  }

  /** Cámara al hombro: detrás y a la derecha del personaje, mirando hacia delante (no hacia él). */
  private computeDesiredPosition(targetPos: THREE.Vector3): THREE.Vector3 {
    const { followDistance, lookHeight, shoulderOffset } = Config.camera;
    const f = this.viewDirection();
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const anchor = new THREE.Vector3(targetPos.x, targetPos.y + lookHeight, targetPos.z);
    const pos = anchor.sub(f.multiplyScalar(followDistance)).add(right.multiplyScalar(shoulderOffset));
    pos.y = Math.max(0.7, pos.y);
    return pos;
  }

  private placeCamera(pos: THREE.Vector3): void {
    this.currentPos.copy(pos);
    this.camera.position.copy(pos);
    this.currentLook.copy(pos).addScaledVector(this.viewDirection(), 30);
    this.camera.lookAt(this.currentLook);
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
      this.yaw -= clampedDx * Config.camera.mouseSensitivity * Settings.get().mouseSensitivity;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + clampedDy * Config.camera.mouseSensitivity * Settings.get().mouseSensitivity,
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
    this.placeCamera(desired);
  }
}
