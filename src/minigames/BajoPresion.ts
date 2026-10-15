import * as THREE from "three";
import { Config } from "../core/Config";
import type { PressureOption, PressureSituationDef } from "../core/types";
import type { InstructionsSpec, HudHandle, DecisionHandle } from "../core/UIManager";
import type { IMinigame, MinigameContext } from "./IMinigame";
import type { Participant } from "../entities/Participant";
import { ArenaRuntime } from "./common/ArenaRuntime";
import { buildHotPotatoArena } from "../world/HotPotatoArena";
import { feltFlat, CraftPalette } from "../world/Materials";
import { mulberry32 } from "../utils/rng";

type Phase = "idle_holding" | "deciding" | "awaiting_pass" | "in_flight" | "exploding";

function ballMesh(): THREE.Group {
  const g = new THREE.Group();
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 14), feltFlat(CraftPalette.coralFelt, 0.7));
  sphere.castShadow = true;
  g.add(sphere);
  for (let i = 0; i < 4; i++) {
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.012, 6, 20), feltFlat(CraftPalette.white, 0.6));
    seam.rotation.x = (i / 4) * Math.PI;
    g.add(seam);
  }
  return g;
}

export class BajoPresion implements IMinigame {
  readonly id = "bajo_presion" as const;
  readonly title = "Bajo Presión";

  private ctx!: MinigameContext;
  private arenaRuntime!: ArenaRuntime;
  private hud!: HudHandle;
  private decisionPanel!: DecisionHandle;
  private ball!: THREE.Group;

  private situations: PressureSituationDef[] = [];
  private situationCursor = 0;
  private timeRemaining = Config.bajoPresion.durationSeconds;
  private finished = false;
  private started = false;
  private rand = mulberry32((Date.now() + 999) & 0xffffffff);

  private holderId = "human";
  private phase: Phase = "idle_holding";
  private decisionTimer = 0;
  private currentSituation: PressureSituationDef | null = null;
  private chargeSeconds = 0;
  private explosionCount = 0;
  private flightT = 0;
  private flightDuration = 0.5;
  private flightFrom = new THREE.Vector3();
  private flightTo = new THREE.Vector3();
  private flightTargetId = "";
  private lastHumanPick: PressureOption | null = null;
  private pendingExtraDelay = 0;
  private passWindowTimer = 0;

  async load(ctx: MinigameContext): Promise<void> {
    this.ctx = ctx;
    this.arenaRuntime = new ArenaRuntime(ctx, Config.arena.hotPotatoRadius, buildHotPotatoArena, 0.68);
    this.hud = ctx.ui.mountHUD();
    this.hud.showPointerHint(null);
    this.hud.setObjective("Recibes el objeto, decides rápido qué hacer y lo pasas antes de que explote.");
    this.decisionPanel = ctx.ui.mountDecisionPanel();

    this.situations = ctx.scenarios.drawPressureSequence(Config.bajoPresion.situationsPerMatch);

    this.ball = ballMesh();
    this.arenaRuntime.group.add(this.ball);

    // empieza el humano sosteniendo el objeto
    this.holderId = "human";
    this.snapBallToHolder();
  }

  getInstructions(): InstructionsSpec {
    return {
      title: "Bajo Presión",
      goal: "Cuando tengas el objeto, va a aparecer una situación con 3 opciones. Elige rápido y pásalo con E antes de que explote.",
      controls: [
        { key: "1-3", label: "Elegir opción / rival" },
        { key: "E", label: "Pasar al más cercano" },
        { key: "Click", label: "Pasar a un rival puntual" }
      ]
    };
  }

  start(): void {
    this.started = true;
    this.ctx.audio.playMinigameMusic(() => this.musicIntensity());
    this.beginHolding();
  }

  /** 0 la mayor parte de la ronda, sube a 1 en el último 35% del tiempo — la música se acelera cuando se acaba. */
  private musicIntensity(): number {
    const ratio = 1 - this.timeRemaining / Config.bajoPresion.durationSeconds;
    return Math.min(1, Math.max(0, (ratio - 0.65) / 0.35));
  }

  private participant(id: string): Participant {
    return this.ctx.participants.find((p) => p.id === id)!;
  }

  private holderPosition(id: string): THREE.Vector3 {
    const p = this.participant(id).position;
    return new THREE.Vector3(p[0], 1.1, p[2]);
  }

  private snapBallToHolder(): void {
    this.ball.position.copy(this.holderPosition(this.holderId));
  }

  private nextSituation(): PressureSituationDef {
    if (this.situationCursor >= this.situations.length) this.situationCursor = 0;
    return this.situations[this.situationCursor++];
  }

  private beginHolding(): void {
    this.phase = "deciding";
    this.currentSituation = this.nextSituation();
    this.decisionTimer = Config.bajoPresion.decisionWindowSeconds;
    this.participant(this.holderId).state = "deciding";

    if (this.holderId === "human") {
      this.decisionPanel.update(this.currentSituation.texto, this.currentSituation.opciones, (opt) => this.resolveDecision(opt));
    } else {
      this.decisionPanel.hide();
    }
  }

  private resolveDecision(opt: PressureOption): void {
    if (this.phase !== "deciding" || !this.currentSituation) return;
    const holder = this.participant(this.holderId);
    const points =
      opt.calidad === "buena"
        ? Config.bajoPresion.points.buenaDecision
        : opt.calidad === "mala"
          ? Config.bajoPresion.points.malaDecision
          : Config.bajoPresion.points.neutra;

    this.ctx.scoreManager.award(holder, points, `${this.currentSituation.scenarioID}:${opt.id}`, "bajo_presion");
    if (holder.controllerKind === "human") {
      this.ctx.summary.recordPressureDecision(opt.calidad);
      this.lastHumanPick = opt;
    }

    const rig = this.arenaRuntime.rigs.get(holder.id);
    if (opt.calidad === "buena") rig?.character.triggerReaction("celebrate", 0.7);
    else if (opt.calidad === "mala") rig?.character.triggerReaction("lose", 0.7);
    holder.state = "acting";

    this.decisionPanel.hide();

    // ¿explota, a pesar (o a causa) de la decisión? mantiene la incertidumbre real.
    const chargeRatio = Math.min(1, this.chargeSeconds / Config.bajoPresion.baseChargeSeconds);
    let explodeChance =
      opt.calidad === "buena"
        ? Config.bajoPresion.explodeDespiteGoodDecisionChance
        : opt.calidad === "mala"
          ? Config.bajoPresion.explodeAfterBadDecisionChance
          : 0.35;
    explodeChance *= 0.5 + chargeRatio;
    const forced = chargeRatio >= 1;

    if (forced || this.rand() < explodeChance) {
      this.explode(holder);
      return;
    }

    const extraDelay = opt.calidad === "mala" ? Config.bajoPresion.badDecisionExtraDelay : 0;
    if (holder.controllerKind === "human") {
      // El humano elige a quién pasarle (click sobre un rival, teclas 1-3,
      // o E para pasar al más cercano por defecto) — no se pasa solo.
      this.phase = "awaiting_pass";
      this.pendingExtraDelay = extraDelay;
      this.passWindowTimer = 3.5; // si no elige a nadie, pasa solo al más cercano (no se traba la ronda)
    } else {
      this.startPass(extraDelay);
    }
  }

  private explode(holder: Participant): void {
    this.phase = "exploding";
    this.explosionCount++;
    this.ctx.scoreManager.award(holder, Config.bajoPresion.points.explosionPenalty, "explosion", "bajo_presion");
    this.ctx.audio.explosion();
    const rig = this.arenaRuntime.rigs.get(holder.id);
    rig?.character.triggerReaction("lose", 1.1);
    holder.state = "losing";

    const screenPos = this.ball.position.clone();
    void screenPos;

    this.chargeSeconds = 0;
    window.setTimeout(() => {
      if (this.finished) return;
      holder.state = "idle";
      this.beginHolding();
      this.snapBallToHolder();
    }, 900);
  }

  private nearestOtherParticipant(fromId: string): string {
    return this.othersByDistance(fromId)[0] ?? fromId;
  }

  /** Los otros 3 participantes ordenados de más cerca a más lejos de `fromId`. */
  private othersByDistance(fromId: string): string[] {
    const from = this.participant(fromId).position;
    return this.ctx.participants
      .filter((p) => p.id !== fromId)
      .map((p) => ({ id: p.id, d: Math.hypot(p.position[0] - from[0], p.position[2] - from[2]) }))
      .sort((a, b) => a.d - b.d)
      .map((p) => p.id);
  }

  /** Raycast del apuntado del humano contra los personajes rivales (para "pasar con click"). */
  private pickRivalUnderCursor(): string | null {
    const human = this.arenaRuntime.getHumanController();
    if (!human) return null;
    const ray = human.getAimRay(this.ctx.camera);
    const raycaster = new THREE.Raycaster(ray.origin, ray.direction);
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const id of this.othersByDistance("human")) {
      const rig = this.arenaRuntime.rigs.get(id);
      if (!rig) continue;
      const hits = raycaster.intersectObject(rig.root, true);
      if (hits.length > 0 && hits[0].distance < bestDist) {
        bestDist = hits[0].distance;
        bestId = id;
      }
    }
    return bestId;
  }

  private startPass(extraDelay: number, explicitTargetId?: string): void {
    const targetId = explicitTargetId ?? this.nearestOtherParticipant(this.holderId);
    this.phase = "in_flight";
    this.flightFrom.copy(this.holderPosition(this.holderId));
    this.flightTo.copy(this.holderPosition(targetId));
    this.flightTargetId = targetId;
    this.flightT = -extraDelay * 0.6; // delay negativo = espera antes de salir volando
    const dist = this.flightFrom.distanceTo(this.flightTo);
    this.flightDuration = Math.max(0.35, dist / Config.bajoPresion.passSpeed + extraDelay);
    this.ctx.scoreManager.award(this.participant(this.holderId), Config.bajoPresion.points.passBonus, "pase", "bajo_presion");
    this.ctx.audio.balloonPass();
    this.participant(this.holderId).state = "idle";
  }

  private updateFlight(dt: number): void {
    this.flightT += dt;
    const t = THREE.MathUtils.clamp(this.flightT / this.flightDuration, 0, 1);
    if (this.flightT < 0) {
      this.ball.position.copy(this.flightFrom);
      return;
    }
    const pos = this.flightFrom.clone().lerp(this.flightTo, t);
    pos.y += Math.sin(t * Math.PI) * 1.1;
    this.ball.position.copy(pos);

    if (t >= 1) {
      this.holderId = this.flightTargetId;
      this.beginHolding();
    }
  }

  private handleHumanPassInput(): void {
    if (this.holderId !== "human") return;
    const human = this.arenaRuntime.getHumanController();
    if (!human) return;

    if (this.phase === "deciding") {
      const key = human.consumeNumberKey();
      if (key && this.currentSituation) {
        const opt = this.currentSituation.opciones[key - 1];
        if (opt) this.resolveDecision(opt);
      }
      // el click durante la decisión ya lo maneja el panel (botones de UI); nada más que hacer acá.
      human.consumeClick();
      return;
    }

    if (this.phase === "awaiting_pass") {
      const others = this.othersByDistance("human");

      // Teclas 1/2/3 = pasar al rival en esa posición de cercanía (1=más cercano).
      const key = human.consumeNumberKey();
      if (key && others[key - 1]) {
        this.startPass(this.pendingExtraDelay, others[key - 1]);
        return;
      }

      // Click = pasar directamente al rival que está bajo el cursor.
      if (human.consumeClick()) {
        const clicked = this.pickRivalUnderCursor();
        this.startPass(this.pendingExtraDelay, clicked ?? undefined);
        return;
      }

      // E = pasar al más cercano por defecto (tal como pide el brief).
      if (human.consumeInteract()) {
        this.startPass(this.pendingExtraDelay);
      }
    }
  }

  update(dt: number): void {
    if (!this.started || this.finished) return;
    this.timeRemaining -= dt;
    this.hud.setTimer(this.timeRemaining);
    this.chargeSeconds += dt;

    if (this.phase === "deciding" && this.currentSituation) {
      this.decisionTimer -= dt;
      const chargeRatio = Math.min(1, this.chargeSeconds / Config.bajoPresion.baseChargeSeconds);
      this.decisionPanel.setCharge(chargeRatio);

      if (this.holderId !== "human") {
        const traits = this.participant(this.holderId).avatar.traits!;
        if (this.decisionTimer <= Config.bajoPresion.decisionWindowSeconds - Math.max(2.8, traits.decisionDelay)) {
          const actsWell = this.rand() < traits.accuracy;
          const options = this.currentSituation.opciones;
          let pool = options.filter((o) => (actsWell ? o.calidad === "buena" : o.calidad !== "buena"));
          if (pool.length === 0) pool = options;
          // riskTolerance alto -> más probable ir por "mala" (arriesgada) cuando no acierta
          if (!actsWell) {
            const malas = options.filter((o) => o.calidad === "mala");
            const neutras = options.filter((o) => o.calidad === "neutra");
            pool = this.rand() < traits.riskTolerance && malas.length ? malas : neutras.length ? neutras : options;
          }
          const chosen = pool[Math.floor(this.rand() * pool.length)];
          this.resolveDecision(chosen);
        }
      } else if (this.decisionTimer <= 0) {
        const fallback = this.currentSituation.opciones.find((o) => o.calidad === "neutra") ?? this.currentSituation.opciones[0];
        this.resolveDecision(fallback);
      }
    } else if (this.phase === "awaiting_pass") {
      this.passWindowTimer -= dt;
      if (this.passWindowTimer <= 0) {
        this.startPass(this.pendingExtraDelay);
      }
    } else if (this.phase === "in_flight") {
      this.updateFlight(dt);
    }

    this.handleHumanPassInput();
    this.arenaRuntime.update(dt);
    this.ball.rotation.y += dt * 1.5;

    this.hud.setRanking(
      [...this.ctx.participants]
        .sort((a, b) => b.minigameScore - a.minigameScore)
        .map((p, i) => ({ participantId: p.id, name: p.name, score: p.minigameScore, rank: i + 1 })),
      (id) => this.ctx.participants.find((p) => p.id === id)!.avatar.primaryColor
    );

    if (this.timeRemaining <= 0) this.finished = true;
    void this.explosionCount;
    void this.lastHumanPick;
  }

  isFinished(): boolean {
    return this.finished;
  }

  dispose(): void {
    this.decisionPanel.hide();
    this.hud.unmount();
    this.ball.removeFromParent();
    this.arenaRuntime.dispose();
  }
}
