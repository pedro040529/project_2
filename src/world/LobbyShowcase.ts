import * as THREE from "three";
import { NPC_AVATARS, PLAYER_AVATAR_OPTIONS, buildHumanAvatar } from "../data/characters";
import { createCraftCharacter, type CraftCharacter } from "./CharacterFactory";
import { craftMaterial, feltFlat, CraftPalette } from "./Materials";

/**
 * Vitrina 3D decorativa detrás del lobby / selección / presentación: los 4
 * personajes posando en un pequeño escenario circular con cámara orbitando
 * despacio. Reemplaza el fondo vacío por algo que se sienta "el juego de
 * verdad" desde el primer segundo. Se descarta apenas arranca la partida.
 */
export class LobbyShowcase {
  private group = new THREE.Group();
  private characters: CraftCharacter[] = [];
  private orbitAngle = 0.65;
  private t = 0;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera
  ) {
    this.build();
  }

  private build(): void {
    const radius = 5.4;

    const stage = new THREE.Mesh(new THREE.CircleGeometry(radius + 1.6, 40), craftMaterial("felt", { repeat: 2.4, color: CraftPalette.mustardFelt, roughness: 1 }));
    stage.rotation.x = -Math.PI / 2;
    stage.receiveShadow = true;
    this.group.add(stage);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius + 1.6, 0.1, 8, 40), craftMaterial("wood", { repeat: 1 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.02;
    this.group.add(rim);

    // confeti de fieltro flotando (decorativo, sin física)
    const confettiColors = [CraftPalette.coralFelt, CraftPalette.tealFelt, CraftPalette.plumFelt, CraftPalette.white];
    for (let i = 0; i < 14; i++) {
      const piece = new THREE.Mesh(new THREE.CircleGeometry(0.08, 6), feltFlat(confettiColors[i % confettiColors.length], 0.8));
      const a = (i / 14) * Math.PI * 2;
      piece.position.set(Math.cos(a) * (radius + 0.8 + Math.random() * 1.2), 1.2 + Math.random() * 2.2, Math.sin(a) * (radius + 0.8 + Math.random() * 1.2));
      piece.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      piece.userData.spin = 0.3 + Math.random() * 0.6;
      piece.userData.bob = Math.random() * Math.PI * 2;
      this.group.add(piece);
    }

    const avatars = [
      buildHumanAvatar(PLAYER_AVATAR_OPTIONS[0], "Tú"),
      NPC_AVATARS.nova,
      NPC_AVATARS.kiro,
      NPC_AVATARS.pixel
    ];

    avatars.forEach((avatar, i) => {
      const angle = (i / avatars.length) * Math.PI * 2 + Math.PI / 4;
      const c = createCraftCharacter(avatar);
      c.root.position.set(Math.cos(angle) * radius * 0.62, 0, Math.sin(angle) * radius * 0.62);
      c.setHeading(-angle + Math.PI / 2);
      this.group.add(c.root);
      this.characters.push(c);
    });

    this.scene.add(this.group);
  }

  update(dt: number): void {
    this.t += dt;
    this.orbitAngle += dt * 0.12;

    for (const c of this.characters) {
      c.update(dt, 0, "idle");
    }

    for (const child of this.group.children) {
      if (child.userData.spin !== undefined) {
        child.rotation.z += dt * child.userData.spin;
        child.position.y += Math.sin(this.t * 1.4 + child.userData.bob) * 0.002;
      }
    }

    const camRadius = 8.6;
    const camHeight = 3.4 + Math.sin(this.t * 0.25) * 0.5;
    this.camera.position.set(Math.cos(this.orbitAngle) * camRadius, camHeight, Math.sin(this.orbitAngle) * camRadius);
    this.camera.lookAt(0, 1.1, 0);
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}
