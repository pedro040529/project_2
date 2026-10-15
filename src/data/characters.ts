import type { AvatarDef, ParticipantId } from "../core/types";

// Los 3 NPC son fijos (silueta + nombre + color únicos). El jugador humano
// elige entre 3 variantes de gorro ("cap"), silueta distinta a las de los
// NPC, para que los 4 participantes sean siempre reconocibles a distancia
// solo por silueta y color, sin depender del tipo de contenido del minijuego.

export const NPC_AVATARS: Record<Exclude<ParticipantId, "human">, AvatarDef> = {
  nova: {
    id: "nova",
    name: "Nova",
    primaryColor: 0xe2703a, // coral
    accentColor: 0xe2a83c, // mustard
    silhouette: "mohawk",
    tagline: "Rápida y arriesgada. Reacciona primero, a veces se precipita.",
    traits: {
      movementSpeed: 8.1,
      reactionTime: 0.55,
      accuracy: 0.62,
      riskTolerance: 0.82,
      decisionDelay: 1.6
    }
  },
  kiro: {
    id: "kiro",
    name: "Kiro",
    primaryColor: 0x2f9e8f, // teal
    accentColor: 0x8a4f7d, // plum
    silhouette: "ears",
    tagline: "Equilibrada. Ni la más rápida ni la más cautelosa.",
    traits: {
      movementSpeed: 7.2,
      reactionTime: 0.85,
      accuracy: 0.74,
      riskTolerance: 0.5,
      decisionDelay: 2.3
    }
  },
  pixel: {
    id: "pixel",
    name: "Pixel",
    primaryColor: 0x8a4f7d, // plum
    accentColor: 0x2f9e8f, // teal
    silhouette: "antenna",
    tagline: "Lenta y analítica. Tarda más, pero se equivoca menos.",
    traits: {
      movementSpeed: 6.1,
      reactionTime: 1.3,
      accuracy: 0.86,
      riskTolerance: 0.28,
      decisionDelay: 3.2
    }
  }
};

export interface PlayerAvatarOption {
  id: string;
  name: string;
  primaryColor: number;
  accentColor: number;
  tagline: string;
}

export const PLAYER_AVATAR_OPTIONS: PlayerAvatarOption[] = [
  {
    id: "cap_teal",
    name: "Bramble",
    primaryColor: 0x3fb7a6,
    accentColor: 0xfbf1de,
    tagline: "Gorro de lana verde agua con parche de botón."
  },
  {
    id: "cap_coral",
    name: "Tato",
    primaryColor: 0xe2703a,
    accentColor: 0x402a1f,
    tagline: "Gorro naranja quemado con pompón de fieltro."
  },
  {
    id: "cap_mustard",
    name: "Mimo",
    primaryColor: 0xe2a83c,
    accentColor: 0x2f9e8f,
    tagline: "Gorro mostaza con costuras de cartón a la vista."
  }
];

export function buildHumanAvatar(option: PlayerAvatarOption, nickname: string): AvatarDef {
  return {
    id: "human",
    name: nickname,
    primaryColor: option.primaryColor,
    accentColor: option.accentColor,
    silhouette: "cap",
    tagline: option.tagline,
    traits: null
  };
}
