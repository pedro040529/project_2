import * as THREE from "three";
import { gsap } from "gsap";
import { Config } from "../core/Config";
import type { BajoPresionSituation } from "../core/types";
import type { InstructionsSpec, HudHandle, DecisionHandle } from "../core/UIManager";
import type { IMinigame, MinigameContext } from "./IMinigame";
import type { Deck } from "../core/ScenarioManager";
import type { Participant } from "../entities/Participant";
import { ArenaRuntime } from "./common/ArenaRuntime";
import { buildOrbChamber, ORB_SEAT_COLORS } from "../world/ThemedArenas";
import { BurstSystem } from "../world/Burst";
import { OrbCircuit, OrbEnergy } from "../core/OrbCircuit";
import { feedbackFor } from "../data/feedback";
import { mulberry32 } from "../utils/rng";
import { testTimeScale } from "../utils/testHooks";

/**
 * Orbe Inestable. Estados (cada uno tiene salida por tiempo + watchdog: el orbe jamás
 * queda sin dueño ni bloqueado):
 *  holding    — alguien tiene el orbe: el humano responde (15 s) / el bot "piensa"
 *  feedback   — se mostró el resultado de la respuesta; pausa breve de lectura
 *  flight     — el orbe viaja al siguiente participante
 *  roundBreak — el orbe explotó (100 %) o se estabilizó (0 %); pausa y reaparece uno nuevo
 *
 * La energía solo cambia con las decisiones (no hay cronómetro del orbe).
 */
type Phase = "holding" | "feedback" | "flight" | "roundBreak";

const flightEase = gsap.parseEase("power2.inOut");
const COLOR_LOW = new THREE.Color(0x39e1ff);
const COLOR_MID = new THREE.Color(0xffc83d);
const COLOR_HIGH = new THREE.Color(0xff3b3b);
const COLOR_CALM = new THREE.Color(0xbff6ff);

function energyColor(r: number, out: THREE.Color): THREE.Color {
  return r < 0.6 ? out.copy(COLOR_LOW).lerp(COLOR_MID, r / 0.6) : out.copy(COLOR_MID).lerp(COLOR_HIGH, (r - 0.6) / 0.4);
}

export class BajoPresion implements IMinigame {
  readonly id = "bajo_presion" as const;
  readonly title = "Bajo Presión";

  private ctx!: MinigameContext;
  private arenaRuntime!: ArenaRuntime;
  private hud!: HudHandle;
  private panel!: DecisionHandle;

  private orb!: THREE.Group;
  private orbCore!: THREE.Mesh;
  private orbShell!: THREE.Mesh;
  private orbLight!: THREE.PointLight;
  private orbLabelText!: HTMLElement;
  private holderRing!: THREE.Mesh;
  private bursts!: BurstSystem;
  private tmpColor = new THREE.Color();

  private deck!: Deck<BajoPresionSituation>;
  private readonly duration = Config.bajoPresion.durationSeconds * testTimeScale();
  private timeRemaining = this.duration;
  private finished = false;
  private started = false;
  private rand = mulberry32((Date.now() + 999) & 0xffffffff);
  private clock = 0;

  private circuit!: OrbCircuit;
  private energy!: OrbEnergy;
  private phase: Phase = "holding";
  private phaseT = 0;
  private holdLimit = 0;
  private situation: BajoPresionSituation | null = null;
  private answered = false;
  private calmUntil = 0; // brillo tranquilo tras estabilizarse
  private tickTimer = 0;
  private flight = { from: new THREE.Vector3(), to: new THREE.Vector3(), target: "" };
  private pendingBreak: "exploded" | "stabilized" | null = null;
  private lastAnswerer = "";

  async load(ctx: MinigameContext): Promise<void> {
    this.ctx = ctx;
    this.arenaRuntime = new ArenaRuntime(ctx, Config.arena.hotPotatoRadius, buildOrbChamber, 0.68);
    this.hud = ctx.ui.mountHUD();
    this.hud.showPointerHint(null);
    this.hud.setObjective("Responde bien para enfriar el orbe: al 100 % explota, al 0 % se estabiliza.");
    this.panel = ctx.ui.mountDecisionPanel();
    this.bursts = new BurstSystem(this.arenaRuntime.group);
    this.deck = ctx.scenarios.bajoPresionDeck();

    // Vista de escenario: desde atrás y arriba del jugador se ven los 4 puestos y el orbe. En pantallas
    // anchas el panel de preguntas va a la derecha, así que el escenario se corre un poco a la izquierda.
    this.arenaRuntime.stageCamera = (cam) => {
      const sideShift = window.innerWidth >= 1000 ? -3.6 : 0;
      cam.position.set(14, 8.6, sideShift);
      cam.lookAt(4.5, 0.4, sideShift);
    };

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
    this.energy = new OrbEnergy({ initial: Config.bajoPresion.initialEnergy });
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
      id: this.id,
      step: 3,
      title: "Bajo Presión",
      goal: "Todos quedan en su puesto y el Orbe Inestable viaja solo de mano en mano. Cuando te toque, tienes 15 segundos para elegir una de 3 respuestas. Si la energía llega al 100 % explota; si llega a 0 % se estabiliza.",
      rules: [
        { points: "+100", text: "Respuesta correcta · el orbe se enfría 10 %", tone: "good" },
        { points: "−50", text: "Respuesta incorrecta o sin responder · el orbe se calienta 25 %", tone: "bad" },
        { points: "💥", text: "Si explota, quien lo desencadenó pierde puntos extra", tone: "neutral" }
      ],
      controls: [
        { key: "1-3", label: "Elegir la respuesta (o clic en ella tras pulsar Esc)" },
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
    return Math.min(1, Math.max(0, this.energy.ratio));
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

  private holderLabel(id: string): string {
    return id === "human" ? "Tú" : this.participant(id).name;
  }

  private snapOrbToHolder(): void {
    this.orb.position.copy(this.holderAnchor(this.circuit.holderId));
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
    this.arenaRuntime.rigs.get(id)?.character.setHoldingOrb(true);
    gsap.fromTo(this.orb.scale, { x: 1.5, y: 0.7, z: 1.5 }, { x: 1, y: 1, z: 1, duration: 0.45, ease: "elastic.out(1, 0.5)" });

    this.situation = this.deck.draw();
    if (id === "human") {
      this.holdLimit = Config.bajoPresion.decisionSeconds;
      const sit = this.situation;
      this.panel.show(`${sit.remitente} te escribe`, sit.pregunta, sit.opciones.map((o) => o.texto), (i) => this.resolve(i));
      this.panel.setTimeLeft(1, this.holdLimit);
    } else {
      // los bots tardan según su personalidad (Pixel analiza más; Nova se precipita)
      const cfg = Config.bajoPresion.npcThinkSeconds;
      const traits = holder.avatar.traits!;
      const k = Math.min(1, traits.decisionDelay / 3.2);
      this.holdLimit = cfg.min + (cfg.max - cfg.min) * k * 0.8 + this.rand() * 0.8;
      this.panel.showStatus(`${holder.name} tiene el orbe y está decidiendo…`);
      this.panel.setTimeLeft(null);
    }
    this.panel.setEnergy(this.energy.value);
  }

  /** Respuesta del jugador en turno (índice 0..2) o `null` si se acabó el tiempo. */
  private resolve(index: number | null): void {
    if (this.phase !== "holding" || this.answered || !this.situation) return;
    this.answered = true;
    const sit = this.situation;
    const holderId = this.circuit.holderId;
    const holder = this.participant(holderId);
    const isHuman = holderId === "human";
    const correctIndex = sit.opciones.findIndex((o) => o.id === sit.correcta);
    const correct = index !== null && index === correctIndex;
    const cfg = Config.bajoPresion;
    const points = correct ? cfg.points.correcta : index === null ? cfg.points.sinRespuesta : cfg.points.incorrecta;
    const delta = correct ? cfg.energyOnCorrect : index === null ? cfg.energyOnTimeout : cfg.energyOnWrong;
    this.lastAnswerer = holderId;

    this.ctx.scoreManager.award(holder, points, `${sit.id}:${index === null ? "timeout" : sit.opciones[index].id}`, "bajo_presion");
    if (isHuman) this.ctx.summary.recordPressureDecision(correct ? "buena" : "mala");
    const status = this.energy.apply(delta);
    this.panel.setEnergy(this.energy.value);

    const rig = this.arenaRuntime.rigs.get(holderId);
    if (correct) {
      rig?.character.triggerReaction("celebrate", 0.9);
      this.ctx.audio.feedbackGood();
      this.bursts.emit(this.orb.position.clone(), 0x8dff6a, 22, 3.5);
    } else {
      rig?.character.triggerReaction("lose", 0.9);
      this.ctx.audio.feedbackBad();
    }
    const fmt = (n: number) => `${n > 0 ? "+" : ""}${n}`;
    this.hud.showRivalPing(this.holderLabel(holderId), fmt(points));

    if (isHuman) {
      const head = index === null ? "⏱ Se acabó el tiempo" : correct ? "✔ Correcto" : "✖ Incorrecto";
      this.panel.reveal(correctIndex, index, `${head} (${fmt(points)}) · ${feedbackFor(sit.categoria, correct)}`);
      this.panel.setTimeLeft(null);
    } else {
      this.panel.showStatus(`${holder.name} ${correct ? "acertó" : "falló"} (${fmt(points)})`);
    }

    if (status === "exploded" || status === "stabilized") {
      this.pendingBreak = status;
      this.setPhase("feedback"); // se lee el resultado y luego entra la pausa de ronda
    } else {
      this.pendingBreak = null;
      this.setPhase("feedback");
    }
  }

  private resolveNpc(): void {
    const sit = this.situation;
    if (!sit) return;
    const traits = this.participant(this.circuit.holderId).avatar.traits!;
    // la precisión baja un poco con la dificultad; los bots no "saben" la respuesta de antemano
    const acc = Math.max(0.2, traits.accuracy - 0.1 * (sit.dificultad - 1));
    const correctIndex = sit.opciones.findIndex((o) => o.id === sit.correcta);
    let pick = correctIndex;
    if (this.rand() >= acc) {
      const wrong = [0, 1, 2].filter((i) => i !== correctIndex);
      pick = wrong[Math.floor(this.rand() * wrong.length)];
    }
    this.resolve(pick);
  }

  // ---------------- feedback → flight / round break ----------------

  private feedbackDone(): void {
    if (this.pendingBreak) this.beginRoundBreak(this.pendingBreak);
    else this.startFlight();
  }

  private beginRoundBreak(kind: "exploded" | "stabilized"): void {
    const cfg = Config.bajoPresion.points;
    const responsibleId = this.lastAnswerer || this.circuit.holderId;
    const responsible = this.participant(responsibleId);
    this.pendingBreak = null;
    this.panel.setTimeLeft(null);
    this.arenaRuntime.rigs.get(this.circuit.holderId)?.character.setHoldingOrb(false);
    if (kind === "exploded") {
      this.ctx.scoreManager.award(responsible, cfg.explosionExtra, "explosion", "bajo_presion");
      this.ctx.audio.explosion();
      this.bursts.emit(this.orb.position.clone(), 0xff5a3b, 60, 8, 1.6);
      this.bursts.emit(this.orb.position.clone(), 0xffc83d, 40, 5, 1.2);
      this.arenaRuntime.rigs.get(responsibleId)?.character.triggerReaction("lose", 1.4);
      responsible.state = "losing";
      this.panel.showStatus(`💥 ¡El orbe explotó en manos de ${this.holderLabel(responsibleId)}! (${cfg.explosionExtra} extra)`);
      this.hud.showRivalPing(this.holderLabel(responsibleId), `${cfg.explosionExtra}`);
      this.orb.visible = false;
    } else {
      this.ctx.scoreManager.award(responsible, cfg.estabilizacionBono, "estabilizacion", "bajo_presion");
      this.ctx.audio.victory();
      this.bursts.emit(this.orb.position.clone(), 0xbff6ff, 50, 4, 1.2);
      this.arenaRuntime.rigs.get(responsibleId)?.character.triggerReaction("celebrate", 1.6);
      this.panel.showStatus(`✨ ¡El orbe se estabilizó! ${this.holderLabel(responsibleId)} lo enfrió (+${cfg.estabilizacionBono})`);
      this.hud.showRivalPing(this.holderLabel(responsibleId), `+${cfg.estabilizacionBono}`);
      this.calmUntil = this.clock + Config.bajoPresion.roundBreakSeconds;
    }
    this.panel.setEnergy(this.energy.value);
    this.holderRing.visible = false;
    this.setPhase("roundBreak");
  }

  private endRoundBreak(): void {
    this.arenaRuntime.rigs.get(this.circuit.holderId)?.character.setHoldingOrb(false);
    this.participant(this.circuit.holderId).state = "idle";
    this.energy.reset();
    this.circuit.respawn();
    this.orb.visible = true;
    this.beginHolding();
  }

  private startFlight(): void {
    const fromId = this.circuit.holderId;
    const targetId = this.circuit.chooseNext();
    this.participant(fromId).state = "idle";
    this.arenaRuntime.rigs.get(fromId)?.character.triggerThrow();
    this.flight.from.copy(this.orb.position);
    this.flight.to.copy(this.holderAnchor(targetId));
    this.flight.target = targetId;
    this.arenaRuntime.rigs.get(fromId)?.lookAt(this.flight.to);
    this.panel.showStatus(`El orbe viaja hacia ${this.holderLabel(targetId)}…`);
    this.ctx.audio.balloonPass();
    this.setPhase("flight");
  }

  private updateFlight(): void {
    const t = Math.min(1, this.phaseT / Config.bajoPresion.flightSeconds);
    const e = flightEase(t);
    this.orb.position.copy(this.flight.from).lerp(this.flight.to, e);
    this.orb.position.y += Math.sin(e * Math.PI) * 1.4;
    if (t >= 1) {
      this.arenaRuntime.rigs.get(this.circuit.holderId)?.lookAt(new THREE.Vector3(0, 0, 0));
      this.circuit.arrive(this.flight.target);
      this.beginHolding();
    }
  }

  // ---------------- frame ----------------

  update(dt: number): void {
    if (!this.started || this.finished) return;
    this.clock += dt;
    this.timeRemaining -= dt;
    this.hud.setTimer(this.timeRemaining);
    this.phaseT += dt;
    const isHumanTurn = this.circuit.holderId === "human";

    switch (this.phase) {
      case "holding":
        if (isHumanTurn) {
          const left = Math.max(0, this.holdLimit - this.phaseT);
          this.panel.setTimeLeft(left / this.holdLimit, left);
          this.handleHumanInput();
          if (this.phaseT >= this.holdLimit) this.resolve(null);
        } else if (this.phaseT >= this.holdLimit) {
          this.resolveNpc();
        }
        break;
      case "feedback": {
        const wait = isHumanTurn ? Config.bajoPresion.feedbackSeconds : Config.bajoPresion.npcFeedbackSeconds;
        if (this.phaseT >= wait) this.feedbackDone();
        break;
      }
      case "flight":
        this.updateFlight();
        break;
      case "roundBreak":
        if (this.phaseT >= Config.bajoPresion.roundBreakSeconds) this.endRoundBreak();
        break;
    }

    // Watchdog: ningún estado puede durar más de lo razonable (el orbe jamás se bloquea).
    if (this.phaseT > Config.bajoPresion.decisionSeconds + 12) {
      if (this.phase === "roundBreak") this.endRoundBreak();
      else if (this.phase === "flight") {
        this.circuit.arrive(this.flight.target);
        this.beginHolding();
      } else if (this.phase === "holding") this.answered ? this.feedbackDone() : this.resolve(null);
      else this.feedbackDone();
    }

    this.updateOrbVisuals(dt);
    this.bursts.update(dt);
    this.arenaRuntime.update(dt);

    this.hud.setRanking(
      [...this.ctx.participants]
        .sort((a, b) => b.minigameScore - a.minigameScore)
        .map((p, i) => ({ participantId: p.id, name: p.name, score: p.minigameScore, rank: i + 1 })),
      (id) => this.ctx.participants.find((p) => p.id === id)!.avatar.primaryColor
    );

    // El tiempo agotado cierra la partida en un corte limpio (nunca a mitad de la decisión del humano).
    if (this.timeRemaining <= 0) {
      const humanBusy = isHumanTurn && (this.phase === "holding" || this.phase === "feedback");
      if (!humanBusy || this.timeRemaining < -(Config.bajoPresion.decisionSeconds + 4)) this.finished = true;
    }
  }

  private handleHumanInput(): void {
    const human = this.arenaRuntime.getHumanController();
    if (!human || !this.situation || this.answered) return;
    const key = human.consumeNumberKey();
    if (key && this.situation.opciones[key - 1]) this.resolve(key - 1);
    human.consumeClick();
  }

  private updateOrbVisuals(dt: number): void {
    const r = this.energy.ratio;
    if (this.phase !== "flight") {
      const base = this.holderAnchor(this.circuit.holderId);
      base.y += Math.sin(this.clock * 3) * 0.08;
      if (r > 0.75) {
        const shake = (r - 0.75) * 0.5;
        base.x += (this.rand() - 0.5) * shake;
        base.z += (this.rand() - 0.5) * shake;
      }
      if (this.phase !== "roundBreak") this.orb.position.copy(base);
    }
    const calm = this.clock < this.calmUntil;
    const col = calm ? this.tmpColor.copy(COLOR_CALM) : energyColor(r, this.tmpColor);
    const mat = this.orbCore.material as THREE.MeshStandardMaterial;
    mat.color.copy(col);
    mat.emissive.copy(col);
    mat.emissiveIntensity = calm ? 0.9 : 0.7 + r * 1.5;
    (this.orbShell.material as THREE.MeshBasicMaterial).color.copy(col);
    this.orbLight.color.copy(col);
    this.orbLight.intensity = calm ? 4 : 3 + r * 15;
    const pulse = 1 + r * 0.4 + Math.sin(this.clock * (3 + r * 15)) * (0.03 + r * 0.1);
    this.orbCore.scale.setScalar(calm ? 0.9 : pulse);
    this.orbShell.rotation.y += dt * (0.8 + r * 6);
    this.orbShell.rotation.x += dt * (0.5 + r * 4);
    this.orbLabelText.textContent = `${this.holderLabel(this.circuit.holderId)} · ${Math.round(this.energy.value)} %`;

    const hp = this.participant(this.circuit.holderId).position;
    this.holderRing.position.set(hp[0], 0.16, hp[2]);
    (this.holderRing.material as THREE.MeshBasicMaterial).color.setHex(this.seatColor(this.circuit.holderId));
    this.holderRing.scale.setScalar(1 + Math.sin(this.clock * 6) * 0.06);
    this.holderRing.visible = this.phase === "holding" || this.phase === "feedback";

    // pulso de tensión: más rápido y agudo cuanta más energía tiene el orbe
    if (this.phase !== "roundBreak") {
      this.tickTimer -= dt;
      if (this.tickTimer <= 0) {
        this.ctx.audio.tensionTick(r);
        this.tickTimer = 1.1 - 0.9 * r;
      }
    }
  }

  isFinished(): boolean {
    return this.finished;
  }

  dispose(): void {
    this.panel.hide();
    this.hud.unmount();
    this.bursts.dispose();
    this.orb.removeFromParent();
    this.orbLabelText.parentElement?.remove();
    this.arenaRuntime.dispose();
  }
}
