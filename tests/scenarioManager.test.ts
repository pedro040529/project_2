import { describe, expect, it } from "vitest";
import { ScenarioManager } from "../src/core/ScenarioManager";
import { Config } from "../src/core/Config";

describe("ScenarioManager — contenido y sorteo", () => {
  it("expone el tamaño de pool pedido por el brief (24 rewards / 40 messages / 15 pressure)", () => {
    const sm = new ScenarioManager(1);
    expect(sm.getAllRewards()).toHaveLength(24);
    expect(sm.getAllMessages()).toHaveLength(40);
    expect(sm.getAllPressureSituations()).toHaveLength(15);
  });

  it("cada escenario está clasificado como legitima, ambigua o enganosa", () => {
    const sm = new ScenarioManager(1);
    const valid = new Set(["legitima", "ambigua", "enganosa"]);
    for (const r of sm.getAllRewards()) expect(valid.has(r.tipo)).toBe(true);
    for (const m of sm.getAllMessages()) expect(valid.has(m.tipo)).toBe(true);
    for (const p of sm.getAllPressureSituations()) expect(valid.has(p.tipo)).toBe(true);
  });

  it("cada escenario trae justificación de diseño (explicacion) y no está vacía", () => {
    const sm = new ScenarioManager(1);
    for (const m of sm.getAllMessages()) {
      expect(m.explicacion.length).toBeGreaterThan(10);
      expect(m.senales.length).toBeGreaterThan(0);
    }
  });

  it("drawMessageSet respeta la composición pedida (ej. 4 legítimos, 5 engañosos, 3 ambiguos)", () => {
    const sm = new ScenarioManager(42);
    const composition = { legitima: 4, enganosa: 5, ambigua: 3 };
    const drawn = sm.drawMessageSet(composition);

    expect(drawn).toHaveLength(12);
    expect(drawn.filter((m) => m.tipo === "legitima")).toHaveLength(4);
    expect(drawn.filter((m) => m.tipo === "enganosa")).toHaveLength(5);
    expect(drawn.filter((m) => m.tipo === "ambigua")).toHaveLength(3);
  });

  it("drawMessageSet nunca repite el mismo scenarioID dentro del mismo sorteo", () => {
    const sm = new ScenarioManager(7);
    const drawn = sm.drawMessageSet(Config.cazaenganos.composition);
    const ids = drawn.map((m) => m.scenarioID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("dos partidas con semillas distintas producen selecciones distintas (varían entre partidas)", () => {
    const a = new ScenarioManager(1).drawMessageSet(Config.cazaenganos.composition).map((m) => m.scenarioID);
    const b = new ScenarioManager(2).drawMessageSet(Config.cazaenganos.composition).map((m) => m.scenarioID);
    expect(a).not.toEqual(b);
  });

  it("drawMessageSet lanza si se pide más de lo que el pool de ese tipo tiene", () => {
    const sm = new ScenarioManager(1);
    expect(() => sm.drawMessageSet({ legitima: 999, enganosa: 1, ambigua: 1 })).toThrow();
  });

  it("drawPressureSequence devuelve exactamente la cantidad pedida, incluso mayor al pool", () => {
    const sm = new ScenarioManager(3);
    const seq = sm.drawPressureSequence(20);
    expect(seq).toHaveLength(20);
  });

  it("getRewardsByType separa correctamente legítimas, ambiguas y engañosas", () => {
    const sm = new ScenarioManager(1);
    const leg = sm.getRewardsByType("legitima");
    const amb = sm.getRewardsByType("ambigua");
    const eng = sm.getRewardsByType("enganosa");
    expect(leg.length + amb.length + eng.length).toBe(24);
    expect(leg.every((r) => r.tipo === "legitima")).toBe(true);
    expect(amb.every((r) => r.tipo === "ambigua")).toBe(true);
    expect(eng.every((r) => r.tipo === "enganosa")).toBe(true);
  });

  it("las situaciones de presión traen 3 opciones con al menos una buena y una mala", () => {
    const sm = new ScenarioManager(1);
    for (const s of sm.getAllPressureSituations()) {
      expect(s.opciones).toHaveLength(3);
      expect(s.opciones.some((o) => o.calidad === "buena")).toBe(true);
      expect(s.opciones.some((o) => o.calidad === "mala")).toBe(true);
    }
  });
});
