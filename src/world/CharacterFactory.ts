import * as THREE from "three";
import type { AvatarDef, ExtraAccessoryId, HeadAccessoryId } from "../core/types";
import type { ParticipantState } from "../entities/Participant";
import { colorDef } from "../data/characters";

/**
 * Guardián Digital: robot pequeño y amigable, 100 % procedural (formas de three.js, sin
 * modelos externos). Un único modelo base para el jugador y los bots; cambian el color del
 * cuerpo y los accesorios. El visor muestra ojos expresivos dibujados en un lienzo pequeño.
 *
 * Los accesorios y colores son identidad visual: nunca indican si algo es seguro o engañoso (RNF06).
 */

export type Expression = "normal" | "happy" | "surprised" | "angry" | "sad" | "wink" | "determined" | "confused";

const HIP_Y = 0.62;
const FACE_W = 256;
const FACE_H = 160;

const hex = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;

function drawFace(ctx: CanvasRenderingContext2D, expr: Expression, glow: string): void {
  ctx.clearRect(0, 0, FACE_W, FACE_H);
  ctx.save();
  ctx.fillStyle = glow;
  ctx.strokeStyle = glow;
  ctx.lineCap = "round";
  ctx.lineWidth = 11;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 18;
  const lx = 84;
  const rx = 172;
  const ey = 66;
  const oval = (x: number, y: number, w: number, h: number): void => {
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  const arc = (x: number, y: number, r: number, from: number, to: number): void => {
    ctx.beginPath();
    ctx.arc(x, y, r, from, to);
    ctx.stroke();
  };
  const smile = (w: number, h: number): void => {
    ctx.beginPath();
    ctx.moveTo(128 - w, 118);
    ctx.quadraticCurveTo(128, 118 + h, 128 + w, 118);
    ctx.stroke();
  };
  switch (expr) {
    case "normal":
      oval(lx, ey, 22, 30);
      oval(rx, ey, 22, 30);
      smile(20, 16);
      break;
    case "happy":
      arc(lx, ey + 14, 22, Math.PI * 1.05, Math.PI * 1.95);
      arc(rx, ey + 14, 22, Math.PI * 1.05, Math.PI * 1.95);
      smile(34, 30);
      break;
    case "surprised":
      oval(lx, ey, 26, 34);
      oval(rx, ey, 26, 34);
      ctx.lineWidth = 9;
      arc(128, 120, 11, 0, Math.PI * 2);
      break;
    case "angry":
      ctx.beginPath();
      ctx.moveTo(lx - 24, ey - 20);
      ctx.lineTo(lx + 20, ey + 8);
      ctx.moveTo(rx + 24, ey - 20);
      ctx.lineTo(rx - 20, ey + 8);
      ctx.stroke();
      oval(lx, ey + 14, 16, 18);
      oval(rx, ey + 14, 16, 18);
      ctx.beginPath();
      ctx.moveTo(108, 126);
      ctx.quadraticCurveTo(128, 112, 148, 126);
      ctx.stroke();
      break;
    case "sad":
      oval(lx, ey + 6, 20, 26);
      oval(rx, ey + 6, 20, 26);
      ctx.beginPath();
      ctx.moveTo(lx - 24, ey - 22);
      ctx.lineTo(lx + 18, ey - 12);
      ctx.moveTo(rx + 24, ey - 22);
      ctx.lineTo(rx - 18, ey - 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(110, 128);
      ctx.quadraticCurveTo(128, 112, 146, 128);
      ctx.stroke();
      break;
    case "wink":
      oval(lx, ey, 22, 30);
      ctx.beginPath();
      ctx.moveTo(rx - 20, ey - 16);
      ctx.lineTo(rx + 12, ey);
      ctx.lineTo(rx - 20, ey + 16);
      ctx.stroke();
      smile(26, 22);
      break;
    case "determined":
      ctx.beginPath();
      ctx.ellipse(lx, ey + 6, 22, 24, 0, Math.PI, Math.PI * 2, true);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(rx, ey + 6, 22, 24, 0, Math.PI, Math.PI * 2, true);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(110, 122);
      ctx.lineTo(146, 122);
      ctx.stroke();
      break;
    case "confused":
      ctx.lineWidth = 8;
      arc(lx, ey, 24, 0, Math.PI * 2);
      arc(lx, ey, 9, 0, Math.PI * 2);
      arc(rx, ey, 24, 0, Math.PI * 2);
      arc(rx, ey, 9, 0, Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(108, 122);
      ctx.quadraticCurveTo(122, 112, 128, 122);
      ctx.quadraticCurveTo(136, 132, 148, 120);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

type ReactionKind = "none" | "celebrate" | "lose" | "pickup";

export class GuardianCharacter {
  readonly root = new THREE.Group();
  private hips = new THREE.Group();
  private head = new THREE.Group();
  private torso!: THREE.Mesh;
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private fins: THREE.Mesh[] = [];
  private cape: THREE.Group | null = null;

  private shotTimer = 0;
  private throwTimer = 0;
  private armed = false;
  private holdingOrb = false;
  private walkPhase = 0;
  private bobPhase = Math.random() * Math.PI * 2;
  private reactionTimer = 0;
  private reactionKind: ReactionKind = "none";
  private reactionMood: "happy" | "sad" = "happy";
  private yawRate = 0;
  private lastHeading = 0;
  private headingInit = false;
  private forcedExpression: { expr: Expression; until: number } | null = null;

  private faceCtx!: CanvasRenderingContext2D;
  private faceTex!: THREE.CanvasTexture;
  private expression: Expression = "normal";
  private faceDrawn = false;
  private glowCss: string;

  constructor(readonly avatar: AvatarDef) {
    this.glowCss = hex(colorDef(avatar.appearance.color).glow);
    this.build();
    this.setExpression("normal");
  }

  // ---------------- construcción ----------------

  private build(): void {
    const app = this.avatar.appearance;
    const c = colorDef(app.color);
    const shell = new THREE.MeshStandardMaterial({ color: c.shell, roughness: 0.32, metalness: 0.12 });
    const trim = new THREE.MeshStandardMaterial({ color: c.trim, roughness: 0.4, metalness: 0.1 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b2144, roughness: 0.5, metalness: 0.35 });
    const visor = new THREE.MeshStandardMaterial({ color: 0x070b24, roughness: 0.12, metalness: 0.7 });
    const glow = new THREE.MeshStandardMaterial({ color: c.glow, emissive: c.glow, emissiveIntensity: 1.8, roughness: 0.4 });

    this.root.add(this.hips);
    this.hips.position.y = HIP_Y;

    // Torso redondeado, placa pectoral luminosa y cinturón
    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.26, 6, 14), shell);
    this.torso.position.y = 0.32;
    this.torso.castShadow = true;
    this.hips.add(this.torso);
    const chest = new THREE.Mesh(new THREE.OctahedronGeometry(0.075), glow);
    chest.scale.set(1, 1, 0.35);
    chest.position.set(0, 0.4, 0.255);
    this.hips.add(chest);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.032, 8, 24), dark);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.14;
    this.hips.add(belt);

    // Cabeza: casco + visor oscuro con ojos luminosos
    this.head.position.y = 0.8;
    this.hips.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 18), shell);
    skull.scale.set(1.12, 1.0, 1.04);
    skull.castShadow = true;
    this.head.add(skull);
    const visorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), visor);
    visorMesh.scale.set(1.0, 0.72, 0.55);
    visorMesh.position.set(0, 0.0, 0.2);
    this.head.add(visorMesh);

    const canvas = document.createElement("canvas");
    canvas.width = FACE_W;
    canvas.height = FACE_H;
    this.faceCtx = canvas.getContext("2d")!;
    this.faceTex = new THREE.CanvasTexture(canvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.288),
      new THREE.MeshBasicMaterial({ map: this.faceTex, transparent: true, depthWrite: false, toneMapped: false })
    );
    face.position.set(0, 0.0, 0.372);
    this.head.add(face);

    // Orejas-aleta (acento) y auriculares laterales de la base
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.36, 8), trim);
      fin.position.set(side * 0.24, 0.34, -0.03);
      fin.rotation.z = side * -0.32;
      this.head.add(fin);
      this.fins.push(fin);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.09, 16), dark);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(side * 0.35, 0, 0);
      this.head.add(cup);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.016, 8, 20), glow);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(side * 0.4, 0, 0);
      this.head.add(ring);
    }

    this.buildHeadAccessory(app.head, trim, dark, glow, shell);
    this.buildExtra(app.extra, trim, dark, glow, shell);

    // Brazos: hombro + brazo + guante
    for (const side of [-1, 1]) {
      const arm = side === 1 ? this.armL : this.armR;
      arm.position.set(side * 0.34, 0.5, 0);
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), shell);
      arm.add(shoulder);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.2, 4, 10), shell);
      upper.position.y = -0.19;
      upper.castShadow = true;
      arm.add(upper);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), dark);
      hand.position.y = -0.4;
      arm.add(hand);
      this.hips.add(arm);
    }

    // Piernas con botas grandes
    for (const side of [-1, 1]) {
      const leg = side === 1 ? this.legL : this.legR;
      leg.position.set(side * 0.13, 0.02, 0);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.26, 4, 10), dark);
      shin.position.y = -0.2;
      leg.add(shin);
      const boot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), shell);
      boot.scale.set(1.05, 0.8, 1.55);
      boot.position.set(0, -0.47, 0.06);
      boot.castShadow = true;
      leg.add(boot);
      const sole = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 8), trim);
      sole.scale.set(1.12, 0.26, 1.62);
      sole.position.set(0, -0.58, 0.06);
      leg.add(sole);
      this.hips.add(leg);
    }
  }

  private buildHeadAccessory(kind: HeadAccessoryId, trim: THREE.Material, dark: THREE.Material, glow: THREE.Material, shell: THREE.Material): void {
    const g = this.head;
    switch (kind) {
      case "cap": {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.345, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.46), trim);
        dome.scale.set(1.12, 1, 1.04);
        dome.position.y = 0.06;
        g.add(dome);
        const brim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.26), trim);
        brim.position.set(0, 0.2, 0.36);
        brim.rotation.x = -0.18;
        g.add(brim);
        break;
      }
      case "glasses": {
        for (const side of [-1, 1]) {
          const rim = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 8, 20), glow);
          rim.position.set(side * 0.115, 0.01, 0.39);
          g.add(rim);
          const lens = new THREE.Mesh(
            new THREE.CircleGeometry(0.085, 20),
            new THREE.MeshBasicMaterial({ color: 0x7ee8ff, transparent: true, opacity: 0.18, depthWrite: false })
          );
          lens.position.set(side * 0.115, 0.01, 0.392);
          g.add(lens);
        }
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.015), glow);
        bridge.position.set(0, 0.02, 0.39);
        g.add(bridge);
        break;
      }
      case "headphones": {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.022, 8, 28, Math.PI), dark);
        band.position.set(0, 0, 0);
        g.add(band);
        for (const side of [-1, 1]) {
          const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.11, 18), trim);
          cup.rotation.z = Math.PI / 2;
          cup.position.set(side * 0.375, 0, 0);
          g.add(cup);
        }
        break;
      }
      case "hood": {
        const hood = new THREE.Mesh(
          new THREE.SphereGeometry(0.375, 22, 14, Math.PI / 2 + 0.75, Math.PI * 2 - 1.5, 0, Math.PI * 0.78),
          trim
        );
        hood.scale.set(1.12, 1.02, 1.06);
        hood.material = (trim as THREE.MeshStandardMaterial).clone();
        (hood.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
        g.add(hood);
        break;
      }
      case "hat": {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 24), dark);
        brim.position.y = 0.26;
        brim.rotation.z = 0.08;
        g.add(brim);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.26, 20), dark);
        crown.position.y = 0.4;
        crown.rotation.z = 0.08;
        g.add(crown);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.05, 20), trim);
        band.position.y = 0.3;
        band.rotation.z = 0.08;
        g.add(band);
        break;
      }
      default:
        break;
    }
    void shell;
  }

  private buildExtra(kind: ExtraAccessoryId, trim: THREE.Material, dark: THREE.Material, glow: THREE.Material, shell: THREE.Material): void {
    switch (kind) {
      case "scarf": {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 10, 24), trim);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.6;
        this.hips.add(ring);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.04), trim);
        tail.position.set(0.15, 0.42, 0.2);
        tail.rotation.z = 0.12;
        this.hips.add(tail);
        break;
      }
      case "cape": {
        const pivot = new THREE.Group();
        pivot.position.set(0, 0.62, -0.26);
        const mat = (shell as THREE.MeshStandardMaterial).clone();
        mat.color.multiplyScalar(0.8);
        mat.side = THREE.DoubleSide;
        const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.03), mat);
        cloth.position.y = -0.38;
        pivot.add(cloth);
        this.hips.add(pivot);
        this.cape = pivot;
        break;
      }
      case "backpack": {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.44, 0.2), dark);
        body.position.set(0, 0.34, -0.33);
        body.castShadow = true;
        this.hips.add(body);
        for (const r of [Math.PI / 4, -Math.PI / 4]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.012), glow);
          bar.position.set(0, 0.34, -0.435);
          bar.rotation.z = r;
          this.hips.add(bar);
        }
        break;
      }
      default:
        break;
    }
  }

  // ---------------- expresiones ----------------

  setExpression(expr: Expression): void {
    if (expr === this.expression && this.faceDrawn) return;
    this.faceDrawn = true;
    this.expression = expr;
    drawFace(this.faceCtx, expr, this.glowCss);
    this.faceTex.needsUpdate = true;
  }

  /** Fuerza una expresión durante unos segundos (p. ej. la presentación de participantes). */
  showExpression(expr: Expression, seconds = 1.5): void {
    this.forcedExpression = { expr, until: performance.now() + seconds * 1000 };
    this.setExpression(expr);
  }

  // ---------------- animación ----------------

  triggerShot(): void {
    this.shotTimer = 0.32;
  }

  /** Gesto de lanzar el orbe (brazo adelante). */
  triggerThrow(): void {
    this.throwTimer = 0.45;
    this.holdingOrb = false;
  }

  /** Sostiene el orbe sobre la cabeza (brazos arriba) mientras lo tiene. */
  setHoldingOrb(holding: boolean): void {
    this.holdingOrb = holding;
  }

  /** Reacciones puntuales: celebrar, error, o agacharse a recoger (con un ánimo al terminar). */
  triggerReaction(kind: "celebrate" | "lose" | "pickup", durationSeconds = 1.4, mood: "happy" | "sad" = "happy"): void {
    this.reactionKind = kind;
    this.reactionTimer = durationSeconds;
    this.reactionMood = mood;
  }

  /**
   * @param speed01 0..1 relativo a la velocidad máxima
   * @param state estado lógico del participante
   */
  update(dt: number, speed01: number, state: ParticipantState): void {
    this.shotTimer = Math.max(0, this.shotTimer - dt);
    this.throwTimer = Math.max(0, this.throwTimer - dt);
    this.head.rotation.set(0, 0, 0);
    this.legL.rotation.x = this.legR.rotation.x = 0;
    this.hips.rotation.set(0, 0, 0);
    this.bobPhase += dt * 2.2;
    this.walkPhase += dt * (6 + speed01 * 6);
    const now = performance.now();

    // giro: inclina el cuerpo hacia el lado al que gira
    const yawLean = THREE.MathUtils.clamp(this.yawRate * 0.05, -0.28, 0.28);
    this.yawRate *= Math.exp(-dt * 8);

    if (this.reactionTimer > 0) {
      this.reactionTimer -= dt;
      if (this.reactionTimer <= 0) this.reactionKind = "none";
    }

    // expresión según el estado
    let expr: Expression = "normal";
    if (this.reactionKind === "celebrate" || state === "celebrating") expr = "happy";
    else if (this.reactionKind === "lose" || state === "losing") expr = "sad";
    else if (this.reactionKind === "pickup") expr = this.reactionMood === "happy" ? "happy" : "surprised";
    else if (this.shotTimer > 0) expr = "wink";
    else if (this.holdingOrb) expr = "surprised";
    else if (state === "deciding") expr = "determined";
    if (this.forcedExpression) {
      if (now < this.forcedExpression.until) expr = this.forcedExpression.expr;
      else this.forcedExpression = null;
    }
    if (expr !== this.expression) this.setExpression(expr);

    this.hips.position.y = HIP_Y;

    if (this.throwTimer > 0) {
      const k = this.throwTimer / 0.45;
      this.armR.rotation.x = -2.3 + (1 - k) * 2.2;
      this.armL.rotation.x = -0.4;
      this.hips.rotation.x = 0.1 * (1 - k);
      return;
    }
    if (this.holdingOrb) {
      const sway = Math.sin(this.bobPhase * 1.3) * 0.08;
      this.armL.rotation.x = -2.55 + sway;
      this.armR.rotation.x = -2.55 - sway;
      this.armL.rotation.z = -0.25;
      this.armR.rotation.z = 0.25;
      this.head.rotation.x = -0.15;
      this.armL.rotation.z = 0;
      this.armR.rotation.z = 0;
      this.hips.rotation.z = yawLean;
      return;
    }
    if (this.shotTimer > 0) {
      this.armR.rotation.x = -1.45 - Math.sin((this.shotTimer / 0.32) * Math.PI) * 0.3;
      this.armL.rotation.x = -0.6;
      this.hips.rotation.x = -0.06;
      return;
    }
    if (this.reactionKind === "pickup") {
      const k = 1 - this.reactionTimer / 0.5;
      const dip = Math.sin(Math.min(1, Math.max(0, k)) * Math.PI);
      this.hips.rotation.x = 0.45 * dip;
      this.hips.position.y = HIP_Y - 0.08 * dip;
      this.armL.rotation.x = -0.9 * dip;
      this.armR.rotation.x = -0.9 * dip;
      this.head.rotation.x = 0.2 * dip;
      return;
    }
    if (this.reactionKind === "celebrate" || state === "celebrating") {
      const t = now * 0.006;
      this.hips.position.y = HIP_Y + Math.abs(Math.sin(t * 3)) * 0.12;
      this.armL.rotation.x = -2.6 + Math.sin(t * 6) * 0.3;
      this.armR.rotation.x = -2.6 - Math.sin(t * 6) * 0.3;
      this.head.rotation.z = Math.sin(t * 5) * 0.15;
      return;
    }
    if (this.reactionKind === "lose" || state === "losing") {
      this.hips.position.y = HIP_Y - 0.06;
      this.head.rotation.x = 0.35;
      this.armL.rotation.x = 0.3;
      this.armR.rotation.x = 0.3;
      this.hips.rotation.z = Math.sin(now * 0.02) * 0.04;
      return;
    }
    if (state === "deciding") {
      this.head.rotation.z = Math.sin(this.bobPhase * 0.8) * 0.18;
      this.head.rotation.x = 0.06;
      this.armL.rotation.x = 0.15;
      this.armR.rotation.x = this.armed ? -1.2 : 0.15;
      return;
    }

    // idle / running / acting: caminata con inclinación, balanceo y contra-giro de cabeza
    const amp = speed01 * 0.7;
    this.legL.rotation.x = Math.sin(this.walkPhase) * amp;
    this.legR.rotation.x = Math.sin(this.walkPhase + Math.PI) * amp;
    this.armL.rotation.x = Math.sin(this.walkPhase + Math.PI) * amp * 0.8;
    this.armR.rotation.x = this.armed ? -1.2 + Math.sin(this.walkPhase) * amp * 0.15 : Math.sin(this.walkPhase) * amp * 0.8;

    this.hips.rotation.x = speed01 * 0.16;
    this.hips.rotation.z = Math.sin(this.walkPhase) * 0.05 * speed01 + yawLean;
    this.head.rotation.z = -Math.sin(this.walkPhase) * 0.045 * speed01 - yawLean * 0.5;
    this.head.rotation.y = Math.sin(this.walkPhase * 0.5) * 0.03 * speed01 + yawLean * 0.6;

    if (speed01 > 0.05) {
      this.hips.position.y = HIP_Y + Math.max(0, Math.sin(this.bobPhase)) * 0.02;
      this.torso.scale.set(1, 1, 1);
    } else {
      // respiración suave al estar quieto
      const breathe = Math.sin(this.bobPhase * 0.9) * 0.02;
      this.torso.scale.set(1 + breathe * 0.5, 1 + breathe, 1 + breathe * 0.5);
      this.head.rotation.x = Math.sin(this.bobPhase * 0.45) * 0.02;
      this.hips.position.y = HIP_Y + Math.max(0, Math.sin(this.bobPhase)) * 0.015;
    }

    // aletas de las orejas y capa: movimiento secundario
    this.fins.forEach((f, i) => (f.rotation.x = Math.sin(this.bobPhase * 1.4 + i) * 0.06 - speed01 * 0.18));
    if (this.cape) this.cape.rotation.x = 0.1 + speed01 * 0.5 + Math.sin(this.bobPhase * 2) * 0.04;
  }

  setHeading(radians: number): void {
    if (this.headingInit) {
      let d = radians - this.lastHeading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yawRate = THREE.MathUtils.lerp(this.yawRate, d * 60, 0.5);
    }
    this.lastHeading = radians;
    this.headingInit = true;
    this.root.rotation.y = radians;
  }

  /** Engancha un objeto (p. ej. el blaster de Cazaengaños) a la mano derecha. */
  attachToRightHand(obj: THREE.Object3D, localOffset = new THREE.Vector3(0.03, -0.4, 0.1)): void {
    this.armed = true;
    obj.rotation.set(Math.PI / 2, Math.PI, 0);
    obj.position.copy(localOffset);
    this.armR.add(obj);
  }

  /** Posición mundial de la mano derecha (origen de proyectiles). */
  getRightHandWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    this.armR.updateWorldMatrix(true, false);
    return target
      .setFromMatrixPosition(this.armR.matrixWorld)
      .add(new THREE.Vector3(0.03, -0.4, 0.1).applyQuaternion(this.armR.getWorldQuaternion(new THREE.Quaternion())));
  }

  dispose(): void {
    this.faceTex.dispose();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
  }
}

export function createGuardian(avatar: AvatarDef): GuardianCharacter {
  return new GuardianCharacter(avatar);
}
