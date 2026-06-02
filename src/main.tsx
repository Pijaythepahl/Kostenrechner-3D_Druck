import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Calculator, Settings, X } from "lucide-react";
import {
  calculateRawPrice,
  calculateRoundedPrice,
  DEFAULT_INPUTS,
  DEFAULT_PROFILES,
  DeviceType,
  mergeProfiles,
  RateProfiles,
  ServiceType,
} from "./calc";
import "./styles.css";

const STORAGE_KEY = "kostenrechner.rateProfiles.v1";
const FILAMENT_PRICE_KEY = "kostenrechner.filamentPricePerKg.v1";
const serviceTypes: ServiceType[] = ["Freunde", "Auftrag"];
const deviceTypes: DeviceType[] = ["3D Drucker", "Laser"];

function App() {
  const [serviceType, setServiceType] = useState<ServiceType>(DEFAULT_INPUTS.serviceType);
  const [deviceType, setDeviceType] = useState<DeviceType>(DEFAULT_INPUTS.deviceType);
  const [materialCost, setMaterialCost] = useState(DEFAULT_INPUTS.materialCost.toString());
  const [filamentGrams, setFilamentGrams] = useState("");
  const [filamentPricePerKg, setFilamentPricePerKg] = useState(loadFilamentPrice);
  const [designHours, setDesignHours] = useState(DEFAULT_INPUTS.designTime.toString());
  const [designMinutes, setDesignMinutes] = useState("0");
  const [machineHours, setMachineHours] = useState(DEFAULT_INPUTS.machineTime.toString());
  const [machineMinutes, setMachineMinutes] = useState("0");
  const [profiles, setProfiles] = useState<RateProfiles>(() => loadProfiles());
  const [settingsDrafts, setSettingsDrafts] = useState(() => profilesToDrafts(profiles));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [materialHelperOpen, setMaterialHelperOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<ServiceType>("Freunde");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch {
      return undefined;
    }
    setSettingsDrafts(profilesToDrafts(profiles));
  }, [profiles]);

  useEffect(() => {
    try {
      localStorage.setItem(FILAMENT_PRICE_KEY, String(parseInput(filamentPricePerKg)));
    } catch {
      return undefined;
    }
  }, [filamentPricePerKg]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  }, []);

  const numericInput = useMemo(
    () => ({
      materialCost: parseInput(materialCost),
      designTime: timeToHours(designHours, designMinutes),
      machineTime: timeToHours(machineHours, machineMinutes),
      serviceType,
      deviceType,
      profiles,
    }),
    [designHours, designMinutes, deviceType, machineHours, machineMinutes, materialCost, profiles, serviceType]
  );

  const activeProfile = profiles[serviceType];
  const rawPrice = calculateRawPrice(numericInput);
  const roundedPrice = calculateRoundedPrice(numericInput);
  const filamentCost = (parseInput(filamentGrams) / 1000) * parseInput(filamentPricePerKg);

  function updateProfile(service: ServiceType, updater: (profile: RateProfiles[ServiceType]) => RateProfiles[ServiceType]) {
    setProfiles((current) => ({
      ...current,
      [service]: updater(current[service]),
    }));
  }

  function updateDraft(service: ServiceType, key: string, value: string, commit: (numericValue: number) => void) {
    setSettingsDrafts((current) => ({
      ...current,
      [service]: {
        ...current[service],
        [key]: value,
      },
    }));

    if (isCompleteNumber(value)) {
      commit(parseInput(value));
    }
  }

  function resetProfiles() {
    setProfiles(DEFAULT_PROFILES);
  }

  return (
    <main className="app-shell">
      <section className="calculator" aria-label="Kostenrechner">
        <header className="top-bar">
          <div>
            <p className="eyebrow">3D Druck und Laser</p>
            <h1>Kostenrechner</h1>
          </div>
          <button className="icon-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="Einstellungen">
            <Settings size={22} aria-hidden="true" />
          </button>
        </header>

        <div className="segmented" role="group" aria-label="Zielgruppe">
          {serviceTypes.map((type) => (
            <button
              key={type}
              className={type === serviceType ? "active" : ""}
              type="button"
              onClick={() => setServiceType(type)}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="segmented device" role="group" aria-label="Geraetetyp">
          {deviceTypes.map((type) => (
            <button
              key={type}
              className={type === deviceType ? "active" : ""}
              type="button"
              onClick={() => setDeviceType(type)}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="input-grid">
          <NumberField
            label="Materialkosten"
            value={materialCost}
            suffix="EUR"
            onChange={setMaterialCost}
            action={
              <button
                className="mini-tool-button"
                type="button"
                onClick={() => setMaterialHelperOpen(true)}
                aria-label="Materialkosten aus Filamentgewicht berechnen"
              >
                <Calculator size={18} aria-hidden="true" />
              </button>
            }
          />
          <TimeField
            label="Designzeit"
            hours={designHours}
            minutes={designMinutes}
            onHoursChange={setDesignHours}
            onMinutesChange={setDesignMinutes}
          />
          <TimeField
            label="Maschinenzeit"
            hours={machineHours}
            minutes={machineMinutes}
            onHoursChange={setMachineHours}
            onMinutesChange={setMachineMinutes}
          />
        </div>

        <section className="result-panel" aria-live="polite">
          <span>Endpreis</span>
          <strong>{formatEuro(roundedPrice)}</strong>
          <small>Rohwert {rawPrice.toLocaleString("de-DE", { maximumFractionDigits: 4 })} EUR</small>
        </section>

        <dl className="rate-summary">
          <div>
            <dt>Design</dt>
            <dd>{formatRate(activeProfile.designHourlyRate)}</dd>
          </div>
          <div>
            <dt>Maschine</dt>
            <dd>{formatRate(activeProfile.machineHourlyRates[deviceType])}</dd>
          </div>
          <div>
            <dt>Marge</dt>
            <dd>{activeProfile.profitMargin.toLocaleString("de-DE")}</dd>
          </div>
        </dl>
      </section>

      {materialHelperOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="settings-panel material-panel" role="dialog" aria-modal="true" aria-label="Materialrechner">
            <header className="settings-header">
              <h2>Materialrechner</h2>
              <button className="icon-button" type="button" onClick={() => setMaterialHelperOpen(false)} aria-label="Schliessen">
                <X size={22} aria-hidden="true" />
              </button>
            </header>

            <div className="settings-fields">
              <NumberField label="Filamentgewicht" value={filamentGrams} suffix="g" onChange={setFilamentGrams} />
              <NumberField label="Filamentpreis" value={filamentPricePerKg} suffix="EUR/kg" onChange={setFilamentPricePerKg} />
            </div>

            <section className="helper-result" aria-live="polite">
              <span>Materialkosten</span>
              <strong>{filamentCost.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR</strong>
            </section>

            <footer className="settings-actions">
              <button className="ghost-button" type="button" onClick={() => setMaterialHelperOpen(false)}>
                Abbrechen
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setMaterialCost(formatDecimal(filamentCost, 3));
                  setMaterialHelperOpen(false);
                }}
              >
                Uebernehmen
              </button>
            </footer>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="settings-panel" role="dialog" aria-modal="true" aria-label="Einstellungen">
            <header className="settings-header">
              <h2>Einstellungen</h2>
              <button className="icon-button" type="button" onClick={() => setSettingsOpen(false)} aria-label="Schliessen">
                <X size={22} aria-hidden="true" />
              </button>
            </header>

            <div className="segmented compact" role="group" aria-label="Profil">
              {serviceTypes.map((type) => (
                <button
                  key={type}
                  className={type === settingsTab ? "active" : ""}
                  type="button"
                  onClick={() => setSettingsTab(type)}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="settings-fields">
              <NumberField
                label="Design-Stundensatz"
                value={settingsDrafts[settingsTab].designHourlyRate}
                suffix="EUR"
                onChange={(value) =>
                  updateDraft(settingsTab, "designHourlyRate", value, (numericValue) =>
                    updateProfile(settingsTab, (profile) => ({
                      ...profile,
                      designHourlyRate: numericValue,
                    }))
                  )
                }
              />
              <NumberField
                label="Maschine 3D Drucker"
                value={settingsDrafts[settingsTab].printerRate}
                suffix="EUR"
                onChange={(value) =>
                  updateDraft(settingsTab, "printerRate", value, (numericValue) =>
                    updateProfile(settingsTab, (profile) => ({
                      ...profile,
                      machineHourlyRates: {
                        ...profile.machineHourlyRates,
                        "3D Drucker": numericValue,
                      },
                    }))
                  )
                }
              />
              <NumberField
                label="Maschine Laser"
                value={settingsDrafts[settingsTab].laserRate}
                suffix="EUR"
                onChange={(value) =>
                  updateDraft(settingsTab, "laserRate", value, (numericValue) =>
                    updateProfile(settingsTab, (profile) => ({
                      ...profile,
                      machineHourlyRates: {
                        ...profile.machineHourlyRates,
                        Laser: numericValue,
                      },
                    }))
                  )
                }
              />
              <NumberField
                label="Gewinnmarge"
                value={settingsDrafts[settingsTab].profitMargin}
                suffix="x"
                onChange={(value) =>
                  updateDraft(settingsTab, "profitMargin", value, (numericValue) =>
                    updateProfile(settingsTab, (profile) => ({
                      ...profile,
                      profitMargin: numericValue,
                    }))
                  )
                }
              />
            </div>

            <footer className="settings-actions">
              <button className="ghost-button" type="button" onClick={resetProfiles}>
                Zuruecksetzen
              </button>
              <button className="primary-button" type="button" onClick={() => setSettingsOpen(false)}>
                Fertig
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

type NumberFieldProps = {
  label: string;
  value: string;
  suffix: string;
  onChange: (value: string) => void;
  action?: React.ReactNode;
};

function NumberField({ label, value, suffix, onChange, action }: NumberFieldProps) {
  return (
    <label className="number-field">
      <span className="field-label-row">
        <span>{label}</span>
        {action}
      </span>
      <span className="input-wrap">
        <input
          inputMode="decimal"
          pattern="[0-9]*[,.]?[0-9]*"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <em>{suffix}</em>
      </span>
    </label>
  );
}

type TimeFieldProps = {
  label: string;
  hours: string;
  minutes: string;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
};

function TimeField({ label, hours, minutes, onHoursChange, onMinutesChange }: TimeFieldProps) {
  const normalizedMinutes = normalizeMinutes(minutes);

  return (
    <label className="number-field time-field">
      <span>{label}</span>
      <span className="time-control time-keyboard">
        <span className="time-input-wrap">
          <input inputMode="numeric" pattern="[0-9]*" type="text" value={hours} onChange={(event) => onHoursChange(event.target.value)} />
          <em>Std.</em>
        </span>
        <span className="time-input-wrap">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            type="text"
            value={minutes}
            onChange={(event) => onMinutesChange(event.target.value)}
          />
          <em>Min.</em>
        </span>
      </span>
      <span className="time-control time-wheel">
        <span className="time-input-wrap">
          <select value={Math.min(Math.floor(parseInput(hours)), 24).toString()} onChange={(event) => onHoursChange(event.target.value)}>
            {Array.from({ length: 25 }, (_, hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
          <em>Std.</em>
        </span>
        <span className="time-input-wrap">
          <select value={normalizedMinutes} onChange={(event) => onMinutesChange(event.target.value)}>
            {Array.from({ length: 60 }, (_, minute) => (
              <option key={minute} value={minute}>
                {minute.toString().padStart(2, "0")}
              </option>
            ))}
          </select>
          <em>Min.</em>
        </span>
      </span>
    </label>
  );
}

function loadFilamentPrice(): string {
  try {
    const stored = localStorage.getItem(FILAMENT_PRICE_KEY);
    return stored && Number.isFinite(Number(stored)) ? stored : "20";
  } catch {
    return "20";
  }
}

function loadProfiles(): RateProfiles {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return mergeProfiles(raw ? JSON.parse(raw) : undefined);
  } catch {
    return DEFAULT_PROFILES;
  }
}

function parseInput(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function timeToHours(hours: string, minutes: string): number {
  return parseInput(hours) + Math.min(parseInput(minutes), 59) / 60;
}

function normalizeMinutes(value: string): string {
  return Math.min(Math.floor(parseInput(value)), 59).toString();
}

function isCompleteNumber(value: string): boolean {
  return /^\d+([,.]\d+)?$/.test(value.trim());
}

function profilesToDrafts(profiles: RateProfiles) {
  return {
    Freunde: profileToDraft(profiles.Freunde),
    Auftrag: profileToDraft(profiles.Auftrag),
  };
}

function profileToDraft(profile: RateProfiles[ServiceType]) {
  return {
    designHourlyRate: profile.designHourlyRate.toString(),
    printerRate: profile.machineHourlyRates["3D Drucker"].toString(),
    laserRate: profile.machineHourlyRates.Laser.toString(),
    profitMargin: profile.profitMargin.toString(),
  };
}

function formatEuro(value: number): string {
  return value.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatRate(value: number): string {
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} EUR/h`;
}

function formatDecimal(value: number, maximumFractionDigits: number): string {
  return value.toLocaleString("de-DE", {
    maximumFractionDigits,
    useGrouping: false,
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
