import * as THREE from "three";

// Texturas CC0 (ambientCG, ver /LICENSES.md) usadas como base de la estética
// "diorama artesanal". Se cargan de forma perezosa (solo cuando el minijuego
// que las necesita arranca) y se reutilizan entre minijuegos vía cache.

export type CraftTextureName = "felt" | "cardboard" | "wood" | "paper";

interface CraftTextureSet {
  map: THREE.Texture;
  roughnessMap: THREE.Texture;
  normalMap: THREE.Texture;
}

const loader = new THREE.TextureLoader();
const cache = new Map<CraftTextureName, CraftTextureSet>();

function loadTex(url: string, srgb: boolean): THREE.Texture {
  const tex = loader.load(url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function getCraftTextureSet(name: CraftTextureName): CraftTextureSet {
  const cached = cache.get(name);
  if (cached) return cached;
  const base = `${import.meta.env.BASE_URL}textures/${name}`;
  const set: CraftTextureSet = {
    map: loadTex(`${base}_color.webp`, true),
    roughnessMap: loadTex(`${base}_rough.webp`, false),
    normalMap: loadTex(`${base}_normal.webp`, false)
  };
  cache.set(name, set);
  return set;
}

export interface CraftMaterialOptions {
  color?: number;
  repeat?: number;
  roughness?: number;
  normalScale?: number;
}

/** Material "de fieltro/cartón/madera" cálido: textura CC0 tintada con el color base pedido. */
export function craftMaterial(texture: CraftTextureName, opts: CraftMaterialOptions = {}): THREE.MeshStandardMaterial {
  const set = getCraftTextureSet(texture);
  const repeat = opts.repeat ?? 3;
  for (const t of [set.map, set.roughnessMap, set.normalMap]) {
    t.repeat.set(repeat, repeat);
  }
  const mat = new THREE.MeshStandardMaterial({
    map: set.map,
    roughnessMap: set.roughnessMap,
    normalMap: set.normalMap,
    normalScale: new THREE.Vector2(opts.normalScale ?? 0.6, opts.normalScale ?? 0.6),
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? 1
  });
  return mat;
}

/** Material plano de fieltro (sin textura, para piezas pequeñas de personaje/props) — misma familia visual, más liviano. */
export function feltFlat(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

export const CraftPalette = {
  cream: 0xfbf1de,
  paper: 0xf4e4c9,
  cardboard: 0xd9a463,
  cardboardDark: 0xa86f3c,
  tealFelt: 0x2f9e8f,
  tealFeltDark: 0x1f6e63,
  plumFelt: 0x8a4f7d,
  mustardFelt: 0xe2a83c,
  coralFelt: 0xe2703a,
  ink: 0x402a1f,
  white: 0xfffaf0
} as const;
