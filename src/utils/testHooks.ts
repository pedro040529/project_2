/**
 * Gancho para pruebas automáticas: `?ts=0.2` acorta las rondas al 20 % de su duración para poder
 * recorrer la competencia completa rápido. Sin el parámetro (juego normal) vale siempre 1.
 */
export function testTimeScale(search: string = typeof window !== "undefined" ? window.location.search : ""): number {
  const raw = Number(new URLSearchParams(search).get("ts"));
  return Number.isFinite(raw) && raw >= 0.05 && raw <= 1 ? raw : 1;
}
