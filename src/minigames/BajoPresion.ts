import * as THREE from "three";
import { gsap } from "gsap";
import { Config } from "../core/Config";
import type { PressureOption, PressureSituationDef } from "../core/types";
import type { InstructionsSpec, HudHandle, DecisionHandle } from "../core/UIManager";
import type { IMinigame, MinigameContext } from "./IMinigame";
import type { Participant } from "../entities/Participant";
import { ArenaRuntime } from "./common/ArenaRuntime";
import { buildOrbChamber, ORB_SEAT_COLORS } from "../world/ThemedArenas";
import { BurstSystem } from "../world/Burst";
import { OrbCharge, OrbCircuit } from "../core/OrbCircuit";
import { mulberry32 } from "../utils/rng";

/**
 * Estados claros del orbe (nunca queda sin dueño ni bloqueado: cada estado
 * tiene una salida por tiempo y un watchdog general lo fuerza si algo falla).
 *  holding   — alguien tiene el orbe (NPC simula decisión, humano responde)
 *  feedback  — el humano ya respondió; se muestra el resultado un instante
 *  flight    — el orbe viaja al siguiente participante
 *  exploding — el orbe explotó en manos del holder; pausa y reaparece
 */
type Phase = "holding" | "feedback" | "flight" | "exploding";

const flightEase = gsap.parseEase("power2.inOut");
const WATCHDOG_SECONDS = 14;
const COLOR_LOW = new THREE.Color(0x39e1ff);
const COLOR_MID = new THREE.Color(0xffc83d);
const COLOR_HIGH = new THREE.Color(0xff3b3b);

function chargeColor(c: number, out: THREE.Color): THREE.Color {
  return c < 0.6 ? out.copy(COLOR_LOW).lerp(COLOR_MID, c / 0.6) : out.copy(COLOR_MID).lerp(COLOR_HIGH, (c - 0.6) / 0.4);
}

export class BajoPresion implements IMinigame {
  readonly id = "bajo_presion" as const;
  readonly title = "Bajo Presión";

  private ctx!: MinigameContext;
  private arenaRuntime!: ArenaRuntime;
  private hud!: HudHandle;
  private decisionPanel!: DecisionHandle;

  private orb!: THREE.Group;
  private orbCore!: THREE.Mesh;
  private orbShell!: THREE.Mesh;
  private orbLight!: THREE.PointLight;
  private orbLabelText!: HTMLElement;
  private holderRing!: THREE.Mesh;
  private bursts!: BurstSystem;

  private humanSituations: PressureSituationDef[] = [];
  private humanCursor = 0;
  private timeRemaining = Config.bajoPresion.durationSeconds;
  private finished = false;
  private started = false;
  private rand = mulberry32((Date.now() + 999) & 0xffffffff);
  private clock = 0;
  private tmpColor = new THREE.Color();

  private circuit!: OrbCircuit;
  private charge!: OrbCharge;
  private phase: Phase = "holding";
  private phaseT = 0;
  private holdLimit = 0;
  private situation: PressureSituationDef | null = null;
  private answered = false;
  private tickTimer = 0;
  private flight = { from: new THREE.Vector3(), to: new THREE.Vector3(), target: "" };

  async load(ctx: MinigameContext): Promise<void> {
    this.ctx = ctx;
    this.arenaRuntime = new ArenaRuntime(ctx, Config.arena.hotPotatoRadius, buildOrbChamber, 0.68);
    this.hud = ctx.ui.mountHUD();
    this.hud.showPointerHint(null);
    this.hud.setObjective("El orbe pasa de jugador en jugador. Cuando lo recibes, elige bien antes de que se agote el tiempo: puede explotar en cualquier mano.");
    this.decisionPanel = ctx.ui.mountDecisionPanel();
    this.bursts = new BurstSystem(this.arenaRuntime.group);

    this.humanSituations = ctx.scenarios.drawPressureSequence(Config.bajoPresion.situationsPerMatch);

    // Cada quien se queda en su puesto mirando al centro: el orbe viaja, los jugadores no.
    const center = new THREE.Vector3(0, 0, 0);
    for (const rig of this.arenaRuntime.rigs.values()) {
      rig.movementLocked = true;
      rig.lookAt(center);
    }

    this.buildOrb();
    this.holderRing = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.05, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd23c, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    this.holderRing.rotation.x = -Math.PI / 2;
    this.holderRing.position.y = 0.16;
    this.arenaRuntime.group.add(this.holderRing);

    this.circuit = new OrbCircuit({
      ids: ctx.participants.map((p) => p.id),
      humanId: "human",
      maxNpcHolds: Config.bajoPresion.maxNpcHolds,
      rand: this.rand
    });
    this.circuit.holderId = ctx.participants[Math.floor(this.rand() * ctx.participants.length)].id;
    this.charge = new OrbCharge({
      minFuseSeconds: Config.bajoPresion.minFuseSeconds,
      maxFuseSeconds: Config.bajoPresion.maxFuseSeconds,
      rand: this.rand
    });
    this.snapOrbToHolder();
  }

  private buildOrb(): void {
    this.orb = new THREE.Group();
    this.orbCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 24, 20),
      new THREE.MeshStandardMaterial({ color: 0x39e1ff, emissive: 0x39e1ff, emissiveIntensity: 2.2, roughness: 0.2 })
    );
    this.orbShell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.7 })
    );
    this.orbLight = new THREE.PointLight(0x39e1ff, 6, 9, 2);
    this.orb.add(this.orbCore, this.orbShell, this.orbLight);
    const label = this.ctx.labelRenderer.createLabel("ORBE", "");
    label.position.set(0, 0.95, 0);
    this.orbLabelText = label.element.lastChild as HTMLElement;
    this.orb.add(label);
    this.arenaRuntime.group.add(this.orb);
  }

  getInstructions(): InstructionsSpec {
    return {
      title: "Bajo Presión",
      goal: "Todos quedan en su puesto y el orbe viaja solo de mano en mano. Cuando te toque, elige la mejor de 3 acciones: acertar suma puntos y calma el orbe. Puede explotar en cualquier mano, ¡no te lo quedes!",
      controls: [
        { key: "1-3", label: "Elegir la acción (o clic en el botón con Esc)" },
        { key: "Mouse", label: "Mover para mirar alrededor" }
      ]
    };
  }

  start(): void {
    this.started = true;
    this.ctx.audio.playMinigameMusic(() => this.musicIntensity());
    this.beginHolding();
  }

  private musicIntensity(): number {
    const ratio = 1 - this.timeRemaining / Config.bajoPresion.durationSeconds;
    return Math.min(1, Math.max(0, (ratio - 0.65) / 0.35));
  }

  private participant(id: string): Participant {
    return this.ctx.participants.find((p) => p.id === id)!;
  }

  private seatColor(id: string): number {
    const i = this.ctx.participants.findIndex((p) => p.id === id);
    return ORB_SEAT_COLORS[Math.max(0, i) % ORB_SEAT_COLORS.length];
  }

  private holderAnchor(id: string): THREE.Vector3 {
    const p = this.participant(id).position;
    return new THREE.Vector3(p[0], 2.0, p[2]);
  }

  private snapOrbToHolder(): void {
    this.orb.position.copy(this.holderAnchor(this.circuit.holderId));
    this.orbLabelText.textContent = this.holderLabel(this.circuit.holderId);
  }

  private holderLabel(id: string): string {
    return id === "human" ? "Tú" : this.participant(id).name;
  }

  private nextHumanSituation(): PressureSituationDef {
    if (this.humanCursor >= this.humanSituations.length) this.humanCursor = 0;
    return this.humanSituations[this.humanCursor++];
  }

  private randomSituation(): PressureSituationDef {
    const all = this.ctx.scenarios.getAllPressureSituations();
    return all[Math.floor(this.rand() * all.length)];
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseT = 0;
  }

  // ---------------- holding ----------------

  private beginHolding(): void {
    const id = this.circuit.holderId;
    const holder = this.participant(id);
    this.setPhase("holding");
    this.answered = false;
    this.snapOrbToHolder();
    this.ctx.audio.orbCatch();
    holder.state = "deciding";
    gsap.fromTo(this.orb.scale, { x: 1.5, y: 0.7, z: 1.5 }, { x: 1, y: 1, z: 1, duration: 0.45, ease: "elastic.out(1, 0.5)" });

    if (id === "human") {
      this.situation = this.nextHumanSituation();
      this.holdLimit = Config.bajoPresion.decisionWindowSeconds;
      this.decisionPanel.update(this.situation.texto, this.situation.opciones, (opt) => this.resolveHuman(opt));
      this.decisionPanel.setTimeLeft(1);
    } else {
      this.situation = this.randomSituation();
      const cfg = Config.bajoPresion.npcHoldSeconds;
      const traits = holder.avatar.traits!;
      this.holdLimit = cfg.min + (cfg.max - cfg.min) * Math.min(1, traits.decisionDelay / 3.2) * 0.7 + this.rand() * 0.35;
      this.decisionPanel.update(`${holder.name} tiene el orbe…`, [], () => {});
      this.decisionPanel.setTimeLeft(null);
    }
  }

  private pointsFor(opt: PressureOption): number {
    const pts = Config.bajoPresion.points;
    return opt.calidad === "buena" ? pts.buenaDecision : opt.calidad === "mala" ? pts.malaDecision : pts.neutra;
  }

  private resolveHuman(opt: PressureOption | null): void {
    if (this.phase !== "holding" || this.answered || !this.situation) return;
    this.answered = true;
    const human = this.participant("human");
    const timedOut = opt === null;
    const points = timedOut ? Config.bajoPresion.points.tiempoAgotado : this.pointsFor(opt);
    this.ctx.scoreManager.award(human, points, `${this.situation.scenarioID}:${opt?.id ?? "timeout"}`, "bajo_presion");
    this.ctx.summary.recordPressureDecision(timedOut ? "mala" : opt.calidad);

    const good = !timedOut && opt.calidad === "buena";
    const rig = this.arenaRuntime.rigs.get("human");
    if (good) {
      rig?.character.triggerReaction("celebrate", 0.9);
      this.charge.stabilize(Config.bajoPresion.stabilizeOnGood);
      this.ctx.audio.feedbackGood();
      this.bursts.emit(this.orb.position.clone(), 0x8dff6a, 22, 3.5);
    } else {
      rig?.character.triggerReaction("lose", 0.9);
      this.ctx.audio.feedbackBad();
    }
    const head = timedOut ? "⏱ Se acabó el tiempo" : good ? "✔ Buena decisión" : opt.calidad === "neutra" ? "• Decisión segura, pero había una mejor" : "✖ Cuidado";
    this.hud.showEventBanner(`${head} (${points > 0 ? "+" : ""}${points}): ${this.situation.explicacion}`, 4200);
    this.hud.showRivalPing("Tú", `${points > 0 ? "+" : ""}${points}`);

    this.decisionPanel.update(`${head}. El orbe sigue su camino…`, [], () => {});
    this.decisionPanel.setTimeLeft(null);
    this.setPhase("feedback");
  }

  private resolveNpc(): void {
    const holder = this.participant(this.circuit.holderId);
    const sit = this.situation;
    if (!sit) return;
    const traits = holder.avatar.traits!;
    // precisión baja un poco con la dificultad; los NPC no "saben" la respuesta de antemano
    const acc = Math.max(0.15, traits.accuracy - 0.1 * (sit.dificultad - 1));
    let pool: PressureOption[];
    if (this.rand() < acc) {
      pool = sit.opciones.filter((o) => o.calidad === "buena");
    } else {
      const malas = sit.opciones.filter((o) => o.calidad === "mala");
      const neutras = sit.opciones.filter((o) => o.calidad === "neutra");
      pool = this.rand() < traits.riskTolerance && malas.length ? malas : neutras.length ? neutras : sit.opciones;
    }
    if (pool.length === 0) pool = sit.opciones;
    const opt = pool[Math.floor(this.rand() * pool.length)];
    const points = this.pointsFor(opt);
    this.ctx.scoreManager.award(holder, points, `${sit.scenarioID}:${opt.id}`, "bajo_presion");
    const rig = this.arenaRuntime.rigs.get(holder.id);
    if (opt.calidad === "buena") {
      rig?.character.triggerReaction("celebrate", 0.7);
      this.charge.stabilize(Config.bajoPresion.stabilizeOnGood * 0.5);
    } else if (opt.calidad === "mala") {
      rig?.character.triggerReaction("lose", 0.7);
    }
    if (points !== 0) this.hud.showRivalPing(holder.name, `${points > 0 ? "+" : ""}${points}`);
    this.startFlight();
  }

  // ---------------- flight / explosion ----------------

  private startFlight(): void {
    const fromId = this.circuit.holderId;
    const targetId = this.circuit.chooseNext();
    this.participant(fromId).state = "idle";
    this.flight.from.copy(this.orb.position);
    this.flight.to.copy(this.holderAnchor(targetId));
    this.flight.target = targetId;
    this.arenaRuntime.rigs.get(fromId)?.lookAt(this.flight.to);
    this.decisionPanel.hide();
    this.ctx.audio.balloonPass();
    this.setPhase("flight");
  }

  private updateFlight(): void {
    const dur = Config.bajoPresion.flightSeconds;
    const t = Math.min(1, this.phaseT / dur);
    const e = flightEase(t);
    this.orb.position.copy(this.flight.from).lerp(this.flight.to, e);
    this.orb.position.y += Math.sin(e * Math.PI) * 1.4;
    if (t >= 1) {
      const prevId = this.circuit.holderId;
      this.arenaRuntime.rigs.get(prevId)?.lookAt(new THREE.Vector3(0, 0, 0));
      this.circuit.arrive(this.flight.target);
      this.beginHolding();
    }
  }

  private explode(): void {
    const id = this.circuit.holderId;
    const holder = this.participant(id);
    this.ctx.scoreManager.award(holder, Config.bajoPresion.points.explosionPenalty, "explosion", "bajo_presion");
    this.ctx.audio.explosion();
    this.bursts.emit(this.orb.position.clone(), 0xff5a3b, 60, 8, 1.6);
    this.bursts.emit(this.orb.position.clone(), 0xffc83d, 40, 5, 1.2);
    this.arenaRuntime.rigs.get(id)?.character.triggerReaction("lose", 1.2);
    holder.state = "losing";
    this.decisionPanel.update(`💥 ¡El orbe explotó en manos de ${this.holderLabel(id)}! (${Config.bajoPresion.points.explosionPenalty})`, [], () => {});
    this.decisionPanel.setTimeLeft(null);
    this.hud.showRivalPing(holder.name, `${Config.bajoPresion.points.explosionPenalty}`);
    this.orb.visible = false;
    this.holderRing.visible = false;
    this.setPhase("exploding");
  }

  private finishExplosion(): void {
    this.participant(this.circuit.holderId).state = "idle";
    this.charge.reset();
    this.circuit.respawn();
    this.orb.visible = true;
    this.beginHolding();
  }

  // ---------------- frame ----------------

  update(dt: number): void {
    if (!this.started || this.finished) return;
    this.clock += dt;
    this.timeRemaining -= dt;
    this.hud.setTimer(this.timeRemaining);
    this.phaseT += dt;

    // La carga solo avanza mientras el orbe no esté explotando.
    if (this.phase !== "exploding") this.charge.tick(dt);
    const c = this.charge.value;

    switch (this.phase) {
      case "holding": {
        this.decisionPanel.setCharge(c);
        if (this.circuit.holderId === "human") {
          this.decisionPanel.setTimeLeft(1 - this.phaseT / this.holdLimit);
          this.handleHumanInput();
          if (this.phaseT >= this.holdLimit) this.resolveHuman(null);
        } else if (this.phaseT >= this.holdLimit) {
          this.resolveNpc();
        }
        // explota en cualquier mano, sin importar si las respuestas fueron buenas o malas
        if (this.phase === "holding" && this.charge.exploded && this.phaseT > 0.35) this.explode();
        break;
      }
      case "feedback":
        this.decisionPanel.setCharge(c);
        if (this.charge.exploded) this.explode();
        else if (this.phaseT >= Config.bajoPresion.feedbackSeconds) this.startFlight();
        break;
      case "flight":
        this.updateFlight();
        break;
      case "exploding":
        if (this.phaseT >= Config.bajoPresion.explosionPauseSeconds) this.finishExplosion();
        break;
    }

    // Watchdog: ningún estado puede durar más de lo razonable (el orbe jamás se bloquea).
    if (this.phaseT > WATCHDOG_SECONDS) {
      if (this.phase === "exploding") this.finishExplosion();
      else if (this.phase === "flight") {
        this.circuit.arrive(this.flight.target);
        this.beginHolding();
      } else this.startFlight();
    }

    this.updateOrbVisuals(dt, c);
    this.bursts.update(dt);
    this.arenaRuntime.update(dt);

    this.hud.setRanking(
      [...this.ctx.participants]
        .sort((a, b) => b.minigameScore - a.minigameScore)
        .map((p, i) => ({ participantId: p.id, name: p.name, score: p.minigameScore, rank: i + 1 })),
      (id) => this.ctx.participants.find((p) => p.id === id)!.avatar.primaryColor
    );

    if (this.timeRemaining <= 0) this.finished = true;
  }

  private handleHumanInput(): void {
    const human = this.arenaRuntime.getHumanController();
    if (!human || !this.situation || this.answered) return;
    const key = human.consumeNumberKey();
    if (key) {
      const opt = this.situation.opciones[key - 1];
      if (opt) this.resolveHuman(opt);
    }
    human.consumeClick();
  }

  private updateOrbVisuals(dt: number, c: number): void {
    if (this.phase !== "flight" && this.phase !== "exploding") {
      const base = this.holderAnchor(this.circuit.holderId);
      base.y += Math.sin(this.clock * 3) * 0.08;
      if (c > 0.7) {
        const shake = (c - 0.7) * 0.25;
        base.x += (this.rand() - 0.5) * shake;
        base.z += (this.rand() - 0.5) * shake;
      }
      this.orb.position.copy(base);
    }
    const col = chargeColor(c, this.tmpColor);
    (this.orbCore.material as THREE.MeshStandardMaterial).color.copy(col);
    (this.orbCore.material as THREE.MeshStandardMaterial).emissive.copy(col);
    (this.orbCore.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 + c * 3.4;
    (this.orbShell.material as THREE.MeshBasicMaterial).color.copy(col);
    this.orbLight.color.copy(col);
    this.orbLight.intensity = 4 + c * 14;
    const pulse = 1 + c * 0.35 + Math.sin(this.clock * (4 + c * 16)) * (0.04 + c * 0.1);
    this.orbCore.scale.setScalar(pulse);
    this.orbShell.rotation.y += dt * (1 + c * 6);
    this.orbShell.rotation.x += dt * (0.6 + c * 4);

    const hp = this.participant(this.circuit.holderId).position;
    this.holderRing.position.set(hp[0], 0.16, hp[2]);
    (this.holderRing.material as THREE.MeshBasicMaterial).color.setHex(this.seatColor(this.circuit.holderId));
    this.holderRing.scale.setScalar(1 + Math.sin(this.clock * 6) * 0.06);
    this.holderRing.visible = this.phase === "holding" || this.phase === "feedback";

    // pulso de tensión: más rápido y agudo con la carga
    if (this.phase === "holding" || this.phase === "feedback" || this.phase === "flight") {
      this.tickTimer -= dt;
      if (this.tickTimer <= 0) {
        this.ctx.audio.tensionTick(c);
        this.tickTimer = 0.95 - 0.8 * c;
      }
    }
  }

  isFinished(): boolean {
    return this.finished;
  }

  dispose(): void {
    this.decisionPanel.hide();
    this.hud.unmount();
    this.bursts.dispose();
    this.orb.removeFromParent();
    this.orbLabelText.parentElement?.remove();
    this.arenaRuntime.dispose();
  }
}
