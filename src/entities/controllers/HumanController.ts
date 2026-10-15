import * as THREE from "three";
import type { IController, MoveIntent } from "./IController";
import type { InputManager } from "../../world/InputManager";

/**
 * Traduce WASD/flechas (relativo a hacia dónde mira la cámara) + mouse/click
 * a un MoveIntent y a eventos de disparo/interacción que los minijuegos
 * consumen explícitamente (consumeClick/consumeInteract), en vez de leer el
 * teclado directamente.
 *
 * Convención de ejes (coincide con Matrix4.lookAt de three.js, que es lo
 * que camera.lookAt usa internamente):
 *   forward = (sin(yaw), 0, cos(yaw))            // hacia donde mira la cámara
 *   right   = cross(forward, up)                 // derecha DE PANTALLA
 *           = (sin(yaw - PI/2), 0, cos(yaw - PI/2))
 * Usar "yaw + PI/2" en vez de "yaw - PI/2" da el vector opuesto: eso fue el
 * bug de A/D invertidos (izquierda↔derecha) — ver tests/directionalControls.
 */
export class HumanController implements IController {
  readonly kind = "human" as const;
  readonly moveIntent: MoveIntent = { x: 0, z: 0 };

  constructor(
    private input: InputManager,
    private getCameraYaw: () => number
  ) {}

  update(_dt: number): void {
    const axes = this.input.readMoveAxes();
    if (axes.x === 0 && axes.y === 0) {
      this.moveIntent.x = 0;
      this.moveIntent.z = 0;
      return;
    }
    const yaw = this.getCameraYaw();
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.sin(yaw - Math.PI / 2), 0, Math.cos(yaw - Math.PI / 2));
    const dir = forward.multiplyScalar(axes.y).add(right.multiplyScalar(axes.x));
    if (dir.lengthSq() > 0) dir.normalize();
    this.moveIntent.x = dir.x;
    this.moveIntent.z = dir.z;
  }

  consumeClick(): boolean {
    return this.input.consumeClick();
  }

  consumeInteract(): boolean {
    return this.input.consumeInteract();
  }

  consumeNumberKey(): 1 | 2 | 3 | null {
    return this.input.consumeNumberKey();
  }

  /**
   * Rayo de apuntado desde la posición REAL del cursor del mouse (visible,
   * sin necesitar pointer lock). Si nunca hubo movimiento de mouse (o el
   * pointer lock está activo como mejora opcional), apunta al centro.
   */
  getAimRay(camera: THREE.Camera): THREE.Ray {
    const ndc = this.input.getMouseNDC();
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
    return raycaster.ray;
  }
}
