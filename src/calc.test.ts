import { describe, expect, it } from "vitest";
import { calculateRawPrice, calculateRoundedPrice, DEFAULT_INPUTS, DEFAULT_PROFILES } from "./calc";

describe("Kostenrechner", () => {
  it("matches the Excel default calculation", () => {
    const input = {
      ...DEFAULT_INPUTS,
      profiles: DEFAULT_PROFILES,
    };

    expect(calculateRawPrice(input)).toBeCloseTo(38.2965, 5);
    expect(calculateRoundedPrice(input)).toBe(38);
  });

  it("uses Auftrag profile rates", () => {
    const input = {
      ...DEFAULT_INPUTS,
      serviceType: "Auftrag" as const,
      profiles: DEFAULT_PROFILES,
    };

    expect(calculateRawPrice(input)).toBeCloseTo(84.7795, 5);
    expect(calculateRoundedPrice(input)).toBe(85);
  });

  it("uses the selected device machine rate", () => {
    const input = {
      ...DEFAULT_INPUTS,
      deviceType: "3D Drucker" as const,
      profiles: DEFAULT_PROFILES,
    };

    expect(calculateRawPrice(input)).toBeCloseTo(37.7465, 5);
    expect(calculateRoundedPrice(input)).toBe(38);
  });
});
