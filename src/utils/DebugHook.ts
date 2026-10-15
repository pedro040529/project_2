import * as THREE from "three";

/**
 * Hook de solo-lectura para verificación automatizada (Playwright) y para
 * depuración manual. No permite mutar nada del juego — solo expone
 * posiciones ya calculadas. Se reasigna en cada minijuego (ArenaRuntime) y
 * se apoya en GameManager para cámara/renderer, que sí persisten.
 */
export interface DebugParticipantsSource {
  getWorldPos(id: string): THREE.Vector3 | null;
  listIds(): string[];
}

class DebugHookImpl {
  camera: THREE.Camera | null = null;
  renderer: THREE.WebGLRenderer | null = null;
  private source: DebugParticipantsSource | null = null;
  private frozenSnapshots = new Map<
    string,
    { viewMatrix: THREE.Matrix4; projMatrix: THREE.Matrix4; rect: { left: number; top: number; width: number; height: number } }
  >();

  setCameraAndRenderer(camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    this.camera = camera;
    this.renderer = renderer;
  }

  setParticipantsSource(source: DebugParticipantsSource | null): void {
    this.source = source;
  }

  listParticipantIds(): string[] {
    return this.source?.listIds() ?? [];
  }

  getWorldPos(id: string): { x: number; y: number; z: number } | null {
    const v = this.source?.getWorldPos(id);
    return v ? { x: v.x, y: v.y, z: v.z } : null;
  }

  /** Proyecta la posición mundial de un participante a coordenadas de PANTALLA (píxeles CSS). */
  getScreenPos(id: string): { x: number; y: number } | null {
    if (!this.camera || !this.renderer) return null;
    const world = this.source?.getWorldPos(id);
    if (!world) return null;
    const v = world.clone().add(new THREE.Vector3(0, 1, 0)).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + ((v.x + 1) / 2) * rect.width,
      y: rect.top + ((-v.y + 1) / 2) * rect.height
    };
  }

  /**
   * Congela las matrices de la cámara EN ESTE INSTANTE bajo `token`. Como la
   * cámara del juego sigue al personaje cada frame (lookAt inmediato), medir
   * la posición en pantalla del propio personaje contra la cámara EN VIVO
   * siempre da ~el centro (se re-centra solo). Para verificar de verdad
   * "A mueve a la izquierda en pantalla" hace falta proyectar el antes/después
   * contra UNA MISMA cámara fija — de ahí este snapshot.
   */
  snapshotCamera(token: string): boolean {
    if (!this.camera || !this.renderer) return false;
    (this.camera as THREE.PerspectiveCamera).updateMatrixWorld(true);
    const viewMatrix = this.camera.matrixWorldInverse.clone();
    const projMatrix = (this.camera as THREE.PerspectiveCamera).projectionMatrix.clone();
    const r = this.renderer.domElement.getBoundingClientRect();
    this.frozenSnapshots.set(token, {
      viewMatrix,
      projMatrix,
      rect: { left: r.left, top: r.top, width: r.width, height: r.height }
    });
    return true;
  }

  /** Proyecta la posición ACTUAL de `id` contra la cámara congelada en `token` (no la cámara en vivo). */
  getScreenPosFrozen(id: string, token: string): { x: number; y: number } | null {
    const snap = this.frozenSnapshots.get(token);
    const world = this.source?.getWorldPos(id);
    if (!snap || !world) return null;
    const v = world.clone().add(new THREE.Vector3(0, 1, 0));
    v.applyMatrix4(snap.viewMatrix).applyMatrix4(snap.projMatrix);
    return {
      x: snap.rect.left + ((v.x + 1) / 2) * snap.rect.width,
      y: snap.rect.top + ((-v.y + 1) / 2) * snap.rect.height
    };
  }

  getCameraYaw(): number | null {
    // expuesto vía CameraRig.getYaw a través de un setter opcional
    return this._yawGetter ? this._yawGetter() : null;
  }

  private _yawGetter: (() => number) | null = null;
  setYawGetter(fn: (() => number) | null): void {
    this._yawGetter = fn;
  }
}

export const NexoraDebug = new DebugHookImpl();

// Se expone en window SOLO para que Playwright pueda leerlo desde afuera;
// es de solo lectura (no hay forma de mover al jugador a través de esto).
declare global {
  interface Window {
    __nexoraDebug?: DebugHookImpl;
  }
}
if (typeof window !== "undefined") {
  window.__nexoraDebug = NexoraDebug;
}
