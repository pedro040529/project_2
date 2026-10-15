import * as THREE from "three";
import { Config } from "../core/Config";
import type { RewardDef } from "../core/types";
import type { InstructionsSpec } from "../core/UIManager";
import type { HudHandle } from "../core/UIManager";
import type { IMinigame, MinigameContext } from "./IMinigame";
import { ArenaRuntime } from "./common/ArenaRuntime";
import { craftMaterial, feltFlat, CraftPalette } from "../world/Materials";
import { AIController } from "../entities/controllers/AIController";
import { mulberry32, shuffle } from "../utils/rng";

type SlotKind = "legitima_pequena" | "legitima_especial" | "legitima_rara" | "enganosa" | "ambigua";

interface Slot {
  kind: SlotKind;
  position: THREE.Vector3;
  filled: boolean;
  cooldown: number;
  current: RewardDef | null;
  mesh: THREE.Group | null;
  label: ReturnType<import("../world/LabelRenderer").LabelRenderer["createLabel"]> | null;
  wobble: number;
}

function pouchMesh(): THREE.Group {
  // Bolsita de fieltro uniforme: MISMO aspecto para legítimas, ambiguas y engañosas (RNF06).
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), feltFlat(CraftPalette.paper, 0.85));
  body.scale.set(1, 0.85, 1);
  body.position.y = 0.26;
  body.castShadow = true;
  g.add(body);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), craftMaterial("cardboard", { repeat: 0.5 }));
  tie.position.y = 0.46;
  tie.rotation.x = Math.PI / 2;
  g.add(tie);
  const bow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), feltFlat(CraftPalette.coralFelt, 0.9));
  bow.position.y = 0.5;
  g.add(bow);
  return g;
}

function slotKindFor(index: number, counts: Record<SlotKind, number>): SlotKind[] {
  const list: SlotKind[] = [];
  (Object.keys(counts) as SlotKind[]).forEach((k) => {
    for (let i = 0; i < counts[k]; i++) list.push(k);
  });
  void index;
  return list;
}

export class AtrapaOEvita implements IMinigame {
  readonly id = "atrapa_o_evita" as const;
  readonly title = "Atrapa o Evita";

  private ctx!: MinigameContext;
  private arenaRuntime!: ArenaRuntime;
  private hud!: HudHandle;
  private slots: Slot[] = [];
  private timeRemaining = Config.atrapaOEvita.durationSeconds;
  private finished = false;
  private started = false;
  private rand = mulberry32(Date.now() & 0xffffffff);
  private aiTimers = new Map<string, number>();
  private clock = { total: 0 };

  async load(ctx: MinigameContext): Promise<void> {
    this.ctx = ctx;
    this.arenaRuntime = new ArenaRuntime(ctx, Config.arena.sharedRadius);
    this.hud = ctx.ui.mountHUD();
    this.hud.setObjective("Corre hacia las recompensas para llevártelas. Evita las que parezcan un engaño.");

    this.buildSlots();

    setTimeout(() => {
      this.hud.showEventBanner("Evento activo: hay cofres especiales de evento en la arena esta ronda.");
    }, 600);
  }

  private buildSlots(): void {
    const cfg = Config.atrapaOEvita;
    const counts: Record<SlotKind, number> = {
      legitima_pequena: cfg.countInLegitima,
      legitima_especial: cfg.countInEspecial,
      legitima_rara: cfg.countInRara,
      enganosa: cfg.countInEnganosa,
      ambigua: cfg.countInAmbigua
    };
    const kinds = shuffle(slotKindFor(0, counts), this.rand);
    const radius = this.arenaRuntime.arena.radius;
    const ringRadii = [radius * 0.28, radius * 0.48, radius * 0.66, radius * 0.8];
    const perRing = Math.ceil(kinds.length / ringRadii.length);

    let cursor = 0;
    ringRadii.forEach((r, ringIdx) => {
      const count = Math.min(perRing, kinds.length - cursor);
      const angleOffset = this.rand() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        const angle = angleOffset + (i / count) * Math.PI * 2 + (ringIdx % 2 === 0 ? 0.18 : -0.18);
        const jitter = (this.rand() - 0.5) * (radius * 0.05);
        const pos = new THREE.Vector3(Math.cos(angle) * (r + jitter), 0, Math.sin(angle) * (r + jitter));
        const kind = kinds[cursor];
        cursor++;
        this.slots.push({ kind, position: pos, filled: false, cooldown: this.rand() * 2, current: null, mesh: null, label: null, wobble: this.rand() * 10 });
      }
    });
  }

  private poolFor(kind: SlotKind): RewardDef[] {
    const all = this.ctx.scenarios.getAllRewards();
    switch (kind) {
      case "legitima_pequena":
        return all.filter((r) => r.tipo === "legitima" && r.rareza === "pequena");
      case "legitima_especial":
        return all.filter((r) => r.tipo === "legitima" && r.rareza === "especial");
      case "legitima_rara":
        return all.filter((r) => r.tipo === "legitima" && r.rareza === "rara");
      case "enganosa":
        return all.filter((r) => r.tipo === "enganosa");
      case "ambigua":
        return all.filter((r) => r.tipo === "ambigua");
    }
  }

  private fillSlot(slot: Slot): void {
    const pool = this.poolFor(slot.kind);
    const reward = this.ctx.scenarios.drawReward(pool);
    slot.current = reward;
    slot.filled = true;
    slot.cooldown = 0;

    const mesh = pouchMesh();
    mesh.position.copy(slot.position);
    this.arenaRuntime.group.add(mesh);
    slot.mesh = mesh;

    const shortLabel = reward.texto.length > 34 ? `${reward.texto.slice(0, 32)}…` : reward.texto;
    const label = this.ctx.labelRenderer.createLabel("RECOMPENSA", shortLabel);
    label.position.set(0, 0.85, 0);
    mesh.add(label);
    slot.label = label;
  }

  private clearSlot(slot: Slot): void {
    if (slot.mesh) {
      slot.mesh.removeFromParent();
      slot.mesh = null;
    }
    // CSS2DObject solo limpia su <div> si el evento "removed" dispara sobre
    // ÉL MISMO; como cuelga del mesh (no de la escena directamente), quitar
    // el mesh no alcanza — sin esto, el texto queda flotando para siempre.
    slot.label?.element.remove();
    slot.label = null;
    slot.filled = false;
    slot.current = null;
    slot.cooldown = Config.atrapaOEvita.respawnCooldown * (0.7 + this.rand() * 0.6);
  }

  getInstructions(): InstructionsSpec {
    return {
      title: "Atrapa o Evita",
      goal: "Corre por la arena y llévate las recompensas que te convengan. Fíjate en el mensaje de cada una antes de ir corriendo.",
      controls: [
        { key: "WASD", label: "Moverse" },
        { key: "Mouse", label: "Mover para girar la cámara (primer clic lo captura, Esc lo libera)" }
      ]
    };
  }

  start(): void {
    this.started = true;
    this.ctx.audio.playMinigameMusic(() => this.musicIntensity());
  }

  /** 0 la mayor parte de la ronda, sube a 1 en el último 35% del tiempo — la música se acelera cuando se acaba. */
  private musicIntensity(): number {
    const ratio = 1 - this.timeRemaining / Config.atrapaOEvita.durationSeconds;
    return Math.min(1, Math.max(0, (ratio - 0.65) / 0.35));
  }

  private screenPosOf(worldPos: THREE.Vector3): { x: number; y: number } {
    const v = worldPos.clone().project(this.ctx.camera);
    const rect = this.ctx.renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + ((v.x + 1) / 2) * rect.width,
      y: rect.top + ((-v.y + 1) / 2) * rect.height
    };
  }

  private pointsFor(reward: RewardDef): number {
    const p = Config.atrapaOEvita.points;
    if (reward.tipo === "legitima") {
      if (reward.rareza === "especial") return p.legitimaEspecial;
      if (reward.rareza === "rara") return p.legitimaRara;
      return p.legitimaPequena;
    }
    if (reward.tipo === "enganosa") return p.enganosaRecogida;
    // ambigua: el puntaje depende de si recogerla era realmente lo correcto
    return reward.accionEsperada === "recoger" ? p.ambiguaBuena : p.ambiguaMala;
  }

  private collect(slot: Slot, participantId: string): void {
    if (!slot.current) return;
    const reward = slot.current;
    const participant = this.ctx.participants.find((p) => p.id === participantId)!;
    const points = this.pointsFor(reward);
    this.ctx.scoreManager.award(participant, points, reward.scenarioID, "atrapa_o_evita");

    const screenPos = this.screenPosOf(slot.position.clone().add(new THREE.Vector3(0, 1, 0)));
    if (participant.controllerKind === "human") {
      this.hud.showScorePopup(screenPos.x, screenPos.y, `${points > 0 ? "+" : ""}${points}`, points > 0);
      this.ctx.summary.recordDetection(reward.accionEsperada === "recoger", reward.categoria);
    } else {
      this.hud.showRivalPing(participant.name, `${points > 0 ? "+" : ""}${points}`);
    }

    const rig = this.arenaRuntime.rigs.get(participantId);
    rig?.character.triggerReaction(points >= 0 ? "celebrate" : "lose");

    if (points >= 0) this.ctx.audio.pickupGood();
    else this.ctx.audio.pickupBad();

    this.clearSlot(slot);
  }

  private updateAI(dt: number): void {
    for (const { participant, controller } of this.arenaRuntime.getAIControllers()) {
      const timer = (this.aiTimers.get(participant.id) ?? 2.5) - dt;
      const needsDecision = timer <= 0 && (!controller.hasTarget() || this.targetSlotConsumed(controller));
      if (needsDecision) {
        this.aiTimers.set(participant.id, 2.5 + participant.avatar.traits!.reactionTime + this.rand() * 1.2);
        this.decideAITarget(participant.id, controller);
      } else {
        this.aiTimers.set(participant.id, Math.max(0, timer));
      }
    }
  }

  private targetSlotConsumed(controller: AIController): boolean {
    return controller.hasArrived();
  }

  private decideAITarget(participantId: string, controller: AIController): void {
    const traits = this.ctx.participants.find((p) => p.id === participantId)!.avatar.traits!;
    const pos = new THREE.Vector3(...this.ctx.participants.find((p) => p.id === participantId)!.position);
    const visible = this.slots.filter((s) => s.filled && s.position.distanceTo(pos) <= Config.npc.detectionRadius);
    if (visible.length === 0) {
      controller.setTarget(null);
      return;
    }

    const actsCorrectly = this.rand() < traits.accuracy;
    let candidates = visible;
    if (actsCorrectly) {
      candidates = visible.filter((s) => s.current!.accionEsperada === "recoger");
      if (candidates.length === 0) candidates = visible; // si no hay ninguna "buena" visible, igual reacciona a algo
    }

    // riskTolerance: prefiere puntaje alto aunque esté más lejos; baja riskTolerance prefiere lo más cercano.
    const scored = candidates.map((s) => {
      const value = Math.abs(this.pointsFor(s.current!));
      const dist = s.position.distanceTo(pos) + 0.001;
      const score = value * (0.4 + traits.riskTolerance) - dist * (1.3 - traits.riskTolerance);
      return { slot: s, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const chosen = scored[0].slot;
    controller.setTarget(chosen.position, Config.npc.pickupRadius);
  }

  update(dt: number): void {
    if (!this.started || this.finished) return;
    this.clock.total += dt;
    this.timeRemaining -= dt;
    this.hud.setTimer(this.timeRemaining);

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

    this.updateAI(dt);
    this.arenaRuntime.update(dt);

    // recolección: humano primero, luego IA en orden fijo, para evitar doble-award el mismo frame
    const humanRig = this.arenaRuntime.getHumanRig();
    if (humanRig) {
      const hp = new THREE.Vector3(...humanRig.participant.position);
      for (const slot of this.slots) {
        if (slot.filled && slot.position.distanceTo(hp) <= Config.npc.pickupRadius) {
          this.collect(slot, humanRig.participant.id);
        }
      }
    }
    for (const { participant, controller } of this.arenaRuntime.getAIControllers()) {
      if (!controller.hasTarget()) continue;
      const pos = new THREE.Vector3(...participant.position);
      for (const slot of this.slots) {
        if (slot.filled && slot.position.distanceTo(pos) <= Config.npc.pickupRadius) {
          this.collect(slot, participant.id);
          controller.setTarget(null);
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
    this.hud.unmount();
    this.arenaRuntime.dispose();
  }
}
