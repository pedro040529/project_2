import * as THREE from "three";
import type { ArenaBuild } from "./ArenaFactory";
import type { PhysicsWorld } from "./PhysicsWorld";

/**
 * Escenarios con la identidad visual de NEXORA: base azul noche + acentos de
 * neón. Cada minijuego tiene su personalidad pero comparten paleta, rejilla y
 * materiales. Regla RNF06: nada aquí se colorea según si un objeto es
 * legítimo o engañoso — la decoración es independiente del contenido.
 */

export const NeonPalette = {
  night: 0x141a3c,
  nightLight: 0x232d63,
  cyan: 0x39e1ff,
  magenta: 0xff4fd8,
  gold: 0xffc83d,
  lime: 0x8dff6a,
  orange: 0xff8a3d,
  white: 0xf4f7ff
} as const;

function gridTexture(base: string, line: string, cells: number): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  const step = size / cells;
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function screenTexture(title: string, accent: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 512, 256);
  g.addColorStop(0, "#0d1233");
  g.addColorStop(1, "#27316e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 236);
  ctx.fillStyle = accent;
  ctx.font = "800 64px Baloo 2, Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, 256, 112);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(90, 175, 332, 10);
  ctx.fillRect(130, 200, 252, 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const glowCache = new Map<string, THREE.MeshStandardMaterial>();

/** Materiales de neón compartidos por color/intensidad: menos objetos y menos cambios de estado en la GPU. */
export function glow(color: number, intensity = 1.6): THREE.MeshStandardMaterial {
  const key = `${color}:${intensity}`;
  let m = glowCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
    glowCache.set(key, m);
  }
  return m;
}

export function floorDisc(radius: number, baseCss: string, lineCss: string, cells: number, repeat: number): THREE.Mesh {
  const tex = gridTexture(baseCss, lineCss, cells);
  tex.repeat.set(repeat, repeat);
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 64),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.15 })
  );
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

export function neonRing(radius: number, color: number, y = 0.03, thickness = 0.08): THREE.Mesh {
  const r = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 96), glow(color, 1.8));
  r.rotation.x = Math.PI / 2;
  r.position.y = y;
  return r;
}

export function pad(x: number, z: number, color: number, r = 1.0): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.12, 32), new THREE.MeshStandardMaterial({ color: NeonPalette.nightLight, roughness: 0.5 }));
  base.position.y = 0.06;
  base.receiveShadow = true;
  g.add(base);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, 0.05, 8, 40), glow(color, 1.6));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.13;
  g.add(rim);
  g.position.set(x, 0, z);
  return g;
}

export function pillar(x: number, z: number, color: number, height = 3.2): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, height, 10), new THREE.MeshStandardMaterial({ color: NeonPalette.night, roughness: 0.4, metalness: 0.4 }));
  body.position.y = height / 2;
  body.castShadow = true;
  g.add(body);
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 20), glow(color, 1.6));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.7 + i * (height / 3.4);
    g.add(band);
  }
  const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), glow(color, 2));
  cap.position.y = height + 0.35;
  cap.userData.spin = 1.2;
  g.add(cap);
  g.position.set(x, 0, z);
  return g;
}

function screenPanel(radius: number, angle: number, title: string, accent: number, y = 2.6): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({ map: screenTexture(title, `#${accent.toString(16).padStart(6, "0")}`) });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), mat);
  m.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  m.lookAt(0, y, 0);
  return m;
}

export function floatingCubes(group: THREE.Group, radius: number, count: number, colors: number[]): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const r = radius + 1.5 + Math.random() * 4;
    const s = 0.35 + Math.random() * 0.5;
    const cube = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), glow(colors[i % colors.length], 1.2));
    cube.position.set(Math.cos(a) * r, 2 + Math.random() * 5, Math.sin(a) * r);
    cube.userData.spin = 0.4 + Math.random();
    cube.userData.bob = Math.random() * 6;
    cube.userData.baseY = cube.position.y;
    group.add(cube);
  }
}

/** Aplica rotación/oscilación a los hijos que lo piden; devuelve el updater de la arena. */
export function makeAnimator(group: THREE.Group): (t: number) => void {
  const animated: THREE.Object3D[] = [];
  group.traverse((o) => {
    if (o.userData.spin !== undefined) animated.push(o);
  });
  return (t: number) => {
    for (const o of animated) {
      o.rotation.y = t * o.userData.spin;
      if (o.userData.baseY !== undefined) o.position.y = o.userData.baseY + Math.sin(t * 1.3 + o.userData.bob) * 0.35;
    }
  };
}

export function outerVoid(radius: number, group: THREE.Group): void {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + 40, 64),
    new THREE.MeshStandardMaterial({ color: 0x0b0f29, roughness: 1 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.04;
  group.add(ring);
}

/** Atrapa o Evita — "Plaza de Recompensas": plataformas luminosas, pantallas y cubos flotantes. */
export function buildRewardPlaza(radius: number, physics: PhysicsWorld): ArenaBuild {
  const group = new THREE.Group();
  const collidables: THREE.Object3D[] = [];
  group.add(floorDisc(radius, "#1a2250", "#3a4aa8", 8, 7));
  outerVoid(radius, group);
  group.add(neonRing(radius, NeonPalette.cyan, 0.05, 0.14));
  group.add(neonRing(radius * 0.8, NeonPalette.magenta, 0.03, 0.06));
  group.add(neonRing(radius * 0.52, NeonPalette.gold, 0.03, 0.06));
  group.add(neonRing(radius * 0.22, NeonPalette.cyan, 0.03, 0.08));

  const padColors = [NeonPalette.cyan, NeonPalette.magenta, NeonPalette.gold, NeonPalette.lime];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    group.add(pad(Math.cos(a) * radius * 0.65, Math.sin(a) * radius * 0.65, padColors[i % 4], 1.4));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    group.add(pad(Math.cos(a) * radius * 0.28, Math.sin(a) * radius * 0.28, padColors[(i + 1) % 4], 1.1));
  }
  // columnas con colisión repartidas como obstáculos para rodear
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(a) * radius * 0.46;
    const z = Math.sin(a) * radius * 0.46;
    const p = pillar(x, z, padColors[i % 4]);
    group.add(p);
    collidables.push(p);
    physics.addStaticCylinder(0.4, 3, { x, y: 1.5, z });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    group.add(screenPanel(radius + 2.2, a, ["NEXORA", "BONUS", "LOOT", "EVENTO", "RANKING", "NIVEL"][i], padColors[i % 4]));
  }
  floatingCubes(group, radius, 22, padColors);

  const animate = makeAnimator(group);
  return { group, collidables, radius, update: animate };
}

/** Cazaengaños — "Campo de Entrenamiento Holográfico". */
export function buildHoloRange(radius: number, physics: PhysicsWorld): ArenaBuild {
  const group = new THREE.Group();
  const collidables: THREE.Object3D[] = [];
  group.add(floorDisc(radius, "#0b1c2e", "#1f8fb3", 10, 8));
  outerVoid(radius, group);
  group.add(neonRing(radius, NeonPalette.cyan, 0.05, 0.14));
  for (let i = 1; i <= 3; i++) group.add(neonRing(radius * (i / 4), i % 2 ? NeonPalette.lime : NeonPalette.cyan, 0.03, 0.04));

  // líneas de "carril" radiales
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.12, radius * 0.9), glow(NeonPalette.cyan, 0.9));
    lane.rotation.x = -Math.PI / 2;
    lane.rotation.z = -a + Math.PI / 2;
    lane.position.set(Math.cos(a) * radius * 0.45, 0.02, Math.sin(a) * radius * 0.45);
    group.add(lane);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * radius * 0.86;
    const z = Math.sin(a) * radius * 0.86;
    const p = pillar(x, z, i % 2 ? NeonPalette.magenta : NeonPalette.cyan, 4.2);
    group.add(p);
    collidables.push(p);
    physics.addStaticCylinder(0.4, 4, { x, y: 2, z });
  }
  for (let i = 0; i < 8; i++) {
    group.add(screenPanel(radius + 2.4, (i / 8) * Math.PI * 2 + 0.2, ["SCAN", "ALERTA", "CHAT", "ANÁLISIS"][i % 4], i % 2 ? NeonPalette.magenta : NeonPalette.lime, 3.2));
  }
  const animate = makeAnimator(group);
  return { group, collidables, radius, update: animate };
}

/** Bajo Presión — "Cámara del Orbe": 4 plataformas individuales y un pedestal central de energía. */
export const ORB_SEAT_COLORS = [NeonPalette.cyan, NeonPalette.orange, NeonPalette.magenta, NeonPalette.gold] as const;

export function buildOrbChamber(radius: number, _physics?: PhysicsWorld): ArenaBuild {
  // Estilo "fiesta": isla flotante de colores, bordes inflados, globos y nubes (en la línea de Fall Guys / Party Animals).
  const group = new THREE.Group();
  const collidables: THREE.Object3D[] = [];
  const std = (color: number, rough = 0.65) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });

  // Suelo en cuñas de colores caramelo
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const wedge = ["#7fd8c8", "#62c7b6"];
  const wedges = 24;
  for (let i = 0; i < wedges; i++) {
    g.beginPath();
    g.moveTo(size / 2, size / 2);
    g.arc(size / 2, size / 2, size / 2, (i / wedges) * Math.PI * 2, ((i + 1) / wedges) * Math.PI * 2);
    g.closePath();
    g.fillStyle = wedge[i % wedge.length];
    g.fill();
  }
  g.strokeStyle = "rgba(255,255,255,.75)";
  g.lineWidth = 10;
  for (const f of [0.34, 0.68]) {
    g.beginPath();
    g.arc(size / 2, size / 2, (size / 2) * f, 0, Math.PI * 2);
    g.stroke();
  }
  const floorTex = new THREE.CanvasTexture(c);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Cuerpo de la isla (flota sobre las nubes)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.2, radius * 0.5, 6, 48), std(0x6f86d6, 0.8));
  body.position.y = -3.05;
  group.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.35, radius + 0.35, 0.5, 48), std(0xfff4dc, 0.6));
  band.position.y = -0.27;
  group.add(band);

  // Borde inflado: bolas de colores alrededor
  const bumperColors = [0xffffff, 0x8fc2ff];
  const bumperGeo = new THREE.SphereGeometry(0.55, 14, 10);
  const bumperMats = bumperColors.map((col) => std(col, 0.45));
  const nBump = 28;
  for (let i = 0; i < nBump; i++) {
    const a = (i / nBump) * Math.PI * 2;
    const m = new THREE.Mesh(bumperGeo, bumperMats[i % bumperMats.length]);
    m.position.set(Math.cos(a) * (radius + 0.1), 0.35, Math.sin(a) * (radius + 0.1));
    m.castShadow = true;
    group.add(m);
  }

  // Puestos: plataforma blanca con aro y centro del color del jugador, unidos al centro por una cinta
  const seatR = radius * 0.68;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const x = Math.cos(a) * seatR;
    const z = Math.sin(a) * seatR;
    const col = ORB_SEAT_COLORS[i];
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.75, 0.28, 36), std(0xffffff, 0.5));
    pad.position.set(x, 0.14, z);
    pad.castShadow = true;
    pad.receiveShadow = true;
    group.add(pad);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), std(col, 0.5));
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(x, 0.29, z);
    group.add(inner);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 8, 40), std(col, 0.4));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 0.3, z);
    group.add(rim);
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.45, seatR - 1.9), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 }));
    lane.rotation.x = -Math.PI / 2;
    lane.rotation.z = -a + Math.PI / 2;
    lane.position.set(Math.cos(a) * seatR * 0.5, 0.04, Math.sin(a) * seatR * 0.5);
    group.add(lane);
  }

  // Pedestal central con anillos que giran
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.65, 0.55, 28), std(0xffffff, 0.5));
  ped.position.y = 0.27;
  ped.castShadow = true;
  group.add(ped);
  const pedTop = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.06, 28), std(0xffffff, 0.4));
  pedTop.position.y = 0.58;
  group.add(pedTop);
  const ringCols = [0xffffff, 0xcfe6ff, 0xffffff];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0 + i * 0.35, 0.05, 8, 48), glow(ringCols[i], 0.8));
    ring.position.y = 1.4;
    ring.rotation.x = Math.PI / 2 + i * 0.5;
    ring.userData.spin = 0.8 + i * 0.4;
    group.add(ring);
  }

  // Nubes bajo y alrededor de la isla
  const cloudMat = std(0xffffff, 1);
  const cloudGeo = new THREE.SphereGeometry(1, 12, 9);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + Math.random() * 0.3;
    const r = radius + 12 + Math.random() * 22;
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(Math.random() * 3);
    for (let k = 0; k < puffs; k++) {
      const p = new THREE.Mesh(cloudGeo, cloudMat);
      p.scale.set(1.8 + Math.random() * 1.6, 1.1 + Math.random() * 0.7, 1.6 + Math.random());
      p.position.set((k - puffs / 2) * 1.8, Math.random() * 0.6, Math.random() * 1.2);
      cloud.add(p);
    }
    cloud.position.set(Math.cos(a) * r, -10 + Math.random() * 3, Math.sin(a) * r);
    group.add(cloud);
  }

  const light = new THREE.PointLight(0xfff2d6, 30, radius * 3, 1.6);
  light.position.set(0, 9, 0);
  group.add(light);
  const animate = makeAnimator(group);
  return { group, collidables, radius, update: animate };
}
