import * as THREE from "three";
import { craftMaterial, feltFlat, CraftPalette } from "./Materials";
import type { PhysicsWorld } from "./PhysicsWorld";

export interface ArenaBuild {
  group: THREE.Group;
  /** meshes sólidos contra los que la cámara no debe atravesar */
  collidables: THREE.Object3D[];
  radius: number;
  /** animación ambiental opcional (t en segundos) */
  update?: (t: number) => void;
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

function feltFlower(): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 5), feltFlat(CraftPalette.tealFeltDark, 0.9));
  stem.position.y = 0.21;
  g.add(stem);
  const petals = [CraftPalette.coralFelt, CraftPalette.mustardFelt, CraftPalette.white][Math.floor(Math.random() * 3)];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), feltFlat(petals, 0.9));
    p.position.set(Math.cos(a) * 0.1, 0.44, Math.sin(a) * 0.1);
    g.add(p);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), feltFlat(CraftPalette.ink, 0.9));
  core.position.y = 0.45;
  g.add(core);
  return g;
}

function feltMushroom(): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.3, 8), feltFlat(CraftPalette.cream, 0.9));
  stem.position.y = 0.15;
  g.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), feltFlat(CraftPalette.coralFelt, 0.9));
  cap.position.y = 0.3;
  cap.castShadow = true;
  g.add(cap);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), feltFlat(CraftPalette.white, 0.9));
    dot.position.set(Math.cos(a) * 0.15, 0.4 + (i % 2) * 0.05, Math.sin(a) * 0.15);
    g.add(dot);
  }
  return g;
}

function paperBunting(radius: number, group: THREE.Group): void {
  const colors = [CraftPalette.coralFelt, CraftPalette.mustardFelt, CraftPalette.plumFelt, CraftPalette.tealFelt];
  const count = 36;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 3), feltFlat(colors[i % colors.length], 0.9));
    flag.position.set(Math.cos(a) * (radius + 0.4), 0.95 + Math.sin(i * 0.9) * 0.08, Math.sin(a) * (radius + 0.4));
    flag.rotation.set(Math.PI, -a, 0);
    group.add(flag);
  }
  const string = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.4, 0.015, 4, 96), feltFlat(CraftPalette.ink, 1));
  string.rotation.x = Math.PI / 2;
  string.position.y = 1.2;
  group.add(string);
}

function feltHills(radius: number, group: THREE.Group): void {
  const colors = [0x3fae9c, 0x57c2a8, 0xe9b04f, 0xd9824a, 0x9a6190];
  const count = 22;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.15;
    const r = radius + 6 + Math.random() * 5;
    const h = 2 + Math.random() * 3.2;
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(h * 1.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      feltFlat(colors[i % colors.length], 1)
    );
    hill.scale.y = 0.55;
    hill.position.set(Math.cos(a) * r, -0.2, Math.sin(a) * r);
    group.add(hill);
  }
}

/** Arena compartida por Atrapa o Evita y Cazaengaños (misma base física y visual). */
export function buildSharedArena(radius: number, physics: PhysicsWorld): ArenaBuild {
  const group = new THREE.Group();
  const collidables: THREE.Object3D[] = [];

  // Suelo circular de fieltro
  const ground = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), craftMaterial("felt", { repeat: 6, color: 0x7fe0c4, roughness: 1, normalScale: 0.35 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Bandas concéntricas cosidas (aro de mostaza y centro de coral) para romper la planicie
  const bands = [
    { inner: radius * 0.52, outer: radius * 0.56, color: 0xf2c260 },
    { inner: radius * 0.8, outer: radius * 0.83, color: 0xfff3d8 }
  ];
  for (const b of bands) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(b.inner, b.outer, 64), feltFlat(b.color, 0.95));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    ring.receiveShadow = true;
    group.add(ring);
  }
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.14, 40), feltFlat(0xf08a4b, 0.95));
  emblem.rotation.x = -Math.PI / 2;
  emblem.position.y = 0.014;
  emblem.receiveShadow = true;
  group.add(emblem);

  paperBunting(radius, group);
  feltHills(radius, group);

  // Flores y hongos de fieltro dispersos (sin colisión)
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius * 0.95;
    const deco = Math.random() > 0.35 ? feltFlower() : feltMushroom();
    deco.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    deco.rotation.y = Math.random() * Math.PI * 2;
    deco.scale.setScalar(0.8 + Math.random() * 0.7);
    group.add(deco);
  }

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
