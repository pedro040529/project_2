import type { ControllerKind } from "../../core/types";

export interface MoveIntent {
  /** dirección deseada normalizada en el plano XZ del mundo (no en espacio de pantalla) */
  x: number;
  z: number;
}

/**
 * Contrato común para mover a un Participant sin que el minijuego sepa si
 * hay un humano o una IA detrás. Cada minijuego decide *qué objetivo*
 * perseguir (para la IA) o lee clicks/E (para el humano), pero la
 * integración física (velocidad, colisión, límites de arena) es siempre la
 * misma, fuera del controlador.
 */
export interface IController {
  readonly kind: ControllerKind;
  /** Debe llamarse una vez por frame ANTES de leer moveIntent. */
  update(dt: number): void;
  readonly moveIntent: MoveIntent;
}
