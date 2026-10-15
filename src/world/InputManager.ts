/**
 * Estado crudo de teclado/mouse. Un solo InputManager por partida;
 * HumanController y CameraRig lo consumen, pero ningún minijuego depende de
 * él directamente (así los minijuegos no dependen del teclado local, tal
 * como pide la arquitectura).
 *
 * IMPORTANTE: nada de esto requiere pointer lock. El movimiento (WASD /
 * flechas) funciona siempre. El mouse se lee de dos formas independientes:
 * - posición NDC del cursor visible (para apuntar/disparar con el cursor
 *   normal, sin capturar el puntero);
 * - delta de movimiento (para girar la cámara con el mouse, opcional).
 * El pointer lock se mantiene disponible como mejora opcional (algunos
 * navegadores/usuarios lo prefieren), pero nunca es requerido para jugar.
 */
export class InputManager {
  private keys = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private ndcX = 0; // -1..1, cursor visible, se actualiza con cualquier mousemove
  private ndcY = 0;
  private hasMousePosition = false;
  private clickPending = false;
  private interactPending = false;
  private numberKeyPending: 1 | 2 | 3 | null = null;
  private _pointerLocked = false;
  private el: HTMLElement;

  onPointerLockChange: ((locked: boolean) => void) | null = null;

  constructor(el: HTMLElement) {
    this.el = el;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    // blur/visibilitychange: si el usuario cambia de pestaña o pierde foco
    // con una tecla apretada, nunca llega el keyup correspondiente — sin
    // esto el personaje quedaría "caminando solo" para siempre.
    window.addEventListener("blur", this.handleBlur);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    el.addEventListener("mousemove", this.handleMouseMove);
    el.addEventListener("mousedown", this.handleMouseDown);
    el.addEventListener("contextmenu", this.handleContextMenu);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === "KeyE") this.interactPending = true;
    if (e.code === "Digit1") this.numberKeyPending = 1;
    if (e.code === "Digit2") this.numberKeyPending = 2;
    if (e.code === "Digit3") this.numberKeyPending = 3;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private handleBlur = () => {
    this.keys.clear();
    this.mouseDX = this.mouseDY = 0;
    this.clickPending = this.interactPending = false;
    this.numberKeyPending = null;
  };

  private handleVisibilityChange = () => {
    if (document.hidden) this.keys.clear();
    this.mouseDX = this.mouseDY = 0;
    this.clickPending = this.interactPending = false;
    this.numberKeyPending = null;
  };

  private handleMouseMove = (e: MouseEvent) => {
    // Delta relativo — funciona con o sin pointer lock (movementX/Y siempre
    // existe en un mousemove normal); se usa para el giro opcional de cámara.
    if (this._pointerLocked || (e.buttons & 2) !== 0) {
      this.mouseDX += e.movementX ?? 0;
      this.mouseDY += e.movementY ?? 0;
    }

    // Posición absoluta del cursor visible, en NDC (-1..1), para apuntar.
    // Con pointer lock activo no hay posición absoluta fiable (el cursor
    // está oculto y "fijo"): en ese caso se sigue apuntando al centro.
    if (!this._pointerLocked) {
      const rect = this.el.getBoundingClientRect();
      this.ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.hasMousePosition = true;
    }
  };

  private handleContextMenu = (e: Event) => e.preventDefault();

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.clickPending = true;
  };

  private handlePointerLockChange = () => {
    this._pointerLocked = document.pointerLockElement === this.el;
    this.onPointerLockChange?.(this._pointerLocked);
  };

  /** Pointer lock es un EXTRA opcional — nunca se pide automáticamente. */
  requestPointerLock(): void {
    const result = this.el.requestPointerLock?.();
    if (result && typeof (result as Promise<void>).catch === "function") {
      (result as Promise<void>).catch(() => {
        /* el juego sigue funcionando igual: nada depende del pointer lock */
      });
    }
  }

  exitPointerLock(): void {
    if (document.pointerLockElement === this.el) document.exitPointerLock();
  }

  get pointerLocked(): boolean {
    return this._pointerLocked;
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** Vector de movimiento crudo WASD/flechas en espacio de pantalla: x=derecha, y=adelante. */
  readMoveAxes(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.isDown("KeyW") || this.isDown("ArrowUp")) y += 1;
    if (this.isDown("KeyS") || this.isDown("ArrowDown")) y -= 1;
    if (this.isDown("KeyD") || this.isDown("ArrowRight")) x += 1;
    if (this.isDown("KeyA") || this.isDown("ArrowLeft")) x -= 1;
    return { x, y };
  }

  consumeMouseDelta(): { dx: number; dy: number } {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  /** Posición del cursor en NDC (-1..1). Si nunca hubo mousemove (o está lockeado), vuelve al centro. */
  getMouseNDC(): { x: number; y: number } {
    if (this._pointerLocked || !this.hasMousePosition) return { x: 0, y: 0 };
    return { x: this.ndcX, y: this.ndcY };
  }

  consumeClick(): boolean {
    if (this.clickPending) {
      this.clickPending = false;
      return true;
    }
    return false;
  }

  consumeInteract(): boolean {
    if (this.interactPending) {
      this.interactPending = false;
      return true;
    }
    return false;
  }

  consumeNumberKey(): 1 | 2 | 3 | null {
    const v = this.numberKeyPending;
    this.numberKeyPending = null;
    return v;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.el.removeEventListener("mousemove", this.handleMouseMove);
    this.el.removeEventListener("mousedown", this.handleMouseDown);
    this.el.removeEventListener("contextmenu", this.handleContextMenu);
    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
  }
}
