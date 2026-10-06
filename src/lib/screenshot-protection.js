const SHIELD_ID = "capture-protection-shield";
const WATERMARK_ID = "capture-protection-watermark";

let viewerName = "Convidado";
let eventLabel = "PEDRO 18";
let hideTimer = null;
let initialized = false;

function cleanLabel(value, fallback) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function getShield() {
  return document.getElementById(SHIELD_ID);
}

function getWatermark() {
  return document.getElementById(WATERMARK_ID);
}

function renderWatermark() {
  const root = getWatermark();
  if (!root) return;

  const label = `${eventLabel} • ${viewerName}`;
  root.setAttribute("aria-label", `Marca d'água: ${label}`);

  root.innerHTML = Array.from({ length: 18 }, (_, index) => (
    `<span aria-hidden="true">${label}</span>`
  )).join("");
}

function showShield(reason = "protected") {
  window.clearTimeout(hideTimer);

  const shield = getShield();
  if (!shield) return;

  shield.dataset.reason = reason;
  shield.classList.add("is-visible");
  document.documentElement.classList.add("capture-protection-active");
}

function hideShield(delay = 120) {
  window.clearTimeout(hideTimer);

  hideTimer = window.setTimeout(() => {
    const shield = getShield();
    if (!shield) return;

    shield.classList.remove("is-visible");
    document.documentElement.classList.remove("capture-protection-active");
  }, delay);
}

function flashShield(reason = "capture") {
  showShield(reason);
  hideShield(1100);
}

function ensureUi() {
  if (!document.body) return;

  if (!getWatermark()) {
    const watermark = document.createElement("div");
    watermark.id = WATERMARK_ID;
    watermark.className = "capture-protection-watermark";
    watermark.setAttribute("aria-hidden", "true");
    document.body.appendChild(watermark);
  }

  if (!getShield()) {
    const shield = document.createElement("div");
    shield.id = SHIELD_ID;
    shield.className = "capture-protection-shield";
    shield.setAttribute("aria-hidden", "true");
    shield.innerHTML = `
      <div class="capture-protection-card">
        <strong>Conteúdo protegido</strong>
        <span>Volte para a página para continuar.</span>
      </div>`;
    document.body.appendChild(shield);
  }

  renderWatermark();
}

function handleVisibility() {
  if (document.hidden) {
    showShield("visibility");
  } else if (document.hasFocus()) {
    hideShield();
  }
}

function handleKeydown(event) {
  const key = String(event.key || "").toLowerCase();

  if (event.key === "PrintScreen") {
    flashShield("printscreen");
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "p") {
    event.preventDefault();
    flashShield("print");
  }
}

function handleKeyup(event) {
  if (event.key === "PrintScreen") {
    flashShield("printscreen");
  }
}

function protectMediaEvents() {
  document.addEventListener("contextmenu", event => {
    if (event.target.closest("img, video, canvas, .photo-card, .photo-modal")) {
      event.preventDefault();
    }
  });

  document.addEventListener("dragstart", event => {
    if (event.target.closest("img, video, canvas")) {
      event.preventDefault();
    }
  });
}

export function setScreenshotWatermarkName(name) {
  viewerName = cleanLabel(name, "Convidado");
  renderWatermark();
}

export function initializeScreenshotProtection(options = {}) {
  viewerName = cleanLabel(options.viewerName, viewerName);
  eventLabel = cleanLabel(options.eventLabel, eventLabel);

  if (initialized) {
    renderWatermark();
    return;
  }

  initialized = true;
  ensureUi();

  window.addEventListener("blur", () => showShield("blur"), true);
  window.addEventListener("focus", () => hideShield(), true);
  document.addEventListener("visibilitychange", handleVisibility, true);
  document.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("keyup", handleKeyup, true);
  window.addEventListener("beforeprint", () => showShield("print"), true);
  window.addEventListener("afterprint", () => hideShield(), true);

  protectMediaEvents();

  // Algumas interfaces de captura do sistema fazem a janela perder foco.
  // Mantemos o conteúdo coberto enquanto a página não estiver ativa.
  if (document.hidden || !document.hasFocus()) {
    showShield("initial");
  }
}
