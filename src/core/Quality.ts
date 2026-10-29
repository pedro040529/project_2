/**
 * Calidad gráfica adaptativa. Mide el tiempo de los fotogramas y, si el
 * equipo no sostiene los FPS objetivo, baja un escalón (nunca vuelve a
 * subir, para evitar que oscile). Se puede forzar con `?q=high|medium|low`.
 *
 *  high   — bloom + viñeta + SMAA + tono de película, sombras 1024
 *  medium — viñeta + tono de película, sombras 512, menos resolución
 *  low    — render directo sin postprocesado ni sombras, resolución 1×
 */
export type QualityTier = "high" | "medium" | "low";

const ORDER: QualityTier[] = ["high", "medium", "low"];

export class QualityMonitor {
  private frames: number[] = [];
  private sinceChange = 0;
  tier: QualityTier;

  constructor(
    private onChange: (tier: QualityTier) => void,
    initial: QualityTier = "high",
    private adaptive = true,
    private readonly targetFps = 50
  ) {
    this.tier = initial;
  }

  setAdaptive(on: boolean): void {
    this.adaptive = on;
    this.frames = [];
    this.sinceChange = 0;
  }

  /** Llamar una vez por fotograma con el dt real (segundos, SIN recortar). */
  sample(rawDt: number): void {
    if (!this.adaptive) return;
    this.sinceChange += rawDt;
    // ignorar picos aislados (cambios de pestaña, carga de texturas)
    if (rawDt > 0.5) return;
    this.frames.push(rawDt);
    if (this.frames.length > 90) this.frames.shift();
    // calentamiento tras cada cambio: 2.5 s antes de volver a juzgar
    if (this.sinceChange < 2.5 || this.frames.length < 60) return;
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    if (1 / avg < this.targetFps) this.downgrade();
  }

  private downgrade(): void {
    const i = ORDER.indexOf(this.tier);
    if (i >= ORDER.length - 1) return;
    this.set(ORDER[i + 1]);
  }

  set(tier: QualityTier): void {
    this.tier = tier;
    this.frames = [];
    this.sinceChange = 0;
    this.onChange(tier);
  }
}

export function readQualityOverride(search: string): QualityTier | null {
  const q = new URLSearchParams(search).get("q");
  return q === "high" || q === "medium" || q === "low" ? q : null;
}
