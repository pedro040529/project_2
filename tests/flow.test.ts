import { describe, expect, it } from "vitest";
import { Participant } from "../src/entities/Participant";
import { ScoreManager } from "../src/core/ScoreManager";
import { Config } from "../src/core/Config";
import { NPC_AVATARS, buildHumanAvatar, DEFAULT_APPEARANCE, BODY_COLORS, HEAD_ACCESSORIES, EXTRA_ACCESSORIES, colorDef } from "../src/data/characters";
import { sanitizeSettings } from "../src/core/Settings";
import { sanitizeAppearance } from "../src/core/Profile";
import { orderForPodium } from "../src/core/UIManager";
import { testTimeScale } from "../src/utils/testHooks";

function roster(): Participant[] {
  return [
    new Participant("human", buildHumanAvatar(DEFAULT_APPEARANCE, "Pedro"), "human"),
    new Participant("nova", NPC_AVATARS.nova, "ai"),
    new Participant("kiro", NPC_AVATARS.kiro, "ai"),
    new Participant("pixel", NPC_AVATARS.pixel, "ai")
  ];
}

describe("Orden de la competencia", () => {
  it("es obligatorio: Atrapa o evita → Cazaengaños → Bajo Presión", () => {
    expect([...Config.match.minigameOrder]).toEqual(["atrapa_o_evita", "cazaenganos", "bajo_presion"]);
  });

  it("todos los desafíos usan +100 / −50 sin multiplicar por dificultad", () => {
    expect(Config.atrapaOEvita.points).toEqual({ correcta: 100, incorrecta: -50 });
    expect(Config.cazaenganos.points).toEqual({ correcta: 100, incorrecta: -50 });
    expect(Config.bajoPresion.points.correcta).toBe(100);
    expect(Config.bajoPresion.points.incorrecta).toBe(-50);
    expect(Config.bajoPresion.points.sinRespuesta).toBe(-50);
  });

  it("Bajo Presión: energía inicial 40 %, +25 error, −10 acierto, 15 s para decidir", () => {
    const c = Config.bajoPresion;
    expect(c.initialEnergy).toBe(40);
    expect(c.energyOnWrong).toBe(25);
    expect(c.energyOnTimeout).toBe(25);
    expect(c.energyOnCorrect).toBe(-10);
    expect(c.decisionSeconds).toBe(15);
  });
});

describe("Puntuación y ranking: una única fuente de datos", () => {
  it("el desglose por minijuego suma exactamente el total de cada participante", () => {
    const sm = new ScoreManager();
    const ps = roster();
    const order = Config.match.minigameOrder;
    const plan: [number, (typeof order)[number], number][] = [
      [0, "atrapa_o_evita", 100], [0, "atrapa_o_evita", -50], [1, "atrapa_o_evita", 100],
      [0, "cazaenganos", 100], [2, "cazaenganos", -50], [2, "cazaenganos", -50], [2, "cazaenganos", -50],
      [0, "bajo_presion", -50], [1, "bajo_presion", 100], [3, "bajo_presion", -100]
    ];
    for (const [i, mg, pts] of plan) sm.award(ps[i], pts, "t", mg);
    const per = sm.perMinigame(ps, order);
    for (const p of ps) {
      expect(per.get(p.id)!.reduce((a, b) => a + b, 0)).toBe(p.totalScore);
    }
    expect(per.get("human")).toEqual([50, 100, -50]);
  });

  it("las penalizaciones del piso también se reflejan en el desglose (puntos reales aplicados)", () => {
    const sm = new ScoreManager();
    const [human] = roster();
    for (let i = 0; i < 6; i++) sm.award(human, -50, "err", "cazaenganos");
    const per = sm.perMinigame([human], Config.match.minigameOrder);
    expect(per.get("human")![1]).toBe(human.totalScore);
    expect(human.totalScore).toBe(-200);
  });

  it("el ranking comparte puesto en los empates y conserva a los 4", () => {
    const sm = new ScoreManager();
    const ps = roster();
    sm.award(ps[0], 200, "x", "atrapa_o_evita");
    sm.award(ps[1], 200, "x", "atrapa_o_evita");
    sm.award(ps[2], 50, "x", "atrapa_o_evita");
    const r = ScoreManager.rankByTotal(ps);
    expect(r.map((e) => e.rank)).toEqual([1, 1, 3, 4]);
    expect(orderForPodium(r).map((e) => e.participantId).sort()).toEqual(["human", "kiro", "nova", "pixel"]);
  });

  it("al crear nuevos participantes (nueva competencia) los puntajes parten de cero", () => {
    const first = roster();
    new ScoreManager().award(first[0], 500, "x", "atrapa_o_evita");
    const second = roster();
    expect(second.every((p) => p.totalScore === 0 && p.minigameScore === 0)).toBe(true);
  });
});

describe("Guardianes Digitales", () => {
  it("los 3 bots usan el mismo modelo con apariencias distintas", () => {
    const looks = Object.values(NPC_AVATARS).map((a) => JSON.stringify(a.appearance));
    expect(new Set(looks).size).toBe(3);
  });

  it("hay 8 colores y los accesorios del documento de diseño", () => {
    expect(BODY_COLORS).toHaveLength(8);
    expect(HEAD_ACCESSORIES.map((h) => h.id)).toEqual(["none", "cap", "glasses", "headphones", "hood", "hat"]);
    expect(EXTRA_ACCESSORIES.map((h) => h.id)).toEqual(["none", "scarf", "cape", "backpack"]);
  });

  it("el avatar humano toma color y acentos de la apariencia elegida", () => {
    const a = buildHumanAvatar({ color: "rojo", head: "glasses", extra: "cape" }, "Pedro");
    expect(a.primaryColor).toBe(colorDef("rojo").shell);
    expect(a.appearance).toEqual({ color: "rojo", head: "glasses", extra: "cape" });
  });

  it("una apariencia guardada inválida se corrige a valores seguros", () => {
    expect(sanitizeAppearance({ color: "fucsia" as never, head: "nada" as never })).toEqual(DEFAULT_APPEARANCE);
    expect(sanitizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
  });
});

describe("Ajustes", () => {
  it("limita volumen y sensibilidad y descarta valores inválidos", () => {
    const s = sanitizeSettings({ volume: 9, mouseSensitivity: -3, quality: "ultra" as never });
    expect(s.volume).toBe(1);
    expect(s.mouseSensitivity).toBe(0.4);
    expect(s.quality).toBe("auto");
  });

  it("?ts= solo acelera las rondas dentro de un rango seguro", () => {
    expect(testTimeScale("")).toBe(1);
    expect(testTimeScale("?ts=0.2")).toBe(0.2);
    expect(testTimeScale("?ts=0")).toBe(1);
    expect(testTimeScale("?ts=5")).toBe(1);
  });
});
