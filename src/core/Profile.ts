import type { Appearance } from "./types";
import { BODY_COLORS, DEFAULT_APPEARANCE, EXTRA_ACCESSORIES, HEAD_ACCESSORIES } from "../data/characters";

/** Datos del jugador que se conservan durante toda la competencia (y entre visitas): apodo y apariencia. */
export interface PlayerProfile {
  nickname: string;
  appearance: Appearance;
}

const KEY = "nexora_profile";

export function sanitizeAppearance(raw: Partial<Appearance> | null | undefined): Appearance {
  const color = BODY_COLORS.find((c) => c.id === raw?.color)?.id ?? DEFAULT_APPEARANCE.color;
  const head = HEAD_ACCESSORIES.find((h) => h.id === raw?.head)?.id ?? DEFAULT_APPEARANCE.head;
  const extra = EXTRA_ACCESSORIES.find((e) => e.id === raw?.extra)?.id ?? DEFAULT_APPEARANCE.extra;
  return { color, head, extra };
}

export function loadProfile(): PlayerProfile {
  let raw: { nickname?: string; appearance?: Partial<Appearance> } | null = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    raw = null;
  }
  let nickname = typeof raw?.nickname === "string" ? raw.nickname : "";
  if (!nickname) {
    try {
      nickname = localStorage.getItem("nexora_nickname") ?? "";
    } catch {
      nickname = "";
    }
  }
  return { nickname: nickname.slice(0, 14), appearance: sanitizeAppearance(raw?.appearance) };
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
    localStorage.setItem("nexora_nickname", profile.nickname);
  } catch {
    /* sin almacenamiento: se conserva solo en memoria durante la sesión */
  }
}
