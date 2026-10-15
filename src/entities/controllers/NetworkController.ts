import type { IController, MoveIntent } from "./IController";

/**
 * Interfaz vacía para el futuro multijugador en red: implementa IController
 * pero no hace nada todavía. Su sola existencia es lo que permite que
 * GameManager pueda, el día de mañana, configurar un Participant en red sin
 * tocar ningún minijuego (que solo conocen IController).
 */
export class NetworkController implements IController {
  readonly kind = "network" as const;
  readonly moveIntent: MoveIntent = { x: 0, z: 0 };

  update(_dt: number): void {
    // TODO(futuro multijugador): recibir estado remoto y actualizar moveIntent.
  }
}
