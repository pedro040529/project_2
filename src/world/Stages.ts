import * as THREE from "three";
import { gsap } from "gsap";
import type { Appearance, AvatarDef, ParticipantId } from "../core/types";
import type { Participant } from "../entities/Participant";
import type { LabelRenderer } from "./LabelRenderer";
import { createGuardian, type GuardianCharacter } from "./CharacterFactory";
import { NPC_AVATARS, buildHumanAvatar } from "../data/characters";
import { BurstSystem } from "./Burst";
import { NeonPalette, floorDisc, floatingCubes, makeAnimator, neonRing, outerVoid, pad } from "./ThemedArenas";

/**
 * Escenarios 3D de los menús (no son minijuegos): menú principal, personalización,
 * presentación de participantes y podio. Todos comparten el "estudio NEXORA": base azul
 * noche con rejilla y neón, para que cada pantalla se sienta parte del mismo mundo.
 */
export interface Stage {
  update(dt: number): void;
  dispose(): void;
}

type CssLabel = ReturnType<LabelRenderer["createLabel"]>;

function buildStudio(radius: number): { group: THREE.Group; animate: (t: number) => void } {
  const group = new THREE.Group();
  group.add(floorDisc(radius, "#10173f", "#34439c", 8, 5));
  outerVoid(radius, group);
  group.add(neonRing(radius, NeonPalette.cyan, 0.05, 0.12));
  group.add(neonRing(radius * 0.62, NeonPalette.magenta, 0.03, 0.05));
  floatingCubes(group, radius * 0.9, 18, [NeonPalette.cyan, NeonPalette.magenta, NeonPalette.gold]);
  return { group, animate: makeAnimator(group) };
}

abstract class BaseStage implements Stage {
  protected group = new THREE.Group();
  protected t = 0;
  protected labels: CssLabel[] = [];
  protected chars: GuardianCharacter[] = [];
  protected bursts: BurstSystem;
  private studioAnimate: (t: number) => void;
  private killers: gsap.core.Tween[] = [];

  constructor(
    protected scene: THREE.Scene,
    protected camera: THREE.PerspectiveCamera,
    studioRadius = 12
  ) {
    const studio = buildStudio(studioRadius);
    this.group.add(studio.group);
    this.studioAnimate = studio.animate;
    this.bursts = new BurstSystem(this.group);
    scene.add(this.group);
  }

  protected track<T extends gsap.core.Tween>(tw: T): T {
    this.killers.push(tw);
    return tw;
  }

  protected addLabel(parent: THREE.Object3D, tag: string, text: string, y: number, extraClass = ""): CssLabel {
    const labelRenderer = this.labelRenderer;
    if (!labelRenderer) throw new Error("Stage sin labelRenderer");
    const l = labelRenderer.createLabel(tag, text);
    l.element.classList.add("stage-tag");
    if (extraClass) l.element.classList.add(extraClass);
    l.position.set(0, y, 0);
    parent.add(l);
    this.labels.push(l);
    return l;
  }

  protected labelRenderer: LabelRenderer | null = null;

  update(dt: number): void {
    this.t += dt;
    this.studioAnimate(this.t);
    for (const c of this.chars) c.update(dt, 0, "idle");
    this.bursts.update(dt);
  }

  dispose(): void {
    this.killers.forEach((k) => k.kill());
    this.labels.forEach((l) => l.element.remove());
    this.labels = [];
    this.bursts.dispose();
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
      }
    });
    this.chars.forEach((c) => c.dispose());
  }
}

/** Menú principal: el Guardián del jugador saluda sobre una plataforma, la cámara se mece suavemente. */
export class LobbyStage extends BaseStage {
  private hero: GuardianCharacter;
  private nextWave = 1.5;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, appearance: Appearance, name = "Tú") {
    super(scene, camera);
    this.hero = createGuardian(buildHumanAvatar(appearance, name));
    this.hero.root.scale.setScalar(1.55);
    this.hero.root.position.set(0, 0.14, 0);
    this.hero.setHeading(0.25);
    this.group.add(pad(0, 0, NeonPalette.cyan, 2.3));
    this.group.add(this.hero.root);
    this.chars.push(this.hero);
    for (const [i, id] of (["nova", "kiro", "pixel"] as const).entries()) {
      const g = createGuardian(NPC_AVATARS[id]);
      const a = Math.PI * (0.75 + i * 0.28);
      g.root.position.set(Math.cos(a) * 5.4, 0, Math.sin(a) * 5.4 - 1);
      g.setHeading(-a - Math.PI / 2 + 0.3);
      this.group.add(g.root);
      this.chars.push(g);
    }
  }

  update(dt: number): void {
    super.update(dt);
    this.nextWave -= dt;
    if (this.nextWave <= 0) {
      this.hero.triggerReaction("celebrate", 1.3);
      this.nextWave = 5 + Math.random() * 2;
    }
    const sway = Math.sin(this.t * 0.25) * 0.5;
    this.camera.position.set(1.8 + sway, 2.1, 7.6);
    this.camera.lookAt(-0.6, 1.5, 0);
  }
}

/** Personalización: el Guardián completo sobre una plataforma, rota despacio; los cambios se ven al instante. */
export class CustomizeStage extends BaseStage {
  private hero!: GuardianCharacter;
  private heading = 0.5;
  private spinBoost = 0;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, appearance: Appearance, private name = "Tú") {
    super(scene, camera);
    this.group.add(pad(0, 0, NeonPalette.magenta, 2.2));
    this.spawn(appearance);
  }

  private spawn(appearance: Appearance): void {
    if (this.hero) {
      this.hero.root.removeFromParent();
      this.hero.dispose();
      this.chars = [];
    }
    this.hero = createGuardian(buildHumanAvatar(appearance, this.name));
    this.hero.root.scale.setScalar(1.85);
    this.hero.root.position.set(0, 0.14, 0);
    this.hero.setHeading(this.heading);
    this.group.add(this.hero.root);
    this.chars.push(this.hero);
    this.hero.triggerReaction("pickup", 0.5, "happy");
  }

  setAppearance(appearance: Appearance): void {
    this.spawn(appearance);
  }

  /** Gira el modelo (botones ◀ ▶ de la pantalla). */
  rotate(dir: -1 | 1): void {
    this.spinBoost += dir * 2.2;
  }

  update(dt: number): void {
    super.update(dt);
    this.spinBoost *= Math.exp(-dt * 3);
    this.heading += dt * (0.45 + this.spinBoost);
    this.hero.setHeading(this.heading);
    this.camera.position.set(1.2, 2.2, 6.2);
    this.camera.lookAt(-0.9, 1.7, 0);
  }
}

/** Presentación de participantes: los 4 Guardianes entran en escena con una pose y su nombre. */
export class RosterStage extends BaseStage {
  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    labelRenderer: LabelRenderer,
    participants: Participant[]
  ) {
    super(scene, camera, 13);
    this.labelRenderer = labelRenderer;
    const n = participants.length;
    participants.forEach((p, i) => {
      const x = (i - (n - 1) / 2) * 3.2;
      const z = -Math.abs(i - (n - 1) / 2) * 0.5;
      const g = createGuardian(p.avatar);
      g.root.scale.setScalar(1.25);
      g.root.position.set(x, 9, z);
      g.setHeading(-x * 0.06);
      this.group.add(pad(x, z, p.controllerKind === "human" ? NeonPalette.gold : NeonPalette.cyan, 1.3));
      this.group.add(g.root);
      this.chars.push(g);
      const isHuman = p.controllerKind === "human";
      this.addLabel(g.root, isHuman ? "JUGADOR" : "BOT", p.name, 2.5, isHuman ? "stage-tag-human" : "");
      this.addLabel(g.root, "", isHuman ? "Tú" : p.avatar.tagline, -0.35, "stage-tag-sub");
      this.track(
        gsap.to(g.root.position, {
          y: 0.14,
          duration: 0.9,
          delay: 0.2 + i * 0.28,
          ease: "bounce.out",
          onComplete: () => {
            g.triggerReaction("celebrate", 1.1);
            g.showExpression(["happy", "wink", "determined", "surprised"][i % 4] as "happy", 1.6);
          }
        })
      );
    });
  }

  update(dt: number): void {
    super.update(dt);
    this.camera.position.set(0, 2.5, 9.4);
    this.camera.lookAt(0, 1.7, 0);
  }
}

export interface PodiumEntry {
  participantId: ParticipantId;
  name: string;
  score: number;
  rank: number;
}

const PODIUM_HEIGHT: Record<number, number> = { 1: 1.7, 2: 1.2, 3: 0.85, 4: 0.5 };

/**
 * Podio con los Guardianes completos. Las posiciones y los números salen de la MISMA lista de
 * `entries` que usa la tabla de la pantalla (una única fuente de datos).
 */
export class PodiumStage extends BaseStage {
  private winner: GuardianCharacter | null = null;
  private lastPartyAt = 0;
  private cheer: { char: GuardianCharacter; kind: "celebrate" | "lose" }[] = [];
  private nextCheer = 0.8;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    labelRenderer: LabelRenderer,
    entries: PodiumEntry[],
    avatars: Map<ParticipantId, AvatarDef>,
    private celebrateWinner: boolean,
    /** fracción del ancho de pantalla que ocupa el panel de la tabla (derecha) */
    private panelFraction = 0.42
  ) {
    super(scene, camera, 13);
    this.labelRenderer = labelRenderer;
    // el 1.º al centro: se reordena a [2.º, 1.º, 3.º, 4.º] (personas, no números: los empates conservan a todos)
    const ordered = [...entries].sort((a, b) => a.rank - b.rank);
    if (ordered.length > 1) [ordered[0], ordered[1]] = [ordered[1], ordered[0]];
    const n = ordered.length;
    ordered.forEach((e, i) => {
      const avatar = avatars.get(e.participantId)!;
      const x = (i - (n - 1) / 2) * 2.3;
      const h = PODIUM_HEIGHT[Math.min(4, Math.max(1, e.rank))];
      const isHuman = e.participantId === "human";
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, h, 1.9),
        new THREE.MeshStandardMaterial({ color: e.rank === 1 ? 0xffc83d : NeonPalette.nightLight, roughness: 0.4, metalness: 0.3 })
      );
      block.position.set(x, h / 2, 0);
      block.castShadow = true;
      block.receiveShadow = true;
      this.group.add(block);
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(1.96, 0.06, 1.96),
        new THREE.MeshStandardMaterial({
          color: isHuman ? NeonPalette.gold : NeonPalette.cyan,
          emissive: isHuman ? NeonPalette.gold : NeonPalette.cyan,
          emissiveIntensity: isHuman ? 2.4 : 1.2
        })
      );
      edge.position.set(x, h, 0);
      this.group.add(edge);

      const g = createGuardian(avatar);
      g.root.scale.setScalar(1.2);
      g.root.position.set(x, h + 6, 0);
      g.setHeading(-x * 0.05);
      this.group.add(g.root);
      this.chars.push(g);
      if (isHuman) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.15, 0.06, 8, 40),
          new THREE.MeshBasicMaterial({ color: NeonPalette.gold })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, h + 0.08, 0);
        ring.userData.spin = 0.4;
        this.group.add(ring);
      }
      this.addLabel(g.root, `#${e.rank}${isHuman ? " · TÚ" : ""}`, `${e.name} · ${e.score} pts`, 2.6, isHuman ? "stage-tag-human" : "");

      if (e.rank === 1) this.winner = g;
      const mood: "celebrate" | "lose" = e.rank <= 2 || (e.rank === 3 && n < 4) ? "celebrate" : "lose";
      this.cheer.push({ char: g, kind: e.rank === n && n > 2 && e.rank > 2 ? "lose" : mood });
      this.track(
        gsap.to(g.root.position, {
          y: h + 0.02,
          duration: 0.8,
          delay: 0.15 + (n - e.rank) * 0.3,
          ease: "bounce.out"
        })
      );
    });
    // los 'userData.spin' agregados después del studio no están en su animador: se giran aquí
    this.spinners = this.group.children.filter((c) => c.userData.spin !== undefined);
  }

  private spinners: THREE.Object3D[] = [];

  update(dt: number): void {
    super.update(dt);
    for (const s of this.spinners) s.rotation.z += dt * (s.userData.spin as number);
    this.nextCheer -= dt;
    if (this.nextCheer <= 0) {
      for (const c of this.cheer) c.char.triggerReaction(c.kind, 1.2);
      this.nextCheer = 1.7;
    }
    if (this.celebrateWinner && this.winner && this.t - this.lastPartyAt > 0.55 && this.t > 1.2) {
      this.lastPartyAt = this.t;
      const p = this.winner.root.position.clone().add(new THREE.Vector3(0, 2.4, 0));
      const colors = [NeonPalette.gold, NeonPalette.magenta, NeonPalette.cyan, NeonPalette.lime];
      this.bursts.emit(p, colors[Math.floor(Math.random() * colors.length)], 22, 4.5, 1.1);
    }
    // el podio se centra en la parte de la pantalla que NO tapa el panel de la tabla
    const d = 10.4;
    const aspect = this.camera.aspect;
    const visibleWidth = 2 * d * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect;
    const shift = aspect >= 1.3 ? (this.panelFraction / 2) * visibleWidth : 0;
    this.camera.position.set(shift, 3.2, d);
    this.camera.lookAt(shift, 1.7, 0);
  }
}
