import { describe, expect, it } from "vitest";
import { OrbCharge, OrbCircuit } from "../src/core/OrbCircuit";
import { mulberry32 } from "../src/utils/rng";
import { ScenarioManager } from "../src/core/ScenarioManager";
import { Participant } from "../src/entities/Participant";
import { MINIGAME_SCORE_FLOOR, ScoreManager } from "../src/core/ScoreManager";
import { NPC_AVATARS, buildHumanAvatar, PLAYER_AVATAR_OPTIONS } from "../src/data/characters";

const IDS = ["human", "nova", "kiro", "pixel"];

describe("OrbCircuit", () => {
  it("nunca se pasa a sí mismo y siempre devuelve un participante válido", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const c = new OrbCircuit({ ids: IDS, humanId: "human", rand: mulberry32(seed) });
      for (let i = 0; i < 200; i++) {
        const next = c.chooseNext();
        expect(next).not.toBe(c.holderId);
        expect(IDS).toContain(next);
        c.arrive(next);
      }
    }
  });

  it("el humano vuelve a recibir el orbe: nunca más de maxNpcHolds NPC seguidos", () => {
    const c = new OrbCircuit({ ids: IDS, humanId: "human", maxNpcHolds: 2, rand: mulberry32(7) });
    let npcRun = 0;
    let maxRun = 0;
    let humanTurns = 0;
    for (let i = 0; i < 500; i++) {
      c.arrive(c.chooseNext());
      if (c.holderId === "human") {
        humanTurns++;
        npcRun = 0;
      } else {
        npcRun++;
        maxRun = Math.max(maxRun, npcRun);
      }
    }
    expect(maxRun).toBeLessThanOrEqual(2);
    expect(humanTurns).toBeGreaterThan(120);
  });

  it("los tres NPC reciben el orbe", () => {
    const c = new OrbCircuit({ ids: IDS, humanId: "human", rand: mulberry32(3) });
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      c.arrive(c.chooseNext());
      seen.add(c.holderId);
    }
    expect(seen).toEqual(new Set(IDS));
  });

  it("tras una explosión el orbe reaparece en otro participante", () => {
    const c = new OrbCircuit({ ids: IDS, humanId: "human", rand: mulberry32(11) });
    for (let i = 0; i < 50; i++) {
      const before = c.holderId;
      expect(c.respawn()).not.toBe(before);
    }
  });
});

describe("OrbCharge", () => {
  it("explota solo con el paso del tiempo, sin depender de las respuestas", () => {
    const ch = new OrbCharge({ minFuseSeconds: 10, maxFuseSeconds: 10 });
    expect(ch.exploded).toBe(false);
    for (let i = 0; i < 99; i++) ch.tick(0.1);
    expect(ch.exploded).toBe(false);
    ch.tick(0.2);
    expect(ch.exploded).toBe(true);
    expect(ch.value).toBe(1);
  });

  it("estabilizar baja la carga pero nunca por debajo de 0, y reset reinicia", () => {
    const ch = new OrbCharge({ minFuseSeconds: 10, maxFuseSeconds: 10 });
    ch.tick(2);
    ch.stabilize(0.5);
    expect(ch.value).toBe(0);
    ch.tick(9.9);
    ch.reset();
    expect(ch.value).toBe(0);
    expect(ch.exploded).toBe(false);
  });
});

describe("Contenido de Bajo Presión", () => {
  const all = new ScenarioManager().getAllPressureSituations();

  it("cada situación tiene 3 opciones y exactamente una buena", () => {
    for (const s of all) {
      expect(s.opciones).toHaveLength(3);
      expect(s.opciones.filter((o) => o.calidad === "buena")).toHaveLength(1);
      expect(s.explicacion.length).toBeGreaterThan(10);
    }
  });

  it("hay mezcla de situaciones legítimas, engañosas y ambiguas", () => {
    const types = new Set(all.map((s) => s.tipo));
    expect(types).toEqual(new Set(["legitima", "enganosa", "ambigua"]));
    expect(all.length).toBeGreaterThanOrEqual(20);
  });

  it("los ids son únicos", () => {
    expect(new Set(all.map((s) => s.scenarioID)).size).toBe(all.length);
  });
});

describe("Piso de puntaje por minijuego", () => {
  it("las penalizaciones no hunden por debajo del piso", () => {
    const sm = new ScoreManager();
    const p = new Participant("human", buildHumanAvatar(PLAYER_AVATAR_OPTIONS[0], "Ceci"), "human");
    for (let i = 0; i < 10; i++) sm.award(p, -100, "error", "cazaenganos");
    expect(p.minigameScore).toBe(MINIGAME_SCORE_FLOOR);
    expect(p.totalScore).toBe(MINIGAME_SCORE_FLOOR);
    sm.award(p, 120, "acierto", "cazaenganos");
    expect(p.minigameScore).toBe(MINIGAME_SCORE_FLOOR + 120);
    void NPC_AVATARS;
  });
});
