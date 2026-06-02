const STORAGE_KEY = "kostenrechner.rateProfiles.v1";
const FILAMENT_PRICE_KEY = "kostenrechner.filamentPricePerKg.v1";

const serviceTypes = ["Freunde", "Auftrag"];
const deviceTypes = ["3D Drucker", "Laser"];

const defaultProfiles = {
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

const state = {
  serviceType: "Freunde",
  deviceType: "Laser",
  materialCost: "3.415",
  filamentGrams: "",
  filamentPricePerKg: loadFilamentPrice(),
  designHours: "3",
  designMinutes: "0",
  machineHours: "1",
  machineMinutes: "0",
  profiles: loadProfiles(),
  settingsOpen: false,
  materialHelperOpen: false,
  settingsTab: "Freunde",
};

const root = document.getElementById("root");

render();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => undefined);
}

function render() {
  const profile = state.profiles[state.serviceType];
  const rawPrice = calculateRawPrice();
  const roundedPrice = Math.round(rawPrice);

  root.innerHTML = `
    <main class="app-shell">
      <section class="calculator" aria-label="Kostenrechner">
        <header class="top-bar">
          <div>
            <p class="eyebrow">3D Druck und Laser</p>
            <h1>Kostenrechner</h1>
          </div>
          <button class="icon-button" type="button" data-action="open-settings" aria-label="Einstellungen">
            ${settingsIcon()}
          </button>
        </header>

        <div class="segmented" role="group" aria-label="Zielgruppe">
          ${serviceTypes.map((type) => segmentButton(type, state.serviceType, "service")).join("")}
        </div>

        <div class="segmented device" role="group" aria-label="Geraetetyp">
          ${deviceTypes.map((type) => segmentButton(type, state.deviceType, "device")).join("")}
        </div>

        <div class="input-grid">
          ${numberField("Materialkosten", "materialCost", state.materialCost, "EUR", false, "material-helper")}
          ${timeField("Designzeit", "design")}
          ${timeField("Maschinenzeit", "machine")}
        </div>

        <section class="result-panel" aria-live="polite">
          <span>Endpreis</span>
          <strong>${formatEuro(roundedPrice)}</strong>
          <small>Rohwert ${rawPrice.toLocaleString("de-DE", { maximumFractionDigits: 4 })} EUR</small>
        </section>

        <dl class="rate-summary">
          <div>
            <dt>Design</dt>
            <dd>${formatRate(profile.designHourlyRate)}</dd>
          </div>
          <div>
            <dt>Maschine</dt>
            <dd>${formatRate(profile.machineHourlyRates[state.deviceType])}</dd>
          </div>
          <div>
            <dt>Marge</dt>
            <dd>${profile.profitMargin.toLocaleString("de-DE")}</dd>
          </div>
        </dl>
      </section>

      ${state.settingsOpen ? settingsPanel() : ""}
      ${state.materialHelperOpen ? materialHelperPanel() : ""}
    </main>
  `;

  bindEvents();
}

function settingsPanel() {
  const profile = state.profiles[state.settingsTab];

  return `
    <div class="modal-backdrop" role="presentation">
      <section class="settings-panel" role="dialog" aria-modal="true" aria-label="Einstellungen">
        <header class="settings-header">
          <h2>Einstellungen</h2>
          <button class="icon-button" type="button" data-action="close-settings" aria-label="Schliessen">
            ${closeIcon()}
          </button>
        </header>

        <div class="segmented compact" role="group" aria-label="Profil">
          ${serviceTypes.map((type) => segmentButton(type, state.settingsTab, "settings-tab")).join("")}
        </div>

        <div class="settings-fields">
          ${numberField("Design-Stundensatz", "designHourlyRate", profile.designHourlyRate, "EUR", true)}
          ${numberField("Maschine 3D Drucker", "printerRate", profile.machineHourlyRates["3D Drucker"], "EUR", true)}
          ${numberField("Maschine Laser", "laserRate", profile.machineHourlyRates.Laser, "EUR", true)}
          ${numberField("Gewinnmarge", "profitMargin", profile.profitMargin, "x", true)}
        </div>

        <footer class="settings-actions">
          <button class="ghost-button" type="button" data-action="reset-profiles">Zuruecksetzen</button>
          <button class="primary-button" type="button" data-action="close-settings">Fertig</button>
        </footer>
      </section>
    </div>
  `;
}

function materialHelperPanel() {
  const calculatedCost = calculateFilamentCost();

  return `
    <div class="modal-backdrop" role="presentation">
      <section class="settings-panel material-panel" role="dialog" aria-modal="true" aria-label="Materialrechner">
        <header class="settings-header">
          <h2>Materialrechner</h2>
          <button class="icon-button" type="button" data-action="close-material-helper" aria-label="Schliessen">
            ${closeIcon()}
          </button>
        </header>

        <div class="settings-fields">
          ${numberField("Filamentgewicht", "filamentGrams", state.filamentGrams, "g", false, "", "helper-field")}
          ${numberField("Filamentpreis", "filamentPricePerKg", state.filamentPricePerKg, "EUR/kg", false, "", "helper-field")}
        </div>

        <section class="helper-result" aria-live="polite">
          <span>Materialkosten</span>
          <strong>${calculatedCost.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR</strong>
        </section>

        <footer class="settings-actions">
          <button class="ghost-button" type="button" data-action="close-material-helper">Abbrechen</button>
          <button class="primary-button" type="button" data-action="apply-material-helper">Uebernehmen</button>
        </footer>
      </section>
    </div>
  `;
}

function bindEvents() {
  root.querySelectorAll("[data-service]").forEach((button) => {
    button.addEventListener("click", () => {
      state.serviceType = button.dataset.service;
      render();
    });
  });

  root.querySelectorAll("[data-device]").forEach((button) => {
    button.addEventListener("click", () => {
      state.deviceType = button.dataset.device;
      render();
    });
  });

  root.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.settingsTab = button.dataset.settingsTab;
      render();
    });
  });

  root.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("input", () => {
      state[input.dataset.field] = input.value;
      updateLiveResult();
    });
  });

  root.querySelectorAll("[data-helper-field]").forEach((input) => {
    input.addEventListener("input", () => {
      state[input.dataset.helperField] = input.value;
      if (input.dataset.helperField === "filamentPricePerKg") saveFilamentPrice();
      updateMaterialHelperResult();
    });
  });

  root.querySelectorAll("[data-time-field]").forEach((input) => {
    const eventName = input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventName, () => {
      const prefix = input.dataset.timeField;
      const unit = input.dataset.timeUnit;
      state[`${prefix}${unit}`] = input.value;
      updateLiveResult();
    });
  });

  root.querySelectorAll("[data-setting-field]").forEach((input) => {
    input.addEventListener("input", () => {
      updateSetting(input.dataset.settingField, input.value);
      saveProfiles();
      updateLiveResult();
    });
  });

  root.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "open-settings") state.settingsOpen = true;
      if (action === "close-settings") state.settingsOpen = false;
      if (action === "open-material-helper") state.materialHelperOpen = true;
      if (action === "close-material-helper") state.materialHelperOpen = false;
      if (action === "apply-material-helper") {
        state.materialCost = formatDecimal(calculateFilamentCost(), 3);
        state.materialHelperOpen = false;
      }
      if (action === "reset-profiles") {
        state.profiles = structuredClone(defaultProfiles);
        saveProfiles();
      }
      render();
    });
  });
}

function updateLiveResult() {
  const rawPrice = calculateRawPrice();
  const result = root.querySelector(".result-panel strong");
  const detail = root.querySelector(".result-panel small");
  if (result) result.textContent = formatEuro(Math.round(rawPrice));
  if (detail) detail.textContent = `Rohwert ${rawPrice.toLocaleString("de-DE", { maximumFractionDigits: 4 })} EUR`;
}

function updateMaterialHelperResult() {
  const result = root.querySelector(".helper-result strong");
  if (result) {
    result.textContent = `${calculateFilamentCost().toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} EUR`;
  }
}

function updateSetting(field, value) {
  const profile = state.profiles[state.settingsTab];
  const parsed = parseInput(value);

  if (field === "designHourlyRate") profile.designHourlyRate = parsed;
  if (field === "printerRate") profile.machineHourlyRates["3D Drucker"] = parsed;
  if (field === "laserRate") profile.machineHourlyRates.Laser = parsed;
  if (field === "profitMargin") profile.profitMargin = parsed;
}

function segmentButton(type, activeType, target) {
  const dataAttribute = target === "service" ? "data-service" : target === "device" ? "data-device" : "data-settings-tab";
  return `
    <button class="${type === activeType ? "active" : ""}" type="button" ${dataAttribute}="${escapeHtml(type)}">
      ${escapeHtml(type)}
    </button>
  `;
}

function numberField(label, name, value, suffix, setting = false, helperAction = "", fieldGroup = "") {
  const dataAttribute =
    fieldGroup === "helper-field" ? `data-helper-field="${name}"` : setting ? `data-setting-field="${name}"` : `data-field="${name}"`;
  const actionButton =
    helperAction === "material-helper"
      ? `<button class="mini-tool-button" type="button" data-action="open-material-helper" aria-label="Materialkosten aus Filamentgewicht berechnen">${calculatorIcon()}</button>`
      : "";

  return `
    <label class="number-field">
      <span class="field-label-row">
        <span>${escapeHtml(label)}</span>
        ${actionButton}
      </span>
      <span class="input-wrap">
        <input inputmode="decimal" pattern="[0-9]*[,.]?[0-9]*" type="text" value="${escapeHtml(String(value))}" ${dataAttribute} />
        <em>${escapeHtml(suffix)}</em>
      </span>
    </label>
  `;
}

function timeField(label, prefix) {
  const hours = state[`${prefix}Hours`];
  const minutes = normalizeMinutes(state[`${prefix}Minutes`]);

  return `
    <label class="number-field time-field">
      <span>${escapeHtml(label)}</span>
      <span class="time-control time-keyboard">
        <span class="time-input-wrap">
          <input inputmode="numeric" pattern="[0-9]*" type="text" value="${escapeHtml(String(hours))}" data-time-field="${prefix}" data-time-unit="Hours" />
          <em>Std.</em>
        </span>
        <span class="time-input-wrap">
          <input inputmode="numeric" pattern="[0-9]*" type="text" value="${escapeHtml(String(minutes))}" data-time-field="${prefix}" data-time-unit="Minutes" />
          <em>Min.</em>
        </span>
      </span>
      <span class="time-control time-wheel">
        <span class="time-input-wrap">
          <select data-time-field="${prefix}" data-time-unit="Hours" aria-label="${escapeHtml(label)} Stunden">
            ${hourOptions(hours)}
          </select>
          <em>Std.</em>
        </span>
        <span class="time-input-wrap">
          <select data-time-field="${prefix}" data-time-unit="Minutes" aria-label="${escapeHtml(label)} Minuten">
            ${minuteOptions(minutes)}
          </select>
          <em>Min.</em>
        </span>
      </span>
    </label>
  `;
}

function calculateRawPrice() {
  const profile = state.profiles[state.serviceType];
  return (
    parseInput(state.materialCost) +
    timeToHours("design") * parseInput(profile.designHourlyRate) +
    timeToHours("machine") * parseInput(profile.machineHourlyRates[state.deviceType])
  ) * parseInput(profile.profitMargin);
}

function calculateFilamentCost() {
  return (parseInput(state.filamentGrams) / 1000) * parseInput(state.filamentPricePerKg);
}

function parseInput(value) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function timeToHours(prefix) {
  const hours = parseInput(state[`${prefix}Hours`]);
  const minutes = Math.min(parseInput(state[`${prefix}Minutes`]), 59);
  return hours + minutes / 60;
}

function normalizeMinutes(value) {
  return String(Math.min(Math.floor(parseInput(value)), 59));
}

function hourOptions(selectedValue) {
  const selected = String(Math.min(Math.floor(parseInput(selectedValue)), 24));
  return Array.from({ length: 25 }, (_, hour) => {
    const value = String(hour);
    return `<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`;
  }).join("");
}

function minuteOptions(selectedValue) {
  const selected = normalizeMinutes(selectedValue);
  return Array.from({ length: 60 }, (_, minute) => {
    const value = String(minute);
    return `<option value="${value}" ${value === selected ? "selected" : ""}>${value.padStart(2, "0")}</option>`;
  }).join("");
}

function loadFilamentPrice() {
  try {
    const stored = localStorage.getItem(FILAMENT_PRICE_KEY);
    return stored && Number.isFinite(Number(stored)) ? stored : "20";
  } catch {
    return "20";
  }
}

function loadProfiles() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return mergeProfiles(stored ? JSON.parse(stored) : undefined);
  } catch {
    return structuredClone(defaultProfiles);
  }
}

function mergeProfiles(storedProfiles) {
  return {
    Freunde: mergeProfile(defaultProfiles.Freunde, storedProfiles?.Freunde),
    Auftrag: mergeProfile(defaultProfiles.Auftrag, storedProfiles?.Auftrag),
  };
}

function mergeProfile(defaultProfile, storedProfile) {
  return {
    designHourlyRate: numberOrDefault(storedProfile?.designHourlyRate, defaultProfile.designHourlyRate),
    machineHourlyRates: {
      "3D Drucker": numberOrDefault(
        storedProfile?.machineHourlyRates?.["3D Drucker"],
        defaultProfile.machineHourlyRates["3D Drucker"]
      ),
      Laser: numberOrDefault(storedProfile?.machineHourlyRates?.Laser, defaultProfile.machineHourlyRates.Laser),
    },
    profitMargin: numberOrDefault(storedProfile?.profitMargin, defaultProfile.profitMargin),
  };
}

function numberOrDefault(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function saveFilamentPrice() {
  try {
    localStorage.setItem(FILAMENT_PRICE_KEY, String(parseInput(state.filamentPricePerKg)));
  } catch {
    return undefined;
  }
}

function saveProfiles() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.profiles));
  } catch {
    return undefined;
  }
}

function formatDecimal(value, maximumFractionDigits) {
  return value.toLocaleString("de-DE", {
    maximumFractionDigits,
    useGrouping: false,
  });
}

function formatEuro(value) {
  return value.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatRate(value) {
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} EUR/h`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char];
  });
}

function settingsIcon() {
  return `
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `;
}

function closeIcon() {
  return `
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>
  `;
}

function calculatorIcon() {
  return `
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <path d="M8 6h8"/>
      <path d="M8 10h.01"/>
      <path d="M12 10h.01"/>
      <path d="M16 10h.01"/>
      <path d="M8 14h.01"/>
      <path d="M12 14h.01"/>
      <path d="M16 14h.01"/>
      <path d="M8 18h.01"/>
      <path d="M12 18h.01"/>
      <path d="M16 18h.01"/>
    </svg>
  `;
}
