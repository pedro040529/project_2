import { describe, expect, it } from "vitest";
import { ScenarioManager } from "../src/core/ScenarioManager";
import { CATEGORY_FEEDBACK, feedbackFor } from "../src/data/feedback";

describe("Banco educativo (72 situaciones, v2.1)", () => {
  const sm = new ScenarioManager(1);
  const at = sm.getAtrapaSituations();
  const ca = sm.getAllCazaSituations();
  const bp = sm.getBajoPresionSituations();

  it("tiene 24 situaciones por minijuego", () => {
    expect(at).toHaveLength(24);
    expect(ca).toHaveLength(24);
    expect(bp).toHaveLength(24);
  });

  it("los IDs son únicos y siguen el formato del documento", () => {
    const ids = [...at, ...ca, ...bp].map((s) => s.id);
    expect(new Set(ids).size).toBe(72);
    expect(at.every((s) => /^AT-\d\d$/.test(s.id))).toBe(true);
    expect(ca.every((s) => /^CA-\d\d$/.test(s.id))).toBe(true);
    expect(bp.every((s) => /^BP-\d\d$/.test(s.id))).toBe(true);
  });

  it("cada categoría tiene feedback base", () => {
    for (const s of [...at, ...ca, ...bp]) {
      expect(CATEGORY_FEEDBACK[s.categoria]).toBeTruthy();
      expect(feedbackFor(s.categoria, true).length).toBeGreaterThan(5);
      expect(feedbackFor(s.categoria, false)).toBe(CATEGORY_FEEDBACK[s.categoria]);
    }
  });

  it("dificultad 1-3 repartida por tercios (8 de cada una por minijuego)", () => {
    for (const list of [at, ca, bp]) {
      for (const d of [1, 2, 3]) expect(list.filter((s) => s.dificultad === d)).toHaveLength(8);
    }
  });

  it("Atrapa: mezcla de mensajes para recoger y para evitar, con remitente y contexto", () => {
    expect(at.filter((s) => s.accionCorrecta === "recoger")).toHaveLength(12);
    expect(at.filter((s) => s.accionCorrecta === "evitar")).toHaveLength(12);
    for (const s of at) {
      expect(s.remitente.length).toBeGreaterThan(0);
      expect(s.contexto.length).toBeGreaterThan(0);
      expect(s.texto.length).toBeGreaterThan(10);
    }
  });

  it("Cazaengaños: CA-20 y CA-22 se conservan pero NO entran al juego (pendientes de revisión editorial)", () => {
    const pending = ca.filter((s) => s.pendienteRevision).map((s) => s.id);
    expect(pending).toEqual(["CA-20", "CA-22"]);
    const playable = sm.getCazaSituations();
    expect(playable).toHaveLength(22);
    expect(playable.some((s) => s.id === "CA-20" || s.id === "CA-22")).toBe(false);
  });

  it("Cazaengaños: hay publicaciones para disparar y para dejar pasar", () => {
    const playable = sm.getCazaSituations();
    expect(playable.some((s) => s.accionCorrecta === "disparar")).toBe(true);
    expect(playable.some((s) => s.accionCorrecta === "no_disparar")).toBe(true);
  });

  it("Bajo Presión: 3 opciones A/B/C y exactamente una correcta que existe", () => {
    for (const s of bp) {
      expect(s.opciones.map((o) => o.id)).toEqual(["A", "B", "C"]);
      expect(s.opciones.filter((o) => o.id === s.correcta)).toHaveLength(1);
      expect(s.pregunta.length).toBeGreaterThan(10);
    }
  });

  it("Bajo Presión: la respuesta correcta no está siempre en la misma letra", () => {
    const letters = new Set(bp.map((s) => s.correcta));
    expect(letters).toEqual(new Set(["A", "B", "C"]));
  });
});

describe("Mazos", () => {
  it("reparten todas las situaciones antes de repetir cualquiera", () => {
    const deck = new ScenarioManager(5).atrapaDeck();
    const first = Array.from({ length: 24 }, () => deck.draw().id);
    expect(new Set(first).size).toBe(24);
  });

  it("nunca repiten la misma situación dos veces seguidas, ni al volver a barajar", () => {
    const deck = new ScenarioManager(9).cazaDeck();
    let prev = "";
    for (let i = 0; i < 200; i++) {
      const id = deck.draw().id;
      expect(id).not.toBe(prev);
      prev = id;
    }
  });

  it("dos semillas distintas dan órdenes distintos", () => {
    const a = Array.from({ length: 10 }, ((d) => () => d.draw().id)(new ScenarioManager(1).bajoPresionDeck()));
    const b = Array.from({ length: 10 }, ((d) => () => d.draw().id)(new ScenarioManager(2).bajoPresionDeck()));
    expect(a).not.toEqual(b);
  });

  it("el mazo de Cazaengaños excluye las situaciones pendientes", () => {
    const deck = new ScenarioManager(3).cazaDeck();
    const ids = new Set(Array.from({ length: 80 }, () => deck.draw().id));
    expect(ids.has("CA-20")).toBe(false);
    expect(ids.has("CA-22")).toBe(false);
    expect(ids.size).toBe(22);
  });
});
