import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AnswerGate } from "../src/core/OrbCircuit";
import { InputManager } from "../src/world/InputManager";

describe("AnswerGate (un turno humano de Bajo Presión)", () => {
  it("no acepta respuestas antes de abrir el turno ni durante el margen inicial", () => {
    const g = new AnswerGate(0.4);
    expect(g.tryAnswer()).toBe(false);
    g.open();
    expect(g.tryAnswer()).toBe(false);
    g.tick(0.39);
    expect(g.tryAnswer()).toBe(false);
    g.tick(0.02);
    expect(g.isOpen).toBe(true);
  });

  it("acepta UNA sola respuesta por pregunta", () => {
    const g = new AnswerGate(0.4);
    g.open();
    g.tick(1);
    expect(g.tryAnswer()).toBe(true);
    expect(g.tryAnswer()).toBe(false);
    g.tick(5);
    expect(g.tryAnswer()).toBe(false);
  });

  it("al abrir la pregunta siguiente se puede volver a responder (no queda bloqueado tras un error)", () => {
    const g = new AnswerGate(0.4);
    for (let turn = 0; turn < 5; turn++) {
      g.open();
      g.tick(0.1);
      expect(g.tryAnswer()).toBe(false); // una pulsación que llegó demasiado pronto no cuenta
      g.tick(1);
      expect(g.tryAnswer()).toBe(true);
      g.close();
      expect(g.tryAnswer()).toBe(false);
    }
  });
});

describe("InputManager: teclas de respuesta", () => {
  const listeners = new Map<string, ((e: unknown) => void)[]>();
  const fire = (type: string, e: Record<string, unknown>) => (listeners.get(type) ?? []).forEach((l) => l(e));
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { window: g.window, document: g.document };

  beforeEach(() => {
    listeners.clear();
    const target = {
      addEventListener: (t: string, fn: (e: unknown) => void) => listeners.set(t, [...(listeners.get(t) ?? []), fn]),
      removeEventListener: () => {}
    };
    g.window = target;
    g.document = { ...target, hidden: false };
  });
  afterEach(() => {
    g.window = saved.window;
    g.document = saved.document;
  });

  const make = () => new InputManager({ addEventListener: () => {}, removeEventListener: () => {}, getBoundingClientRect: () => ({}) } as unknown as HTMLElement);

  it("mantener la tecla apretada (keydown repetido) cuenta como una sola pulsación", () => {
    const input = make();
    fire("keydown", { code: "Digit2", repeat: false });
    expect(input.consumeNumberKey()).toBe(2);
    for (let i = 0; i < 10; i++) fire("keydown", { code: "Digit2", repeat: true });
    expect(input.consumeNumberKey()).toBeNull();
  });

  it("clearPending descarta pulsaciones que llegaron fuera de turno", () => {
    const input = make();
    fire("keydown", { code: "Digit3", repeat: false });
    fire("keydown", { code: "KeyE", repeat: false });
    input.clearPending();
    expect(input.consumeNumberKey()).toBeNull();
    expect(input.consumeInteract()).toBe(false);
  });
});
