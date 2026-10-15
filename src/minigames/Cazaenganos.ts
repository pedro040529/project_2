import * as THREE from "three";
import { Config } from "../core/Config";
import type { MessageDef } from "../core/types";
import type { InstructionsSpec, HudHandle } from "../core/UIManager";
import type { IMinigame, MinigameContext } from "./IMinigame";
import { ArenaRuntime } from "./common/ArenaRuntime";
import { feltFlat, CraftPalette } from "../world/Materials";
import { mulberry32, shuffle } from "../utils/rng";

interface TargetSlot {
  position: THREE.Vector3;
  filled: boolean;
  cooldown: number;
  current: MessageDef | null;
  mesh: THREE.Group | null;
  label: ReturnType<import("../world/LabelRenderer").LabelRenderer["createLabel"]> | null;
  instanceId: number;
  bobSeed: number;
  age: number;
  claimed: boolean;
}

interface PendingAiShot {
  participantId: string;
  slotIndex: number;
  instanceId: number;
  timeLeft: number;
}

function blasterMesh(): THREE.Group {
  // Blaster de juguete artesanal: mismo aspecto para los 4, es solo utilería.
  // Un poco más grande de lo "realista" a propósito, para que se note bien
  // a la distancia de cámara habitual del juego.
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.36), feltFlat(CraftPalette.cardboardDark, 0.6));
  g.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), feltFlat(CraftPalette.cardboard, 0.5));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.27;
  g.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), feltFlat(CraftPalette.coralFelt, 0.75));
  grip.position.set(0, -0.15, 0.07);
  grip.rotation.x = 0.3;
  g.add(grip);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), feltFlat(CraftPalette.mustardFelt, 0.5));
  tip.position.z = -0.39;
  g.add(tip);
  g.scale.setScalar(1.8);
  return g;
}

interface Tracer {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  duration: number;
  onImpact?: () => void;
}

function orbMesh(): THREE.Group {
  // Holograma/orbe neutro: MISMA forma y color para todos los mensajes (RNF06).
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.32, 1),
    new THREE.MeshStandardMaterial({ color: CraftPalette.white, roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.92 })
  );
  core.castShadow = true;
  g.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.02, 6, 20), feltFlat(CraftPalette.cardboard, 0.7));
  ring.rotation.x = Math.PI / 2.4;
  g.add(ring);
  return g;
}

export class Cazaenganos implements IMinigame {
  readonly id = "cazaenganos" as const;
  readonly title = "Cazaengaños";

  private ctx!: MinigameContext;
  private arenaRuntime!: ArenaRuntime;
  private hud!: HudHandle;
  private slots: TargetSlot[] = [];
  private deck: MessageDef[] = [];
  private deckCursor = 0;
  private timeRemaining = Config.cazaenganos.durationSeconds;
  private finished = false;
  private started = false;
  private rand = mulberry32((Date.now() + 777) & 0xffffffff);
  private nextInstanceId = 1;
  private aiTimers = new Map<string, number>();
  private pendingAiShots: PendingAiShot[] = [];
  private streak = 0;
  private raycaster = new THREE.Raycaster();
  private tracers: Tracer[] = [];

  async load(ctx: MinigameContext): Promise<void> {
    this.ctx = ctx;
    this.arenaRuntime = new ArenaRuntime(ctx, Config.arena.sharedRadius);
    this.hud = ctx.ui.mountHUD();
    this.hud.setObjective("Haz click una vez para capturar el mouse; apunta con la mira y haz click para destruir los mensajes engañosos. No dispares a los legítimos.");
    // El cursor del sistema hace de mira: no se necesita pointer lock ni
    // capturar el mouse para apuntar, así que un crosshair fijo al centro
    // de pantalla ya no representaría dónde apunta realmente el disparo.
    this.hud.showCrosshair(true);

    // Blaster de juguete en la mano de los 4 — antes disparaban "de la nada".
    for (const rig of this.arenaRuntime.rigs.values()) {
      rig.character.attachToRightHand(blasterMesh());
    }

    this.deck = shuffle(this.ctx.scenarios.drawMessageSet(Config.cazaenganos.composition), this.rand);

    const radius = this.arenaRuntime.arena.radius * 0.7;
    for (let i = 0; i < Config.cazaenganos.targetsOnScreen; i++) {
      const angle = (i / Config.cazaenganos.targetsOnScreen) * Math.PI * 2;
      this.slots.push({
        position: new THREE.Vector3(Math.cos(angle) * radius * 0.6, 1.6, Math.sin(angle) * radius * 0.6),
        filled: false,
        cooldown: this.rand() * 1.5,
        current: null,
        mesh: null,
        label: null,
        instanceId: 0,
        age: 0,
        claimed: false,
        bobSeed: this.rand() * 10
      });
    }
  }

  /**
   * Elige una posición para un objetivo nuevo probando varios candidatos y
   * quedándose con el que queda más lejos de TODOS los objetivos ya
   * activos — antes era 100% al azar y podían aparecer pegados o
   * superpuestos entre sí.
   */
  private pickSpreadPosition(): THREE.Vector3 {
    // Nueve estaciones fijas: no existe un fallback que coloque mensajes pegados.
    const occupied = this.slots.filter(s => s.filled).map(s => s.position);
    const stations: THREE.Vector3[] = [];
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
      stations.push(new THREE.Vector3(x * 8, 1.7, z * 8));
    }
    const available = stations.filter(p => occupied.every(q => q.distanceTo(p) >= 7.9));
    return available[Math.floor(this.rand() * available.length)]!;
  }

  private nextDeckMessage(): MessageDef {
    if (this.deckCursor >= this.deck.length) {
      this.deck = shuffle(this.deck, this.rand);
      this.deckCursor = 0;
    }
    return this.deck[this.deckCursor++];
  }

  private fillSlot(slot: TargetSlot): void {
    const msg = this.nextDeckMessage();
    slot.current = msg;
    slot.position.copy(this.pickSpreadPosition());
    slot.filled = true;
    slot.age = 0;
    slot.claimed = false;
    slot.instanceId = this.nextInstanceId++;

    const mesh = orbMesh();
    mesh.position.copy(slot.position);
    this.arenaRuntime.group.add(mesh);
    slot.mesh = mesh;

    const label = this.ctx.labelRenderer.createLabel(msg.autor, msg.texto);
    label.position.set(0, 0.55, 0);
    label.element.dataset.instanceId = String(slot.instanceId);
    mesh.add(label);
    slot.label = label;
  }

  private clearSlot(slot: TargetSlot): void {
    slot.mesh?.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach(m => m.dispose());
      }
    });
    slot.mesh?.removeFromParent();
    slot.mesh = null;
    // ver comentario equivalente en AtrapaOEvita.clearSlot: CSS2DObject no
    // se autolimpia al remover un ancestro, solo al removerse él mismo.
    slot.label?.element.remove();
    slot.label = null;
    slot.filled = false;
    slot.current = null;
    slot.cooldown = Config.cazaenganos.respawnCooldown * (0.6 + this.rand() * 0.8);
  }

  getInstructions(): InstructionsSpec {
    return {
      title: "Cazaengaños",
      goal: "Lee el mensaje que aparece sobre cada objetivo. Si suena a un intento de engaño, destrúyelo. Si es un mensaje normal, déjalo tranquilo.",
      controls: [
        { key: "🖱️", label: "Apuntar" },
        { key: "Click", label: "Disparar" },
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
    const ratio = 1 - this.timeRemaining / Config.cazaenganos.durationSeconds;
    return Math.min(1, Math.max(0, (ratio - 0.65) / 0.35));
  }

  private pointsFor(msg: MessageDef): number {
    const p = Config.cazaenganos.points;
    if (msg.tipo === "enganosa") return p.enganosoDestruido;
    if (msg.tipo === "legitima") return p.legitimoDestruido;
    return msg.accionEsperada === "destruir" ? p.ambiguoDestruidoBien : p.ambiguoDestruidoMal;
  }

  private screenPosOf(worldPos: THREE.Vector3): { x: number; y: number } {
    const v = worldPos.clone().project(this.ctx.camera);
    const rect = this.ctx.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((-v.y + 1) / 2) * rect.height };
  }

  private destroy(slot: TargetSlot, participantId: string): void {
    if (!slot.current) return;
    const msg = slot.current;
    const participant = this.ctx.participants.find((p) => p.id === participantId)!;
    const wasCorrect = msg.accionEsperada === "destruir";
    let points = this.pointsFor(msg);

    if (participant.controllerKind === "human") {
      if (wasCorrect && Config.cazaenganos.streak.enabled) {
        this.streak++;
        if (this.streak >= 2) {
          const bonus = Config.cazaenganos.streak.bonuses[Math.min(this.streak - 2, Config.cazaenganos.streak.bonuses.length - 1)];
          points += bonus;
          this.hud.setStreak(this.streak, bonus);
        }
      } else if (Config.cazaenganos.streak.breakOnWrongHit) {
        this.streak = 0;
        this.hud.hideStreak();
      }
      this.ctx.summary.recordDetection(wasCorrect, msg.categoria);
    }

    this.ctx.scoreManager.award(participant, points, msg.scenarioID, "cazaenganos");

    const screenPos = this.screenPosOf(slot.position);
    if (participant.controllerKind === "human") {
      this.hud.showScorePopup(screenPos.x, screenPos.y, `${points > 0 ? "+" : ""}${points}`, points > 0);
    } else {
      this.hud.showRivalPing(participant.name, `${points > 0 ? "+" : ""}${points}`);
    }

    if (wasCorrect) this.ctx.audio.destroyTarget(true);
    else this.ctx.audio.destroyTarget(false);

    const rig = this.arenaRuntime.rigs.get(participantId);
    rig?.character.triggerReaction(wasCorrect ? "celebrate" : "lose", 0.8);

    this.clearSlot(slot);
    // Los lectores cancelan su acción en el siguiente frame si desaparece el objetivo.
  }

  /** Bolita de energía visible viajando de la mano del tirador al objetivo — antes se disparaba "de la nada". */
  private spawnTracer(fromWorld: THREE.Vector3, toWorld: THREE.Vector3, onImpact?: () => void): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshStandardMaterial({ color: CraftPalette.white, emissive: CraftPalette.mustardFelt, emissiveIntensity: 0.9, roughness: 0.3 })
    );
    mesh.position.copy(fromWorld);
    this.arenaRuntime.group.add(mesh);
    const duration = Math.max(0.18, fromWorld.distanceTo(toWorld) / Config.cazaenganos.projectileSpeed);
    this.tracers.push({ mesh, from: fromWorld.clone(), to: toWorld.clone(), t: 0, duration, onImpact });
  }

  private updateTracers(dt: number): void {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.t += dt;
      const p = Math.min(1, tr.t / tr.duration);
      tr.mesh.position.lerpVectors(tr.from, tr.to, p);
      tr.mesh.scale.setScalar(1 - p * 0.3);
      if (p >= 1) {
        tr.onImpact?.();
        tr.mesh.geometry.dispose();
        (tr.mesh.material as THREE.Material).dispose();
        tr.mesh.removeFromParent();
        this.tracers.splice(i, 1);
      }
    }
  }

  private handleHumanShoot(): void {
    const human = this.arenaRuntime.getHumanController();
    if (!human) return;
    if (!human.consumeClick()) return;

    const ray = human.getAimRay(this.ctx.camera);
    let best: { slot: TargetSlot; screenDist: number } | null = null;

    for (const slot of this.slots) {
      if (!slot.filled || !slot.mesh || slot.claimed) continue;
      if (slot.position.clone().project(this.ctx.camera).z > 1) continue;
      const toTarget = slot.position.clone().sub(ray.origin);
      if (toTarget.dot(ray.direction) <= 0) continue;
      const dist = toTarget.length();
      const proj = ray.direction.clone().multiplyScalar(toTarget.dot(ray.direction));
      const perp = toTarget.clone().sub(proj);
      const angularDist = perp.length() / Math.max(1, dist);
      const rect = slot.label?.element.getBoundingClientRect();
      const ndc = this.ctx.input.getMouseNDC();
      const view = this.ctx.renderer.domElement.getBoundingClientRect();
      const mx = view.left + (ndc.x + 1) * view.width / 2;
      const my = view.top + (1 - ndc.y) * view.height / 2;
      const labelHit = slot.label?.element.style.visibility !== "hidden" && rect && mx >= rect.left && mx <= rect.right && my >= rect.top && my <= rect.bottom;
      if (labelHit) { best = { slot, screenDist: 0 }; break; }
      if (angularDist < 0.035) {
        if (!best || angularDist < best.screenDist) best = { slot, screenDist: angularDist };
      }
    }

    if (best) {
      this.fire(best.slot, "human");
    } else {
      this.ctx.audio.shoot();
      this.arenaRuntime.getHumanRig()?.character.triggerShot();
      // erró: igual se ve la bolita viajando, para que el disparo se sienta real.
      const humanRig = this.arenaRuntime.getHumanRig();
      if (humanRig) {
        humanRig.faceTarget(ray.origin.clone().add(ray.direction.clone().multiplyScalar(18)));
        const handPos = humanRig.character.getRightHandWorldPosition(new THREE.Vector3());
        this.spawnTracer(handPos, ray.origin.clone().add(ray.direction.clone().multiplyScalar(18)));
      }
    }
  }

  private fire(slot: TargetSlot, participantId: string): void {
    if (slot.claimed || !slot.filled) return;
    slot.claimed = true;
    const rig = this.arenaRuntime.rigs.get(participantId)!;
    const pos = new THREE.Vector3(...rig.participant.position);
    rig.faceTarget(slot.position);
    rig.character.triggerShot();
    this.ctx.audio.shoot();
    const instanceId = slot.instanceId;
    this.spawnTracer(rig.character.getRightHandWorldPosition(new THREE.Vector3()), slot.position.clone(), () => {
      if (slot.filled && slot.instanceId === instanceId) this.destroy(slot, participantId);
    });
  }

  private updateAI(dt: number): void {
    for (const { participant, controller, rig } of this.arenaRuntime.getAIControllers()) {
      const traits = participant.avatar.traits!;
      const pending = this.pendingAiShots.find(s => s.participantId === participant.id);
      if (pending) {
        const slot = this.slots[pending.slotIndex];
        if (!slot.filled || slot.claimed || slot.instanceId !== pending.instanceId) {
          this.pendingAiShots = this.pendingAiShots.filter(s => s !== pending);
          participant.state = "idle";
          controller.setTarget(null);
          this.aiTimers.set(participant.id, 2 + this.rand() * 2);
          continue;
        }
        controller.setTarget(new THREE.Vector3(...participant.position), 0.8);
        rig.faceTarget(slot.position);
        pending.timeLeft -= dt;
        if (pending.timeLeft <= 0 && slot.age >= 7) {
          const correct = this.rand() < traits.accuracy;
          const wantsShot = slot.current!.accionEsperada === "destruir";
          if (correct ? wantsShot : !wantsShot) this.fire(slot, participant.id);
          this.pendingAiShots = this.pendingAiShots.filter(s => s !== pending);
          participant.state = "idle";
          controller.setTarget(null);
          this.aiTimers.set(participant.id, 2.5 + this.rand() * 2.5);
        }
        continue;
      }
      const timer = (this.aiTimers.get(participant.id) ?? (2 + this.rand() * 2)) - dt;
      this.aiTimers.set(participant.id, timer);
      if (timer > 0) continue;
      const pos = new THREE.Vector3(...participant.position);
      const candidates = this.slots.filter(slot => slot.filled && !slot.claimed && slot.position.distanceTo(pos) < 16 &&
        !this.pendingAiShots.some(shot => shot.instanceId === slot.instanceId));
      this.aiTimers.set(participant.id, 1 + this.rand());
      if (!candidates.length) continue;
      const chosen = candidates[Math.floor(this.rand() * candidates.length)];
      const words = chosen.current!.texto.split(/\s+/).length;
      this.pendingAiShots.push({ participantId: participant.id, slotIndex: this.slots.indexOf(chosen), instanceId: chosen.instanceId,
        timeLeft: Math.max(4, words / 4) + traits.reactionTime + this.rand() * 1.5 });
      participant.state = "deciding";
      controller.setTarget(pos, 0.8);
    }
  }

  update(dt: number): void {
    if (!this.started || this.finished) return;
    this.timeRemaining -= dt;
    this.hud.setTimer(this.timeRemaining);

    for (const slot of this.slots) {
      if (!slot.filled) {
        slot.cooldown -= dt;
        if (slot.cooldown <= 0) this.fillSlot(slot);
      } else if (slot.mesh) {
        slot.age += dt;
        if (slot.age > 26 && !slot.claimed && !this.pendingAiShots.some(s => s.instanceId === slot.instanceId)) { this.clearSlot(slot); continue; }
        slot.bobSeed += dt;
        slot.mesh.position.y = slot.position.y + Math.sin(slot.bobSeed * 1.6) * 0.08;
        slot.mesh.rotation.y += dt * 0.8;
      }
    }

    this.updateAI(dt);
    this.arenaRuntime.update(dt);
    this.handleHumanShoot();
    this.updateTracers(dt);

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
    for (const tr of this.tracers) tr.mesh.removeFromParent();
    this.tracers = [];
    this.hud.hideStreak();
    this.hud.unmount();
    this.arenaRuntime.dispose();
    this.ctx.renderer.domElement.style.cursor = "default";
    void this.raycaster;
  }
}
