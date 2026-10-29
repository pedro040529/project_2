import * as THREE from "three";
import { gsap } from "gsap";
import { Config } from "../core/Config";
import type { AtrapaSituation } from "../core/types";
import type { InstructionsSpec, HudHandle } from "../core/UIManager";
import type { IMinigame, MinigameContext } from "./IMinigame";
import type { Deck } from "../core/ScenarioManager";
import { ArenaRuntime } from "./common/ArenaRuntime";
import { AIController } from "../entities/controllers/AIController";
import { buildRewardPlaza } from "../world/ThemedArenas";
import { BurstSystem } from "../world/Burst";
import { feedbackFor } from "../data/feedback";
import { mulberry32 } from "../utils/rng";
import { testTimeScale } from "../utils/testHooks";

interface Slot {
  position: THREE.Vector3;
  filled: boolean;
  cooldown: number;
  current: AtrapaSituation | null;
  mesh: THREE.Group | null;
  label: ReturnType<import("../world/LabelRenderer").LabelRenderer["createLabel"]> | null;
  wobble: number;
}

function rewardMesh(): THREE.Group {
  // Cubo de datos idéntico para TODAS las situaciones (RNF06): nada en su aspecto
  // delata si recogerlo conviene; solo el mensaje permite evaluarlo.
  const g = new THREE.Group();
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xdfe8ff, emissive: 0x6f8bff, emissiveIntensity: 1.1, roughness: 0.25, metalness: 0.2 })
  );
  cube.position.y = 0.7;
  cube.rotation.set(0.5, 0.4, 0);
  cube.castShadow = true;
  g.add(cube);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 8, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.2;
  g.add(ring);
  return g;
}

/** Distancia (al jugador) a partir de la cual el mensaje se resume en el remitente. */
const READ_DISTANCE = 13;

export class AtrapaOEvita implements IMinigame {
  readonly id = "atrapa_o_evita" as const;
  readonly title = "Atrapa o Evita";

  private ctx!: MinigameContext;
  private arenaRuntime!: ArenaRuntime;
  private hud!: HudHandle;
  private deck!: Deck<AtrapaSituation>;
  private slots: Slot[] = [];
  private readonly duration = Config.atrapaOEvita.durationSeconds * testTimeScale();
  private timeRemaining = this.duration;
  private finished = false;
  private started = false;
  private rand = mulberry32(Date.now() & 0xffffffff);
  private aiTimers = new Map<string, number>();
  private aiTargets = new Map<string, Slot>();
  private bursts!: BurstSystem;
  private rainsTriggered = 0;
  private labelTick = 0;

  async load(ctx: MinigameContext): Promise<void> {
    this.ctx = ctx;
    this.arenaRuntime = new ArenaRuntime(ctx, Config.arena.sharedRadius, buildRewardPlaza);
    this.bursts = new BurstSystem(this.arenaRuntime.group);
    this.hud = ctx.ui.mountHUD();
    this.hud.setObjective("Acércate a los mensajes para leerlos. Toca los que sean seguros; evita los sospechosos.");
    this.deck = ctx.scenarios.atrapaDeck();
    this.buildSlots();
    this.hud.showEventBanner("Plaza de Recompensas: lee cada mensaje antes de llevártelo.", 4000);
  }

  private buildSlots(): void {
    const n = Config.atrapaOEvita.simultaneous;
    const radius = this.arenaRuntime.arena.radius;
    const ringRadii = [radius * 0.28, radius * 0.48, radius * 0.66, radius * 0.8];
    const perRing = Math.ceil(n / ringRadii.length);
    let made = 0;
    ringRadii.forEach((r, ringIdx) => {
      const count = Math.min(perRing, n - made);
      const angleOffset = this.rand() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        const angle = angleOffset + (i / count) * Math.PI * 2 + (ringIdx % 2 === 0 ? 0.18 : -0.18);
        const jitter = (this.rand() - 0.5) * (radius * 0.05);
        const pos = new THREE.Vector3(Math.cos(angle) * (r + jitter), 0, Math.sin(angle) * (r + jitter));
        this.slots.push({ position: pos, filled: false, cooldown: this.rand() * 1.5, current: null, mesh: null, label: null, wobble: this.rand() * 10 });
        made++;
      }
    });
  }

  private fillSlot(slot: Slot): void {
    // nunca dos veces la misma situación a la vez
    let sit = this.deck.draw();
    for (let tries = 0; tries < 6 && this.slots.some((s) => s.current?.id === sit.id); tries++) sit = this.deck.draw();
    slot.current = sit;
    slot.filled = true;
    slot.cooldown = 0;

    const mesh = rewardMesh();
    mesh.position.copy(slot.position);
    this.arenaRuntime.group.add(mesh);
    slot.mesh = mesh;
    gsap.fromTo(mesh.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.5, ease: "back.out(2.2)" });
    this.bursts.emit(slot.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 0x9fb4ff, 10, 2.2, 0.7);

    // misma etiqueta para todo: remitente + contexto + mensaje completo
    const label = this.ctx.labelRenderer.createLabel(`${sit.remitente} · ${sit.contexto}`, sit.texto);
    label.position.set(0, 1.25, 0);
    mesh.add(label);
    slot.label = label;
  }

  private clearSlot(slot: Slot): void {
    if (slot.mesh) {
      slot.mesh.removeFromParent();
      slot.mesh = null;
    }
    // CSS2DObject no se limpia solo al quitar el mesh: sin esto el texto queda flotando.
    slot.label?.element.remove();
    slot.label = null;
    slot.filled = false;
    slot.current = null;
    slot.cooldown = Config.atrapaOEvita.respawnCooldown * (0.7 + this.rand() * 0.6);
  }

  getInstructions(): InstructionsSpec {
    return {
      id: this.id,
      step: 1,
      title: "Atrapa o Evita",
      goal: "Mensajes de otros jugadores flotan por la plaza. Acércate para leerlos y llévate solo los seguros. Recoger es automático: basta con tocarlos.",
      rules: [
        { points: "+100", text: "Mensaje seguro recogido", tone: "good" },
        { points: "−50", text: "Mensaje engañoso recogido", tone: "bad" },
        { points: "0", text: "Dejar un mensaje sin recoger", tone: "neutral" }
      ],
      controls: [
        { key: "WASD", label: "Moverse" },
        { key: "Mouse", label: "Girar la cámara (el primer clic captura el mouse, Esc lo libera)" }
      ]
    };
  }

  start(): void {
    this.started = true;
    this.ctx.audio.playMinigameMusic(() => this.musicIntensity());
  }

  private musicIntensity(): number {
    const ratio = 1 - this.timeRemaining / this.duration;
    return Math.min(1, Math.max(0, (ratio - 0.65) / 0.35));
  }

  private screenPosOf(worldPos: THREE.Vector3): { x: number; y: number } {
    const v = worldPos.clone().project(this.ctx.camera);
    const rect = this.ctx.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((-v.y + 1) / 2) * rect.height };
  }

  private collect(slot: Slot, participantId: string): void {
    const sit = slot.current;
    if (!sit) return;
    const participant = this.ctx.participants.find((p) => p.id === participantId)!;
    const correct = sit.accionCorrecta === "recoger";
    const points = correct ? Config.atrapaOEvita.points.correcta : Config.atrapaOEvita.points.incorrecta;
    this.ctx.scoreManager.award(participant, points, sit.id, "atrapa_o_evita");

    const screenPos = this.screenPosOf(slot.position.clone().add(new THREE.Vector3(0, 1, 0)));
    if (participant.controllerKind === "human") {
      this.hud.showScorePopup(screenPos.x, screenPos.y, `${points > 0 ? "+" : ""}${points}`, points > 0);
      this.hud.showFeedback(`${points > 0 ? "+" : ""}${points} · ${feedbackFor(sit.categoria, correct)}`, correct);
      this.ctx.summary.recordDetection(correct, sit.categoria);
    } else {
      this.hud.showRivalPing(participant.name, `${points > 0 ? "+" : ""}${points}`);
    }

    this.arenaRuntime.rigs.get(participantId)?.character.triggerReaction("pickup", 0.55, correct ? "happy" : "sad");
    if (correct) this.ctx.audio.pickupGood();
    else this.ctx.audio.pickupBad();

    this.bursts.emit(slot.position.clone().add(new THREE.Vector3(0, 0.7, 0)), correct ? 0x8dff6a : 0xff4f6a, 30, 5, 1);
    this.clearSlot(slot);
  }

  // ---------------- NPC ----------------

  private updateAI(dt: number): void {
    for (const { participant, controller } of this.arenaRuntime.getAIControllers()) {
      // Compiten por lo mismo: si otro se llevó su objetivo, cambian de plan al instante.
      const target = this.aiTargets.get(participant.id);
      if (target && (!target.filled || target.current === null)) {
        this.aiTargets.delete(participant.id);
        controller.setTarget(null);
        this.aiTimers.set(participant.id, 0.25 + this.rand() * 0.4);
      }
      const timer = (this.aiTimers.get(participant.id) ?? 2.5) - dt;
      const needsDecision = timer <= 0 && (!controller.hasTarget() || controller.hasArrived());
      if (needsDecision) {
        this.aiTimers.set(participant.id, 2.5 + participant.avatar.traits!.reactionTime + this.rand() * 1.2);
        this.decideAITarget(participant.id, controller);
      } else {
        this.aiTimers.set(participant.id, Math.max(0, timer));
      }
    }
  }

  private decideAITarget(participantId: string, controller: AIController): void {
    const participant = this.ctx.participants.find((p) => p.id === participantId)!;
    const traits = participant.avatar.traits!;
    const pos = new THREE.Vector3(...participant.position);
    const visible = this.slots.filter((s) => s.filled && s.position.distanceTo(pos) <= Config.npc.detectionRadius);
    if (visible.length === 0) {
      controller.setTarget(null);
      return;
    }
    // Cada NPC "lee" cada mensaje por separado y puede juzgarlo mal: su acierto baja con la
    // dificultad. No conocen la respuesta; solo tienen una impresión.
    const believedSafe = visible.filter((s) => {
      const acc = Math.max(0.2, traits.accuracy - 0.1 * (s.current!.dificultad - 1));
      const truth = s.current!.accionCorrecta === "recoger";
      return this.rand() < acc ? truth : !truth;
    });
    const candidates = believedSafe.length > 0 ? believedSafe : visible;
    // riskTolerance alto: va a por lo que tiene más lejos; bajo: lo más cercano
    const scored = candidates.map((s) => {
      const dist = s.position.distanceTo(pos) + 0.001;
      return { slot: s, score: -dist * (1.3 - traits.riskTolerance) + this.rand() * 4 };
    });
    scored.sort((a, b) => b.score - a.score);
    const chosen = scored[0].slot;
    this.aiTargets.set(participantId, chosen);
    controller.setTarget(chosen.position, Config.npc.pickupRadius);
  }

  // ---------------- frame ----------------

  private updateEvents(): void {
    const elapsed = 1 - this.timeRemaining / this.duration;
    const marks = Config.atrapaOEvita.rainAtProgress;
    if (this.rainsTriggered >= marks.length || elapsed < marks[this.rainsTriggered]) return;
    this.rainsTriggered++;
    this.ctx.audio.transition();
    this.hud.showEventBanner("¡Lluvia de mensajes! Aparecen muchos nuevos a la vez.", 3500);
    for (const slot of this.slots) if (!slot.filled) slot.cooldown = this.rand() * 0.8;
  }

  update(dt: number): void {
    if (!this.started || this.finished) return;
    this.timeRemaining -= dt;
    this.hud.setTimer(this.timeRemaining);
    this.updateEvents();

    for (const slot of this.slots) {
      if (!slot.filled) {
        slot.cooldown -= dt;
        if (slot.cooldown <= 0) this.fillSlot(slot);
      } else if (slot.mesh) {
        slot.wobble += dt;
        slot.mesh.position.y = slot.position.y + Math.sin(slot.wobble * 2) * 0.04;
        slot.mesh.rotation.y += dt * 0.6;
      }
    }

    // mensajes lejanos: solo remitente; cerca: texto completo (~10 veces por segundo)
    if (this.labelTick++ % 6 === 0) {
      const hr = this.arenaRuntime.getHumanRig();
      if (hr) {
        const hp = new THREE.Vector3(...hr.participant.position);
        for (const slot of this.slots) {
          slot.label?.element.classList.toggle("far", slot.position.distanceTo(hp) > READ_DISTANCE);
        }
      }
    }

    this.bursts.update(dt);
    this.updateAI(dt);
    this.arenaRuntime.update(dt);

    // recolección automática al contacto: humano primero, luego IA, para no duplicar el mismo frame
    const humanRig = this.arenaRuntime.getHumanRig();
    if (humanRig) {
      const hp = new THREE.Vector3(...humanRig.participant.position);
      for (const slot of this.slots) {
        if (slot.filled && slot.position.distanceTo(hp) <= Config.npc.pickupRadius) this.collect(slot, humanRig.participant.id);
      }
    }
    for (const { participant, controller } of this.arenaRuntime.getAIControllers()) {
      if (!controller.hasTarget()) continue;
      const pos = new THREE.Vector3(...participant.position);
      for (const slot of this.slots) {
        if (slot.filled && slot.position.distanceTo(pos) <= Config.npc.pickupRadius) {
          this.collect(slot, participant.id);
          controller.setTarget(null);
          // pausa para "mirar a su alrededor": evita que recojan sin parar, uno tras otro
          this.aiTimers.set(participant.id, 1.2 + participant.avatar.traits!.reactionTime + this.rand());
          break;
        }
      }
    }

    this.hud.setRanking(
      [...this.ctx.participants]
        .sort((a, b) => b.minigameScore - a.minigameScore)
        .map((p, i) => ({ participantId: p.id, name: p.name, score: p.minigameScore, rank: i + 1 })),
      (id) => this.ctx.participants.find((p) => p.id === id)!.avatar.primaryColor
    );

    if (this.timeRemaining <= 0) this.finished = true;
  }

  isFinished(): boolean {
    return this.finished;
  }

  dispose(): void {
    for (const slot of this.slots) this.clearSlot(slot);
    this.bursts.dispose();
    this.hud.unmount();
    this.arenaRuntime.dispose();
  }
}
