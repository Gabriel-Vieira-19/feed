const PUBLISHED_TYPE = "image/jpeg";
const MAX_RENDER_DIMENSION = 2600;

export const effects = Object.freeze([
  {
    id: "original",
    name: "Original",
    short: "Original",
    description: "Sem efeito.",
    liveFilter: "none",
  },
  {
    id: "dourado",
    name: "Dourado",
    short: "Dourado",
    description: "Tons dourados suaves para a iluminação da festa.",
    liveFilter: "contrast(1.04) saturate(.96) sepia(.18) brightness(.99)",
  },
  {
    id: "quente",
    name: "Quente",
    short: "Quente",
    description: "Pele e luzes mais quentes sem moldura.",
    liveFilter: "contrast(1.03) saturate(1.05) sepia(.12) brightness(1.01)",
  },
  {
    id: "frio",
    name: "Frio",
    short: "Frio",
    description: "Azuis discretos e atmosfera mais fria.",
    liveFilter: "contrast(1.04) saturate(.98) hue-rotate(5deg) brightness(.99)",
  },
  {
    id: "arquivo18",
    name: "Arquivo 18",
    short: "Arquivo 18",
    description: "Registro confidencial da noite.",
    liveFilter: "contrast(1.08) saturate(.78)",
  },
  {
    id: "flagra",
    name: "Flagra da Festa",
    short: "Flagra",
    description: "Paparazzi, flash e registro nº 018.",
    liveFilter: "contrast(1.16) saturate(.96) brightness(1.04)",
  },
  {
    id: "familia-nao",
    name: "A família NÃO vai ver",
    short: "Confidencial",
    description: "Tarjas e selo de arquivo comprometedor.",
    liveFilter: "contrast(1.12) saturate(.62)",
  },
  {
    id: "memoria",
    name: "Memória Desbloqueada",
    short: "Memória",
    description: "Uma conquista da noite em estilo videogame.",
    liveFilter: "contrast(1.08) saturate(1.04) brightness(.98)",
  },
  {
    id: "raridade",
    name: "Raridade da Foto",
    short: "Raridade",
    description: "A foto recebe uma raridade aleatória.",
    liveFilter: "contrast(1.06) saturate(1.12)",
  },
  {
    id: "detector-historias",
    name: "Detector de Histórias",
    short: "Detector",
    description: "Conta histórias que podem e não podem ser contadas.",
    liveFilter: "contrast(1.05) saturate(1.04) sepia(.05)",
  },
  {
    id: "descartavel18",
    name: "Câmera Descartável 18",
    short: "Descartável",
    description: "Filme, grão, flash e data impressa.",
    liveFilter: "contrast(1.06) saturate(.86) sepia(.12) brightness(1.04)",
  },
  {
    id: "primeira-noite",
    name: "Primeira Noite dos 18",
    short: "Primeira noite",
    description: "Tratamento dourado e editorial da festa.",
    liveFilter: "contrast(1.08) saturate(.92) sepia(.13) brightness(.96)",
  },
]);

const effectMap = new Map(effects.map(effect => [effect.id, effect]));

export function getEffect(effectId) {
  return effectMap.get(effectId) || effectMap.get("original");
}

export function effectUploadKey(effectId, meta = {}) {
  return `${getEffect(effectId).id}:${stableStringify(meta)}`;
}

function stableStringify(value) {
  if (!value || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted(items) {
  const roll = Math.random();
  let cursor = 0;
  for (const item of items) {
    cursor += item.weight;
    if (roll <= cursor) return item.value;
  }
  return items[items.length - 1].value;
}

export function createEffectMeta(effectId) {
  const capturedAt = new Date().toISOString();
  switch (effectId) {
    case "raridade": {
      const rarity = pickWeighted([
        { weight: 0.46, value: { label: "COMUM", code: "C" } },
        { weight: 0.29, value: { label: "RARA", code: "R" } },
        { weight: 0.17, value: { label: "ÉPICA", code: "E" } },
        { weight: 0.07, value: { label: "LENDÁRIA", code: "L" } },
        { weight: 0.01, value: { label: "NÃO DEVERIA EXISTIR", code: "X" } },
      ]);
      return { capturedAt, rarity: rarity.label, rarityCode: rarity.code };
    }
    case "detector-historias":
      return {
        capturedAt,
        tellable: randomInt(2, 28),
        classified: randomInt(18, 87),
      };
    case "memoria":
      return { capturedAt, memoryId: randomInt(18, 999), xp: randomInt(180, 1818) };
    case "arquivo18":
      return { capturedAt, archiveId: `18-${String(randomInt(1, 9999)).padStart(4, "0")}` };
    case "flagra":
      return { capturedAt, flagraId: String(randomInt(1, 999)).padStart(3, "0") };
    default:
      return { capturedAt };
  }
}

export function effectLiveOverlayHtml(effectId) {
  const effect = getEffect(effectId);
  switch (effect.id) {
    case "arquivo18":
      return `<div class="live-overlay overlay-archive"><span>ARQUIVO 018</span><strong>REGISTRO OFICIAL</strong><small>26.12.2026 • GARÇA/SP</small></div>`;
    case "flagra":
      return `<div class="live-overlay overlay-flagra"><span>● REC</span><strong>FLAGRA Nº 018</strong><small>26.12.2026</small></div>`;
    case "familia-nao":
      return `<div class="live-overlay overlay-classified"><span>CONFIDENCIAL</span><strong>NÃO ENVIAR AO GRUPO DA FAMÍLIA</strong></div>`;
    case "memoria":
      return `<div class="live-overlay overlay-memory"><span>MEMÓRIA DESBLOQUEADA</span><strong>PEDRO 18</strong></div>`;
    case "raridade":
      return `<div class="live-overlay overlay-rarity"><span>ANALISANDO RARIDADE…</span><strong>???</strong></div>`;
    case "detector-historias":
      return `<div class="live-overlay overlay-detector"><span>DETECTOR DE HISTÓRIAS</span><strong>ANALISANDO…</strong></div>`;
    case "descartavel18":
      return `<div class="live-overlay overlay-disposable"><span>PEDRO18 • 018</span><strong>26 12 '26</strong></div>`;
    case "primeira-noite":
      return `<div class="live-overlay overlay-first-night"><span>PEDRO XVIII</span><strong>PRIMEIRA NOITE DOS 18</strong><small>26 • 12 • 2026</small></div>`;
    default:
      return "";
  }
}

async function decodeImage(file) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw(ctx, width, height) { ctx.drawImage(bitmap, 0, 0, width, height); },
        close() { bitmap.close?.(); },
      };
    } catch {
      // Alguns formatos no Safari caem no fallback abaixo.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw(ctx, width, height) { ctx.drawImage(image, 0, 0, width, height); },
      close() {},
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas, type = PUBLISHED_TYPE, quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) reject(new Error("Não foi possível gerar a foto com efeito."));
      else resolve(blob);
    }, type, quality);
  });
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function adjustPixels(ctx, width, height, preset) {
  if (!preset) return;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const contrast = Number(preset.contrast ?? 1);
  const saturation = Number(preset.saturation ?? 1);
  const warmth = Number(preset.warmth ?? 0);
  const brightness = Number(preset.brightness ?? 0);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const gray = r * 0.299 + g * 0.587 + b * 0.114;
    r = gray + (r - gray) * saturation;
    g = gray + (g - gray) * saturation;
    b = gray + (b - gray) * saturation;
    r = (r - 128) * contrast + 128 + brightness + warmth;
    g = (g - 128) * contrast + 128 + brightness + warmth * 0.22;
    b = (b - 128) * contrast + 128 + brightness - warmth;
    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }
  ctx.putImageData(imageData, 0, 0);
}

function drawVignette(ctx, width, height, strength = 0.28) {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.2,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72,
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawNoise(ctx, width, height, opacity = 0.07) {
  const tile = document.createElement("canvas");
  tile.width = 96;
  tile.height = 96;
  const tctx = tile.getContext("2d");
  const image = tctx.createImageData(tile.width, tile.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = randomInt(70, 190);
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = randomInt(0, Math.round(255 * opacity));
  }
  tctx.putImageData(image, 0, 0);
  const pattern = ctx.createPattern(tile, "repeat");
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawLightLeak(ctx, width, height) {
  const gradient = ctx.createRadialGradient(width * 0.08, height * 0.18, 0, width * 0.08, height * 0.18, Math.max(width, height) * 0.62);
  gradient.addColorStop(0, "rgba(255,184,91,.22)");
  gradient.addColorStop(0.35, "rgba(255,94,66,.09)");
  gradient.addColorStop(1, "rgba(255,94,66,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function formatCapture(meta) {
  const date = new Date(meta?.capturedAt || Date.now());
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return { date: `${dd}.${mm}.${yy}`, time: `${hh}:${min}` };
}

function roundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, width, height, radius, fill) {
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, width, height, radius, stroke, lineWidth) {
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawArchive(ctx, width, height, meta) {
  adjustPixels(ctx, width, height, { contrast: 1.08, saturation: 0.76, warmth: 2, brightness: -2 });
  drawVignette(ctx, width, height, 0.18);
  const u = Math.min(width, height);
  const pad = u * 0.045;
  const line = Math.max(2, u * 0.0025);
  ctx.strokeStyle = "rgba(243,233,208,.82)";
  ctx.lineWidth = line;
  ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
  ctx.fillStyle = "rgba(8,18,29,.68)";
  ctx.fillRect(pad, pad, width - pad * 2, u * 0.16);
  ctx.fillStyle = "#f5ead2";
  ctx.font = `700 ${u * 0.052}px system-ui, sans-serif`;
  ctx.fillText("ARQUIVO 018", pad * 1.45, pad + u * 0.067);
  ctx.font = `600 ${u * 0.023}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(245,234,210,.78)";
  ctx.fillText(`REGISTRO ${meta?.archiveId || "18-0000"} • 26.12.2026 • GARÇA/SP`, pad * 1.45, pad + u * 0.112);
  ctx.save();
  ctx.translate(width - pad * 1.05, height * 0.52);
  ctx.rotate(Math.PI / 2);
  ctx.font = `700 ${u * 0.022}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(245,234,210,.7)";
  ctx.fillText("REGISTRO OFICIAL DA NOITE", 0, 0);
  ctx.restore();
}

function drawFlagra(ctx, width, height, meta) {
  adjustPixels(ctx, width, height, { contrast: 1.16, saturation: 0.94, warmth: -2, brightness: 5 });
  const u = Math.min(width, height);
  const flash = ctx.createRadialGradient(width * 0.5, height * 0.12, 0, width * 0.5, height * 0.12, u * 0.58);
  flash.addColorStop(0, "rgba(255,255,255,.25)");
  flash.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = flash;
  ctx.fillRect(0, 0, width, height);
  const pad = u * 0.045;
  const bracket = u * 0.09;
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = Math.max(3, u * 0.004);
  [[pad,pad,1,1],[width-pad,pad,-1,1],[pad,height-pad,1,-1],[width-pad,height-pad,-1,-1]].forEach(([x,y,sx,sy]) => {
    ctx.beginPath(); ctx.moveTo(x + bracket * sx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + bracket * sy); ctx.stroke();
  });
  const stamp = formatCapture(meta);
  fillRoundRect(ctx, pad, height - pad - u * 0.14, width - pad * 2, u * 0.14, u * 0.018, "rgba(3,8,14,.63)");
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${u * 0.043}px system-ui, sans-serif`;
  ctx.fillText(`FLAGRA Nº ${meta?.flagraId || "018"}`, pad * 1.45, height - pad - u * 0.074);
  ctx.font = `600 ${u * 0.024}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.fillText(`${stamp.date}  ${stamp.time}  •  PEDRO 18`, pad * 1.45, height - pad - u * 0.035);
  ctx.fillStyle = "#ff5757";
  ctx.beginPath(); ctx.arc(width - pad * 1.55, pad * 1.55, u * 0.012, 0, Math.PI * 2); ctx.fill();
}

function drawFamilyNo(ctx, width, height) {
  adjustPixels(ctx, width, height, { contrast: 1.13, saturation: 0.58, warmth: -1, brightness: -3 });
  drawVignette(ctx, width, height, 0.33);
  const u = Math.min(width, height);
  const pad = u * 0.045;
  ctx.save();
  ctx.translate(width * 0.5, height * 0.18);
  ctx.rotate(-0.055);
  fillRoundRect(ctx, -u * 0.34, -u * 0.065, u * 0.68, u * 0.13, u * 0.01, "rgba(153,18,26,.86)");
  strokeRoundRect(ctx, -u * 0.34, -u * 0.065, u * 0.68, u * 0.13, u * 0.01, "rgba(255,235,226,.75)", Math.max(2, u * 0.003));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff1e7";
  ctx.font = `900 ${u * 0.052}px system-ui, sans-serif`;
  ctx.fillText("CONFIDENCIAL", 0, 0);
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,.84)";
  ctx.fillRect(pad, height - pad - u * 0.16, width - pad * 2, u * 0.16);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = `800 ${u * 0.038}px system-ui, sans-serif`;
  ctx.fillText("NÃO ENVIAR AO GRUPO DA FAMÍLIA", width / 2, height - pad - u * 0.09);
  ctx.font = `600 ${u * 0.022}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,.68)";
  ctx.fillText("ARQUIVO CLASSIFICADO • PEDRO 18", width / 2, height - pad - u * 0.045);
  ctx.textAlign = "left";
}

function drawMemory(ctx, width, height, meta) {
  adjustPixels(ctx, width, height, { contrast: 1.08, saturation: 1.04, warmth: -3, brightness: -2 });
  drawVignette(ctx, width, height, 0.16);
  const u = Math.min(width, height);
  const pad = u * 0.045;
  const boxHeight = u * 0.205;
  fillRoundRect(ctx, pad, height - pad - boxHeight, width - pad * 2, boxHeight, u * 0.025, "rgba(5,14,28,.82)");
  strokeRoundRect(ctx, pad, height - pad - boxHeight, width - pad * 2, boxHeight, u * 0.025, "rgba(216,179,106,.78)", Math.max(2, u * 0.003));
  ctx.fillStyle = "#d8b36a";
  ctx.font = `800 ${u * 0.027}px system-ui, sans-serif`;
  ctx.fillText("MEMÓRIA DESBLOQUEADA", pad * 1.55, height - pad - boxHeight + u * 0.055);
  ctx.fillStyle = "#fff8eb";
  ctx.font = `700 ${u * 0.048}px Georgia, serif`;
  ctx.fillText("Pedro 18", pad * 1.55, height - pad - boxHeight + u * 0.116);
  ctx.fillStyle = "rgba(255,248,235,.7)";
  ctx.font = `600 ${u * 0.022}px system-ui, sans-serif`;
  ctx.fillText(`#${meta?.memoryId || "018"}  •  +${meta?.xp || 180} XP  •  26.12.2026`, pad * 1.55, height - pad - boxHeight + u * 0.163);
}

function drawRarity(ctx, width, height, meta) {
  adjustPixels(ctx, width, height, { contrast: 1.07, saturation: 1.13, warmth: 3, brightness: 0 });
  drawVignette(ctx, width, height, 0.14);
  const u = Math.min(width, height);
  const pad = u * 0.045;
  const rarity = String(meta?.rarity || "RARA");
  const secret = meta?.rarityCode === "X";
  const widthBox = Math.min(width - pad * 2, u * (secret ? 0.8 : 0.58));
  fillRoundRect(ctx, (width - widthBox) / 2, pad, widthBox, u * 0.145, u * 0.02, secret ? "rgba(105,8,20,.86)" : "rgba(7,20,36,.78)");
  strokeRoundRect(ctx, (width - widthBox) / 2, pad, widthBox, u * 0.145, u * 0.02, secret ? "rgba(255,120,120,.9)" : "rgba(216,179,106,.9)", Math.max(2, u * 0.003));
  ctx.textAlign = "center";
  ctx.fillStyle = secret ? "#ffd8d8" : "#d8b36a";
  ctx.font = `800 ${u * 0.021}px system-ui, sans-serif`;
  ctx.fillText("RARIDADE DA FOTO", width / 2, pad + u * 0.045);
  ctx.fillStyle = "#fff8eb";
  ctx.font = `900 ${u * (secret ? 0.035 : 0.052)}px system-ui, sans-serif`;
  ctx.fillText(rarity, width / 2, pad + u * 0.105);
  ctx.textAlign = "left";
}

function drawDetector(ctx, width, height, meta) {
  adjustPixels(ctx, width, height, { contrast: 1.05, saturation: 1.03, warmth: 4, brightness: -1 });
  drawVignette(ctx, width, height, 0.13);
  const u = Math.min(width, height);
  const pad = u * 0.045;
  const boxHeight = u * 0.25;
  fillRoundRect(ctx, pad, height - pad - boxHeight, width - pad * 2, boxHeight, u * 0.022, "rgba(6,18,29,.83)");
  strokeRoundRect(ctx, pad, height - pad - boxHeight, width - pad * 2, boxHeight, u * 0.022, "rgba(82,224,185,.72)", Math.max(2, u * 0.0025));
  ctx.fillStyle = "#52e0b9";
  ctx.font = `800 ${u * 0.024}px system-ui, sans-serif`;
  ctx.fillText("DETECTOR DE HISTÓRIAS", pad * 1.5, height - pad - boxHeight + u * 0.052);
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${u * 0.03}px system-ui, sans-serif`;
  ctx.fillText(`Podem ser contadas: ${meta?.tellable ?? 12}`, pad * 1.5, height - pad - boxHeight + u * 0.115);
  ctx.fillText(`Melhor não contar: ${meta?.classified ?? 43}`, pad * 1.5, height - pad - boxHeight + u * 0.166);
  ctx.fillStyle = "rgba(255,255,255,.62)";
  ctx.font = `600 ${u * 0.019}px system-ui, sans-serif`;
  ctx.fillText("Resultado totalmente científico • Pedro 18", pad * 1.5, height - pad - boxHeight + u * 0.211);
}

function drawDisposable(ctx, width, height, meta) {
  adjustPixels(ctx, width, height, { contrast: 1.07, saturation: 0.84, warmth: 10, brightness: 4 });
  drawLightLeak(ctx, width, height);
  drawVignette(ctx, width, height, 0.28);
  drawNoise(ctx, width, height, 0.08);
  const u = Math.min(width, height);
  const pad = u * 0.04;
  const stamp = formatCapture(meta);
  ctx.fillStyle = "rgba(255,179,92,.92)";
  ctx.font = `700 ${u * 0.026}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillText(`PEDRO18   018   ${stamp.date}   ${stamp.time}`, pad, height - pad);
}

function drawFirstNight(ctx, width, height) {
  adjustPixels(ctx, width, height, { contrast: 1.09, saturation: 0.9, warmth: 10, brightness: -5 });
  drawVignette(ctx, width, height, 0.3);
  const u = Math.min(width, height);
  const pad = u * 0.05;
  ctx.strokeStyle = "rgba(216,179,106,.8)";
  ctx.lineWidth = Math.max(2, u * 0.0022);
  ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
  const y = height - pad - u * 0.1;
  ctx.textAlign = "center";
  ctx.fillStyle = "#f3dfb2";
  ctx.font = `600 ${u * 0.045}px Georgia, serif`;
  ctx.fillText("PEDRO XVIII", width / 2, y);
  ctx.fillStyle = "rgba(243,223,178,.72)";
  ctx.font = `600 ${u * 0.019}px system-ui, sans-serif`;
  ctx.fillText("PRIMEIRA NOITE DOS 18  •  26 12 2026  •  GARÇA SP", width / 2, y + u * 0.043);
  ctx.textAlign = "left";
}

function drawSimpleColor(ctx, width, height, kind) {
  if (kind === "dourado") {
    adjustPixels(ctx, width, height, { contrast: 1.04, saturation: 0.96, warmth: 12, brightness: -1 });
    drawVignette(ctx, width, height, 0.09);
  } else if (kind === "quente") {
    adjustPixels(ctx, width, height, { contrast: 1.03, saturation: 1.05, warmth: 16, brightness: 2 });
  } else if (kind === "frio") {
    adjustPixels(ctx, width, height, { contrast: 1.04, saturation: 0.98, warmth: -15, brightness: -1 });
  }
}

function applyEffectDrawing(ctx, width, height, effectId, meta) {
  switch (effectId) {
    case "dourado": drawSimpleColor(ctx, width, height, "dourado"); break;
    case "quente": drawSimpleColor(ctx, width, height, "quente"); break;
    case "frio": drawSimpleColor(ctx, width, height, "frio"); break;
    case "arquivo18": drawArchive(ctx, width, height, meta); break;
    case "flagra": drawFlagra(ctx, width, height, meta); break;
    case "familia-nao": drawFamilyNo(ctx, width, height, meta); break;
    case "memoria": drawMemory(ctx, width, height, meta); break;
    case "raridade": drawRarity(ctx, width, height, meta); break;
    case "detector-historias": drawDetector(ctx, width, height, meta); break;
    case "descartavel18": drawDisposable(ctx, width, height, meta); break;
    case "primeira-noite": drawFirstNight(ctx, width, height, meta); break;
    default: break;
  }
}

export async function renderEffectFile(originalFile, effectId, meta = {}) {
  const effect = getEffect(effectId);
  if (effect.id === "original") return null;

  const source = await decodeImage(originalFile);
  try {
    if (!source.width || !source.height) throw new Error("Não foi possível ler a foto capturada.");
    const scale = Math.min(1, MAX_RENDER_DIMENSION / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!ctx) throw new Error("Seu navegador não conseguiu preparar o efeito.");
    ctx.fillStyle = "#061426";
    ctx.fillRect(0, 0, width, height);
    source.draw(ctx, width, height);
    applyEffectDrawing(ctx, width, height, effect.id, meta);
    const blob = await canvasToBlob(canvas, PUBLISHED_TYPE, 0.92);
    canvas.width = 1;
    canvas.height = 1;
    const stem = String(originalFile.name || "foto").replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${stem}-${effect.id}.jpg`, {
      type: PUBLISHED_TYPE,
      lastModified: originalFile.lastModified || Date.now(),
    });
  } finally {
    source.close();
  }
}
