import * as THREE from "three";
import { craftMaterial, feltFlat, CraftPalette } from "./Materials";
import type { PhysicsWorld } from "./PhysicsWorld";

export interface ArenaBuild {
  group: THREE.Group;
  /** meshes sólidos contra los que la cámara no debe atravesar */
  collidables: THREE.Object3D[];
  radius: number;
}

function cardboardTree(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.9, 8), craftMaterial("cardboard", { repeat: 1 }));
  trunk.position.y = 0.45;
  trunk.castShadow = true;
  g.add(trunk);
  const foliageMat = feltFlat(CraftPalette.tealFelt, 0.95);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 - i * 0.12, 0), foliageMat);
    s.position.y = 1.05 + i * 0.42;
    s.castShadow = true;
    g.add(s);
  }
  return g;
}

function pompomBush(): THREE.Group {
  const g = new THREE.Group();
  const colors = [CraftPalette.coralFelt, CraftPalette.mustardFelt, CraftPalette.plumFelt];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.16 + Math.random() * 0.08, 8, 8), feltFlat(colors[i % colors.length], 0.9));
    s.position.set((Math.random() - 0.5) * 0.5, 0.14 + Math.random() * 0.12, (Math.random() - 0.5) * 0.5);
    s.castShadow = true;
    g.add(s);
  }
  return g;
}

function woodStump(): THREE.Group {
  const g = new THREE.Group();
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.4, 10), craftMaterial("wood", { repeat: 1 }));
  stump.position.y = 0.2;
  stump.castShadow = true;
  g.add(stump);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 10), craftMaterial("wood", { repeat: 0.6, roughness: 0.6 }));
  top.position.y = 0.415;
  g.add(top);
  return g;
}

function paperLantern(): THREE.Group {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), craftMaterial("wood", { repeat: 0.4 }));
  stick.position.y = 0.8;
  g.add(stick);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), craftMaterial("paper", { repeat: 1, color: 0xfff3d8 }));
  lantern.position.y = 1.55;
  lantern.castShadow = true;
  g.add(lantern);
  return g;
}

/** Arena compartida por Atrapa o Evita y Cazaengaños (misma base física y visual). */
export function buildSharedArena(radius: number, physics: PhysicsWorld): ArenaBuild {
  const group = new THREE.Group();
  const collidables: THREE.Object3D[] = [];

  // Suelo circular de fieltro
  const ground = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), craftMaterial("felt", { repeat: 6, color: CraftPalette.tealFelt, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Anillo exterior de cartón (capa de fondo, puramente decorativa)
  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + 3.5, 48),
    craftMaterial("cardboard", { repeat: 4, roughness: 1 })
  );
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = -0.02;
  group.add(outerRing);

  // Borde bajo de madera (visual de "diorama enmarcado")
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.16, 8, 48), craftMaterial("wood", { repeat: 1 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.02;
  group.add(rim);

  // Props en 3 anillos de profundidad (capa cercana / media / lejana)
  const rings = [
    { r: radius * 0.4, count: 6, build: pompomBush, collide: false },
    { r: radius * 0.68, count: 8, build: () => (Math.random() > 0.5 ? cardboardTree() : woodStump()), collide: true },
    { r: radius * 0.9, count: 10, build: () => (Math.random() > 0.6 ? paperLantern() : cardboardTree()), collide: true }
  ];

  let idx = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + Math.random() * 0.3;
      const x = Math.cos(angle) * ring.r;
      const z = Math.sin(angle) * ring.r;
      const prop = ring.build();
      prop.position.set(x, 0, z);
      prop.rotation.y = Math.random() * Math.PI * 2;
      group.add(prop);
      if (ring.collide) {
        collidables.push(prop);
        physics.addStaticCylinder(0.32, 1.4, { x, y: 0.7, z });
      }
      idx++;
    }
  }
  void idx;

  return { group, collidables, radius };
}
