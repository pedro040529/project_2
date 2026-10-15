import * as THREE from "three";
import type { AvatarDef } from "../core/types";
import type { ParticipantState } from "../entities/Participant";
import { feltFlat } from "./Materials";

/**
 * Personajes "de manualidad" 100% procedurales (fieltro/cartón/madera vía
 * primitivas + materiales cálidos) — nada de modelos de terceros. La silueta
 * (mohawk / orejas / antena / gorro) es lo único que identifica a cada
 * participante a distancia; el color solo refuerza identidad, nunca marca
 * "bueno" o "malo" (RNF06).
 */
export class CraftCharacter {
  readonly root = new THREE.Group();
  private hips = new THREE.Group();
  private head = new THREE.Group();
  private shotTimer = 0;
  private armed = false;
  triggerShot(): void { this.shotTimer = 0.32; }

  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private accessory = new THREE.Group();
  private walkPhase = 0;
  private bobPhase = Math.random() * Math.PI * 2;
  private reactionTimer = 0;
  private reactionKind: "none" | "celebrate" | "lose" = "none";
  private torso!: THREE.Mesh;

  constructor(readonly avatar: AvatarDef) {
    this.build();
  }

  private build(): void {
    const primary = feltFlat(this.avatar.primaryColor);
    const accent = feltFlat(this.avatar.accentColor);
    const inkMat = feltFlat(0x402a1f, 0.9);

    this.root.add(this.hips);
    this.hips.position.y = 0.62;

    // Torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.42, 4, 10), primary);
    torso.position.y = 0.34;
    torso.castShadow = true;
    this.hips.add(torso);
    this.torso = torso;

    // Botones de fieltro (acento) bajando por el torso
    for (let i = 0; i < 3; i++) {
      const button = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), accent);
      button.position.set(0, 0.55 - i * 0.16, 0.3);
      this.hips.add(button);
    }

    // Cabeza
    this.head.position.y = 0.78;
    this.hips.add(this.head);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 14), primary);
    headMesh.scale.set(1, 0.94, 0.98);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    // Ojos (simples, redondos, misma pareja para los 4 — no delatan nada)
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), inkMat);
      eye.position.set(side * 0.1, 0.02, 0.24);
      this.head.add(eye);
    }
    // mejillas de fieltro (acento) — toque artesanal, no semántico
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), accent);
      cheek.position.set(side * 0.17, -0.06, 0.245);
      cheek.rotation.y = side * -0.5;
      this.head.add(cheek);
    }

    this.buildAccessory(accent, primary, inkMat);
    this.head.add(this.accessory);

    // Brazos
    this.armL = this.buildLimb(primary, 0.16, 0.34, true);
    this.armR = this.buildLimb(primary, 0.16, 0.34, true);
    this.armL.position.set(0.34, 0.52, 0);
    this.armR.position.set(-0.34, 0.52, 0);
    this.hips.add(this.armL, this.armR);

    // Piernas
    this.legL = this.buildLimb(accent, 0.17, 0.38, false);
    this.legR = this.buildLimb(accent, 0.17, 0.38, false);
    this.legL.position.set(0.14, 0.02, 0);
    this.legR.position.set(-0.14, 0.02, 0);
    this.hips.add(this.legL, this.legR);
  }

  private buildLimb(mat: THREE.Material, radius: number, length: number, isArm: boolean): THREE.Group {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius * 0.55, length, 4, 8), mat);
    mesh.position.y = -length * 0.5 - radius * 0.4;
    mesh.castShadow = true;
    pivot.add(mesh);
    if (!isArm) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.62, 8, 8), mat);
      foot.position.y = -length - radius * 0.5;
      foot.scale.set(1.15, 0.7, 1.3);
      pivot.add(foot);
    }
    return pivot;
  }

  private buildAccessory(accent: THREE.Material, primary: THREE.Material, ink: THREE.Material): void {
    switch (this.avatar.silhouette) {
      case "mohawk": {
        for (let i = -1; i <= 1; i++) {
          const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22 - Math.abs(i) * 0.05, 6), accent);
          fin.position.set(0, 0.24 + Math.abs(i) * -0.02, i * 0.09);
          fin.rotation.x = -0.15;
          this.accessory.add(fin);
        }
        break;
      }
      case "ears": {
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 8), primary);
          ear.position.set(side * 0.2, 0.2, -0.02);
          ear.rotation.z = side * -0.35;
          this.accessory.add(ear);
          const inner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), accent);
          inner.position.copy(ear.position);
          inner.rotation.copy(ear.rotation);
          inner.position.z += 0.03;
          this.accessory.add(inner);
        }
        break;
      }
      case "antenna": {
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.26, 6), accent);
        stick.position.set(0, 0.34, 0);
        this.accessory.add(stick);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), accent);
        tip.position.set(0, 0.47, 0);
        tip.name = "antennaTip";
        this.accessory.add(tip);
        break;
      }
      case "cap": {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), accent);
        dome.position.y = 0.16;
        this.accessory.add(dome);
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), accent);
        brim.position.y = 0.06;
        this.accessory.add(brim);
        const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), primary);
        pompom.position.y = 0.42;
        this.accessory.add(pompom);
        break;
      }
    }
    void ink;
  }

  /** Reacciones puntuales que se ven a la distancia (acierto/celebración o error/derrota). */
  triggerReaction(kind: "celebrate" | "lose", durationSeconds = 1.4): void {
    this.reactionKind = kind;
    this.reactionTimer = durationSeconds;
  }

  /**
   * @param speed01 0..1 relativo a la velocidad máxima (controla amplitud del ciclo de correr)
   * @param state estado lógico del participante (idle/running/celebrating/losing/deciding/acting)
   */
  update(dt: number, speed01: number, state: ParticipantState): void {
    this.shotTimer = Math.max(0, this.shotTimer - dt);
    this.head.rotation.set(0, 0, 0);
    this.legL.rotation.x = this.legR.rotation.x = 0;
    this.bobPhase += dt * 2.2;
    this.walkPhase += dt * (6 + speed01 * 6);

    if (this.reactionTimer > 0) {
      this.reactionTimer -= dt;
      if (this.reactionTimer <= 0) this.reactionKind = "none";
    }

    if (this.shotTimer > 0) {
      this.armR.rotation.x = -1.45 - Math.sin(this.shotTimer / 0.32 * Math.PI) * 0.3;
      this.armL.rotation.x = -0.6;
      this.hips.rotation.x = -0.06;
      return;
    }
    if (this.reactionKind === "celebrate" || state === "celebrating") {
      this.torso.scale.set(1, 1, 1);
      this.hips.rotation.set(0, 0, 0);
      const t = performance.now() * 0.006;
      this.hips.position.y = 0.62 + Math.abs(Math.sin(t * 3)) * 0.12;
      this.armL.rotation.x = -2.6 + Math.sin(t * 6) * 0.3;
      this.armR.rotation.x = -2.6 - Math.sin(t * 6) * 0.3;
      this.head.rotation.z = Math.sin(t * 5) * 0.15;
      return;
    }

    if (this.reactionKind === "lose" || state === "losing") {
      this.torso.scale.set(1, 1, 1);
      this.hips.rotation.set(0, 0, 0);
      this.hips.position.y = 0.56;
      this.head.rotation.x = 0.35;
      this.armL.rotation.x = 0.3;
      this.armR.rotation.x = 0.3;
      this.legL.rotation.x = 0;
      this.legR.rotation.x = 0;
      return;
    }

    if (state === "deciding") {
      this.torso.scale.set(1, 1, 1);
      this.hips.rotation.set(0, 0, 0);
      this.head.rotation.z = Math.sin(this.bobPhase * 0.8) * 0.18;
      this.head.rotation.x = 0.06;
      this.armL.rotation.x = 0.15;
      this.armR.rotation.x = 0.15;
      return;
    }

    // idle / running / acting: ciclo de caminata/correr, con inclinación,
    // balanceo de caderas y contra-giro de cabeza para que no se sienta
    // como un metrónomo — antes era solo piernas/brazos en tijera.
    const amp = speed01 * 0.7;
    this.legL.rotation.x = Math.sin(this.walkPhase) * amp;
    this.legR.rotation.x = Math.sin(this.walkPhase + Math.PI) * amp;
    this.armL.rotation.x = Math.sin(this.walkPhase + Math.PI) * amp * 0.8;
    this.armR.rotation.x = this.armed ? -1.2 + Math.sin(this.walkPhase) * amp * 0.15 : Math.sin(this.walkPhase) * amp * 0.8;

    this.hips.rotation.x = speed01 * 0.16; // se inclina hacia adelante al correr
    this.hips.rotation.z = Math.sin(this.walkPhase) * 0.05 * speed01; // balanceo lateral de caderas
    this.head.rotation.z = -Math.sin(this.walkPhase) * 0.045 * speed01; // contra-balanceo de cabeza
    this.head.rotation.y = Math.sin(this.walkPhase * 0.5) * 0.03 * speed01;

    if (speed01 > 0.05) {
      this.head.rotation.x = 0;
      this.hips.position.y = 0.62 + Math.max(0, Math.sin(this.bobPhase)) * 0.02;
      this.torso.scale.set(1, 1, 1);
    } else {
      // respiración suave al estar quieto: sin esto se sentía "congelado" entre acciones
      const breathe = Math.sin(this.bobPhase * 0.9) * 0.02;
      this.torso.scale.set(1 + breathe * 0.5, 1 + breathe, 1 + breathe * 0.5);
      this.head.rotation.x = Math.sin(this.bobPhase * 0.45) * 0.02;
      this.hips.position.y = 0.62 + Math.max(0, Math.sin(this.bobPhase)) * 0.015;
    }

    const tip = this.accessory.getObjectByName("antennaTip");
    if (tip) tip.position.y = 0.47 + Math.sin(this.bobPhase * 1.4) * 0.015;
  }

  setHeading(radians: number): void {
    this.root.rotation.y = radians;
  }

  /** Engancha un objeto (ej. el blaster de Cazaengaños) a la mano derecha. */
  attachToRightHand(obj: THREE.Object3D, localOffset = new THREE.Vector3(0.03, -0.4, 0.1)): void {
    this.armed = true;
    obj.rotation.set(Math.PI / 2, Math.PI, 0);
    obj.position.copy(localOffset);
    this.armR.add(obj);
  }

  /** Posición mundial de la mano derecha (para el origen de las balas/tracers). */
  getRightHandWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    this.armR.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(this.armR.matrixWorld).add(new THREE.Vector3(0.03, -0.4, 0.1).applyQuaternion(this.armR.getWorldQuaternion(new THREE.Quaternion())));
  }
}

export function createCraftCharacter(avatar: AvatarDef): CraftCharacter {
  return new CraftCharacter(avatar);
}
