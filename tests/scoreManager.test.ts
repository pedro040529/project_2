import { describe, expect, it } from "vitest";
import { Participant } from "../src/entities/Participant";
import { ScoreManager } from "../src/core/ScoreManager";
import { NPC_AVATARS, buildHumanAvatar, PLAYER_AVATAR_OPTIONS } from "../src/data/characters";

function makeRoster(): Participant[] {
  const human = new Participant("human", buildHumanAvatar(PLAYER_AVATAR_OPTIONS[0], "Ceci"), "human");
  const nova = new Participant("nova", NPC_AVATARS.nova, "ai");
  const kiro = new Participant("kiro", NPC_AVATARS.kiro, "ai");
  const pixel = new Participant("pixel", NPC_AVATARS.pixel, "ai");
  return [human, nova, kiro, pixel];
}

describe("ScoreManager", () => {
  it("acumula puntos positivos y negativos en el minijuego y en el total", () => {
    const sm = new ScoreManager();
    const [human] = makeRoster();

    sm.award(human, 100, "legitima recogida", "atrapa_o_evita");
    sm.award(human, 250, "cofre especial", "atrapa_o_evita");
    sm.award(human, -100, "engañosa recogida", "atrapa_o_evita");

    expect(human.minigameScore).toBe(250);
    expect(human.totalScore).toBe(250);
  });

  it("conserva el puntaje total entre minijuegos aunque minigameScore se reinicie", () => {
    const sm = new ScoreManager();
    const [human] = makeRoster();

    sm.award(human, 250, "cofre especial", "atrapa_o_evita");
    expect(human.totalScore).toBe(250);

    human.resetForNewMinigame();
    expect(human.minigameScore).toBe(0);
    expect(human.totalScore).toBe(250); // el total NUNCA se resetea entre minijuegos

    sm.award(human, 200, "engaño destruido", "cazaenganos");
    expect(human.minigameScore).toBe(200);
    expect(human.totalScore).toBe(450);
  });

  it("registra un log auditable de cada asignación de puntos", () => {
    const sm = new ScoreManager();
    const [human, nova] = makeRoster();

    sm.award(human, 100, "a", "atrapa_o_evita");
    sm.award(nova, -100, "b", "atrapa_o_evita");
    sm.award(human, 200, "c", "cazaenganos");

    expect(sm.getLog()).toHaveLength(3);
    expect(sm.getLog("atrapa_o_evita")).toHaveLength(2);
    expect(sm.getLog("cazaenganos")).toHaveLength(1);
  });

  it("rankByTotal ordena de mayor a menor y asigna el mismo rango a empates", () => {
    const [human, nova, kiro, pixel] = makeRoster();
    human.totalScore = 300;
    nova.totalScore = 500;
    kiro.totalScore = 500;
    pixel.totalScore = 100;

    const ranking = ScoreManager.rankByTotal([human, nova, kiro, pixel]);

    expect(ranking[0].rank).toBe(1);
    expect(ranking[1].rank).toBe(1); // empate en primer lugar
    expect(ranking[2].rank).toBe(3); // el siguiente rango salta el 2
    expect(ranking[3].rank).toBe(4);
    expect(ranking.map((r) => r.participantId)).toEqual(
      expect.arrayContaining(["nova", "kiro"])
    );
  });

  it("rankByMinigame usa el puntaje del minijuego actual, no el total", () => {
    const [human, nova, kiro, pixel] = makeRoster();
    human.totalScore = 900;
    human.minigameScore = 50;
    nova.totalScore = 100;
    nova.minigameScore = 400;

    const ranking = ScoreManager.rankByMinigame([human, nova, kiro, pixel]);
    expect(ranking[0].participantId).toBe("nova");
  });

  it("winner() devuelve al participante con mayor puntaje total", () => {
    const [human, nova, kiro, pixel] = makeRoster();
    human.totalScore = 300;
    nova.totalScore = 1200;
    kiro.totalScore = 800;
    pixel.totalScore = 50;

    expect(ScoreManager.winner([human, nova, kiro, pixel]).id).toBe("nova");
  });
});
