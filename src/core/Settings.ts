/**
 * Ajustes del jugador (todos funcionan de verdad): volumen, sensibilidad del mouse y calidad
 * gráfica. Se guardan en localStorage y avisan a quien se suscriba cuando cambian.
 */
export type QualitySetting = "auto" | "high" | "medium" | "low";

export interface SettingsData {
  /** 0..1 */
  volume: number;
  /** multiplicador sobre la sensibilidad base (0.4 .. 2.0) */
  mouseSensitivity: number;
  quality: QualitySetting;
}

const KEY = "nexora_settings";
const DEFAULTS: SettingsData = { volume: 0.8, mouseSensitivity: 1, quality: "auto" };

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function sanitizeSettings(raw: Partial<SettingsData> | null | undefined): SettingsData {
  const q = raw?.quality;
  return {
    volume: clamp(typeof raw?.volume === "number" ? raw.volume : DEFAULTS.volume, 0, 1),
    mouseSensitivity: clamp(typeof raw?.mouseSensitivity === "number" ? raw.mouseSensitivity : DEFAULTS.mouseSensitivity, 0.4, 2),
    quality: q === "auto" || q === "high" || q === "medium" || q === "low" ? q : DEFAULTS.quality
  };
}

class SettingsStore {
  private data: SettingsData;
  private listeners = new Set<(s: SettingsData) => void>();

  constructor() {
    let stored: Partial<SettingsData> | null = null;
    try {
      stored = JSON.parse(localStorage.getItem(KEY) ?? "null");
    } catch {
      stored = null;
    }
    this.data = sanitizeSettings(stored);
  }

  get(): SettingsData {
    return this.data;
  }

  update(patch: Partial<SettingsData>): void {
    this.data = sanitizeSettings({ ...this.data, ...patch });
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* sin almacenamiento: los ajustes valen solo para esta sesión */
    }
    this.listeners.forEach((l) => l(this.data));
  }

  subscribe(fn: (s: SettingsData) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const Settings = new SettingsStore();
