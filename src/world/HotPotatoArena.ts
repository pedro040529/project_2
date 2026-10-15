import * as THREE from "three";
import { craftMaterial, feltFlat, CraftPalette } from "./Materials";
import type { ArenaBuild } from "./ArenaFactory";
import type { PhysicsWorld } from "./PhysicsWorld";

/** Arena circular pequeña de Bajo Presión: los 4 alrededor de un centro compartido.
 *  Firma compatible con buildSharedArena (recibe `physics` aunque no agregue colliders) para
 *  que ArenaRuntime pueda reutilizarse tal cual entre los 3 minijuegos. */
export function buildHotPotatoArena(radius: number, _physics?: PhysicsWorld): ArenaBuild {
  const group = new THREE.Group();
  const collidables: THREE.Object3D[] = [];

  const ground = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), craftMaterial("felt", { repeat: 3, color: CraftPalette.mustardFelt, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.14, 8, 40), craftMaterial("wood", { repeat: 1 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.02;
  group.add(rim);

  // Cojines de fieltro marcando los 4 puestos alrededor
  const cushionColors = [CraftPalette.coralFelt, CraftPalette.tealFelt, CraftPalette.plumFelt, CraftPalette.mustardFelt];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.14, 16), feltFlat(cushionColors[i], 0.9));
    cushion.position.set(Math.cos(angle) * radius * 0.72, 0.07, Math.sin(angle) * radius * 0.72);
    cushion.castShadow = true;
    cushion.receiveShadow = true;
    group.add(cushion);
  }

  // decoración de fondo: farolitos de papel en el perímetro
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + 0.2;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6), craftMaterial("wood", { repeat: 0.4 }));
    const x = Math.cos(angle) * (radius + 1.4);
    const z = Math.sin(angle) * (radius + 1.4);
    stick.position.set(x, 0.65, z);
    group.add(stick);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), craftMaterial("paper", { color: 0xffe9b8, repeat: 1 }));
    lantern.position.set(x, 1.35, z);
    group.add(lantern);
  }

  return { group, collidables, radius };
}
