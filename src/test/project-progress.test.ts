import { describe, expect, it } from "vitest";
import { effectiveProgress } from "@/components/projects/project-meta";

describe("effectiveProgress (progreso automático)", () => {
  it("Entregado y Cerrado siempre son 100%", () => {
    expect(effectiveProgress("delivered", null, null, 40)).toBe(100);
    expect(effectiveProgress("closed", null, null, null)).toBe(100);
  });

  it("usa el % de tareas completadas que calcula la base de datos", () => {
    expect(effectiveProgress("in_progress", "2026-01-01", "2026-12-31", 35)).toBe(35);
    expect(effectiveProgress("planning", null, null, 0)).toBe(0);
    expect(effectiveProgress("paused", null, null, 60)).toBe(60);
  });

  it("sin tareas, estima por fechas", () => {
    const start = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const end = new Date(Date.now() + 5 * 86_400_000).toISOString();
    expect(effectiveProgress("in_progress", start, end, null)).toBe(50);
    expect(effectiveProgress("planning", start, end, null)).toBe(0);
    expect(effectiveProgress("paused", start, end, null)).toBeNull();
  });
});
