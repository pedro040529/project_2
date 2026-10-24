import { describe, expect, it, vi } from "vitest";
import { QualityMonitor, readQualityOverride } from "../src/core/Quality";

function run(monitor: QualityMonitor, dt: number, seconds: number): void {
  for (let t = 0; t < seconds; t += dt) monitor.sample(dt);
}

describe("QualityMonitor", () => {
  it("no baja la calidad si se sostienen los FPS", () => {
    const onChange = vi.fn();
    const m = new QualityMonitor(onChange, "high");
    run(m, 1 / 60, 10);
    expect(onChange).not.toHaveBeenCalled();
    expect(m.tier).toBe("high");
  });

  it("baja un escalón cuando los FPS son bajos y sigue bajando hasta 'low' sin pasar de ahí", () => {
    const onChange = vi.fn();
    const m = new QualityMonitor(onChange, "high");
    run(m, 1 / 25, 20);
    expect(m.tier).toBe("low");
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(["medium", "low"]);
  });

  it("ignora picos aislados (cambio de pestaña)", () => {
    const onChange = vi.fn();
    const m = new QualityMonitor(onChange, "high");
    run(m, 1 / 60, 5);
    m.sample(2);
    run(m, 1 / 60, 5);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("no cambia nada si no es adaptativo (calidad forzada)", () => {
    const onChange = vi.fn();
    const m = new QualityMonitor(onChange, "high", false);
    run(m, 1 / 15, 20);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("lee ?q= de la URL", () => {
    expect(readQualityOverride("?q=low")).toBe("low");
    expect(readQualityOverride("?q=otra")).toBeNull();
    expect(readQualityOverride("")).toBeNull();
  });
});
