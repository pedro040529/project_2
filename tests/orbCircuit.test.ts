import { describe, expect, it } from "vitest";
import { OrbCircuit, OrbEnergy } from "../src/core/OrbCircuit";
import { Config } from "../src/core/Config";
import { mulberry32 } from "../src/utils/rng";
import { Participant } from "../src/entities/Participant";
import { MINIGAME_SCORE_FLOOR, ScoreManager } from "../src/core/ScoreManager";
import { NPC_AVATARS, buildHumanAvatar, DEFAULT_APPEARANCE } from "../src/data/characters";

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

describe("OrbEnergy", () => {
  it("empieza en el valor inicial y reacciona a las decisiones", () => {
    const e = new OrbEnergy({ initial: 40 });
    expect(e.value).toBe(40);
    expect(e.apply(-10)).toBe("active");
    expect(e.value).toBe(30);
    expect(e.apply(25)).toBe("active");
    expect(e.value).toBe(55);
  });

  it("explota al llegar a 100 % y no pasa de ahí", () => {
    const e = new OrbEnergy({ initial: 40 });
    e.apply(25);
    e.apply(25);
    expect(e.apply(25)).toBe("exploded");
    expect(e.value).toBe(100);
    expect(e.apply(25)).toBe("exploded");
    expect(e.value).toBe(100);
  });

  it("se estabiliza al llegar a 0 % y no baja de ahí", () => {
    const e = new OrbEnergy({ initial: 10 });
    expect(e.apply(-10)).toBe("stabilized");
    expect(e.value).toBe(0);
    expect(e.apply(-10)).toBe("stabilized");
    expect(e.value).toBe(0);
  });

  it("no depende del tiempo: sin decisiones la energía no cambia", () => {
    const e = new OrbEnergy({ initial: 40 });
    expect(e.status).toBe("active");
    expect(e.value).toBe(40);
  });

  it("reset vuelve a la energía inicial", () => {
    const e = new OrbEnergy({ initial: 40 });
    e.apply(60);
    e.reset();
    expect(e.value).toBe(40);
    expect(e.status).toBe("active");
    expect(e.ratio).toBeCloseTo(0.4);
  });

  it("con los valores del juego: 4 errores seguidos explotan, 4 aciertos seguidos estabilizan", () => {
    const wrong = new OrbEnergy({ initial: Config.bajoPresion.initialEnergy });
    let st: string = "active";
    let n = 0;
    while (st === "active") {
      st = wrong.apply(Config.bajoPresion.energyOnWrong);
      n++;
    }
    expect(st).toBe("exploded");
    expect(n).toBe(3);

    const right = new OrbEnergy({ initial: Config.bajoPresion.initialEnergy });
    st = "active";
    n = 0;
    while (st === "active") {
      st = right.apply(Config.bajoPresion.energyOnCorrect);
      n++;
    }
    expect(st).toBe("stabilized");
    expect(n).toBe(4);
  });
});

describe("Piso de puntaje por minijuego", () => {
  it("las penalizaciones no hunden por debajo del piso", () => {
    const sm = new ScoreManager();
    const p = new Participant("human", buildHumanAvatar(DEFAULT_APPEARANCE, "Ceci"), "human");
    for (let i = 0; i < 10; i++) sm.award(p, -100, "error", "cazaenganos");
    expect(p.minigameScore).toBe(MINIGAME_SCORE_FLOOR);
    expect(p.totalScore).toBe(MINIGAME_SCORE_FLOOR);
    sm.award(p, 120, "acierto", "cazaenganos");
    expect(p.minigameScore).toBe(MINIGAME_SCORE_FLOOR + 120);
    void NPC_AVATARS;
  });
});
