import type { Appearance, AvatarDef, BodyColorId, ExtraAccessoryId, HeadAccessoryId, ParticipantId } from "../core/types";

// Guardianes Digitales: un único modelo base (CharacterFactory) con variaciones de color y
// accesorios. Los 3 bots usan el mismo modelo con apariencias distintas; el humano elige la suya.
// El color y los accesorios son identidad visual: nunca marcan "bueno" o "malo" (RNF06).

export interface BodyColorDef {
  id: BodyColorId;
  name: string;
  /** carcasa principal */
  shell: number;
  /** acentos (orejas, botas, brillo) */
  trim: number;
  /** color del brillo del visor */
  glow: number;
}

export const BODY_COLORS: BodyColorDef[] = [
  { id: "azul", name: "Azul", shell: 0xe9f0ff, trim: 0x2f7bff, glow: 0x39e1ff },
  { id: "rojo", name: "Rojo", shell: 0xff5e55, trim: 0xffd1c9, glow: 0xff9a8a },
  { id: "verde", name: "Verde", shell: 0x4fd88a, trim: 0xd7ffe6, glow: 0x9cff7a },
  { id: "morado", name: "Morado", shell: 0x9a62ff, trim: 0xe4d4ff, glow: 0xd7a6ff },
  { id: "rosa", name: "Rosa", shell: 0xff7fc8, trim: 0xffe0f1, glow: 0xffa8dc },
  { id: "amarillo", name: "Amarillo", shell: 0xffd23c, trim: 0xfff3c0, glow: 0xffe880 },
  { id: "negro", name: "Negro", shell: 0x2a2f45, trim: 0xff8a3d, glow: 0x39e1ff },
  { id: "blanco", name: "Blanco", shell: 0xfafcff, trim: 0x9aa7c7, glow: 0x39e1ff }
];

export const HEAD_ACCESSORIES: { id: HeadAccessoryId; name: string }[] = [
  { id: "none", name: "Sin accesorio" },
  { id: "cap", name: "Gorra" },
  { id: "glasses", name: "Gafas" },
  { id: "headphones", name: "Audífonos" },
  { id: "hood", name: "Capucha" },
  { id: "hat", name: "Sombrero" }
];

export const EXTRA_ACCESSORIES: { id: ExtraAccessoryId; name: string }[] = [
  { id: "none", name: "Ninguno" },
  { id: "scarf", name: "Bufanda" },
  { id: "cape", name: "Capa" },
  { id: "backpack", name: "Mochila" }
];

export function colorDef(id: BodyColorId): BodyColorDef {
  return BODY_COLORS.find((c) => c.id === id) ?? BODY_COLORS[0];
}

/** Construye un AvatarDef a partir de una apariencia; los colores derivan de la paleta elegida. */
export function makeAvatar(
  id: ParticipantId,
  name: string,
  appearance: Appearance,
  tagline: string,
  traits: AvatarDef["traits"]
): AvatarDef {
  const c = colorDef(appearance.color);
  return { id, name, appearance: { ...appearance }, primaryColor: c.shell, accentColor: c.trim, tagline, traits };
}

export const DEFAULT_APPEARANCE: Appearance = { color: "azul", head: "none", extra: "none" };

// Los 3 bots son fijos: mismo modelo, distinto color y accesorios, y la personalidad se refleja en su look.
export const NPC_AVATARS: Record<Exclude<ParticipantId, "human">, AvatarDef> = {
  nova: makeAvatar(
    "nova",
    "Nova",
    { color: "rojo", head: "cap", extra: "none" },
    "Rápida y arriesgada. Reacciona primero, a veces se precipita.",
    { movementSpeed: 8.1, reactionTime: 0.55, accuracy: 0.62, riskTolerance: 0.82, decisionDelay: 1.6 }
  ),
  kiro: makeAvatar(
    "kiro",
    "Kiro",
    { color: "verde", head: "headphones", extra: "scarf" },
    "Equilibrada. Ni la más rápida ni la más cautelosa.",
    { movementSpeed: 7.2, reactionTime: 0.85, accuracy: 0.74, riskTolerance: 0.5, decisionDelay: 2.3 }
  ),
  pixel: makeAvatar(
    "pixel",
    "Pixel",
    { color: "morado", head: "glasses", extra: "backpack" },
    "Lenta y analítica. Tarda más, pero se equivoca menos.",
    { movementSpeed: 6.1, reactionTime: 1.3, accuracy: 0.86, riskTolerance: 0.28, decisionDelay: 3.2 }
  )
};

export function buildHumanAvatar(appearance: Appearance, nickname: string): AvatarDef {
  return makeAvatar("human", nickname, appearance, "Tú", null);
}
