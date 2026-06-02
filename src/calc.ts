export type ServiceType = "Freunde" | "Auftrag";
export type DeviceType = "3D Drucker" | "Laser";

export type MachineRates = Record<DeviceType, number>;

export type RateProfile = {
  designHourlyRate: number;
  machineHourlyRates: MachineRates;
  profitMargin: number;
};

export type RateProfiles = Record<ServiceType, RateProfile>;

export type CalculationInput = {
  materialCost: number;
  designTime: number;
  machineTime: number;
  serviceType: ServiceType;
  deviceType: DeviceType;
  profiles: RateProfiles;
};

export const DEFAULT_PROFILES: RateProfiles = {
  Freunde: {
    designHourlyRate: 10,
    machineHourlyRates: {
      "3D Drucker": 0.9,
      Laser: 1.4,
    },
    profitMargin: 1.1,
  },
  Auftrag: {
    designHourlyRate: 20,
    machineHourlyRates: {
      "3D Drucker": 1.2,
      Laser: 1.8,
    },
    profitMargin: 1.3,
  },
};

export const DEFAULT_INPUTS = {
  materialCost: 3.415,
  designTime: 3,
  machineTime: 1,
  serviceType: "Freunde" as ServiceType,
  deviceType: "Laser" as DeviceType,
};

export function sanitizeNumber(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function calculateRawPrice(input: CalculationInput): number {
  const profile = input.profiles[input.serviceType];
  const materialCost = sanitizeNumber(input.materialCost);
  const designTime = sanitizeNumber(input.designTime);
  const machineTime = sanitizeNumber(input.machineTime);
  const designHourlyRate = sanitizeNumber(profile.designHourlyRate);
  const machineHourlyRate = sanitizeNumber(profile.machineHourlyRates[input.deviceType]);
  const profitMargin = sanitizeNumber(profile.profitMargin);

  return (materialCost + designTime * designHourlyRate + machineTime * machineHourlyRate) * profitMargin;
}

export function calculateRoundedPrice(input: CalculationInput): number {
  return Math.round(calculateRawPrice(input));
}

export function mergeProfiles(storedProfiles: unknown): RateProfiles {
  if (!storedProfiles || typeof storedProfiles !== "object") return DEFAULT_PROFILES;

  const source = storedProfiles as Partial<Record<ServiceType, Partial<RateProfile>>>;

  return {
    Freunde: mergeProfile(DEFAULT_PROFILES.Freunde, source.Freunde),
    Auftrag: mergeProfile(DEFAULT_PROFILES.Auftrag, source.Auftrag),
  };
}

function mergeProfile(defaultProfile: RateProfile, storedProfile?: Partial<RateProfile>): RateProfile {
  return {
    designHourlyRate: numberOrDefault(storedProfile?.designHourlyRate, defaultProfile.designHourlyRate),
    profitMargin: numberOrDefault(storedProfile?.profitMargin, defaultProfile.profitMargin),
    machineHourlyRates: {
      "3D Drucker": numberOrDefault(
        storedProfile?.machineHourlyRates?.["3D Drucker"],
        defaultProfile.machineHourlyRates["3D Drucker"]
      ),
      Laser: numberOrDefault(storedProfile?.machineHourlyRates?.Laser, defaultProfile.machineHourlyRates.Laser),
    },
  };
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}
