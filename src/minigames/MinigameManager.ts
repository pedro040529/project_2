import type { MinigameId } from "../core/types";
import type { IMinigame } from "./IMinigame";
import { AtrapaOEvita } from "./AtrapaOEvita";
import { Cazaenganos } from "./Cazaenganos";
import { BajoPresion } from "./BajoPresion";

/** Fábrica de minijuegos: aísla a MatchManager de las clases concretas. */
export class MinigameManager {
  create(id: MinigameId): IMinigame {
    switch (id) {
      case "atrapa_o_evita":
        return new AtrapaOEvita();
      case "cazaenganos":
        return new Cazaenganos();
      case "bajo_presion":
        return new BajoPresion();
    }
  }
}
