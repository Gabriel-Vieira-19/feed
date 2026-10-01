const PUBLISHED_TYPE = "image/jpeg";
const MAX_RENDER_DIMENSION = 2600;

export const effects = Object.freeze([
  { id: "original", name: "Original", short: "Original", description: "Sem efeito.", liveFilter: "none" },
  { id: "dourado", name: "Dourado", short: "Dourado", description: "Dourado discreto, pensado para luzes quentes da festa.", liveFilter: "contrast(1.04) saturate(.96) sepia(.18) brightness(.99)" },
  { id: "quente", name: "Quente", short: "Quente", description: "Temperatura quente natural, preservando tons de pele.", liveFilter: "contrast(1.03) saturate(1.05) sepia(.12) brightness(1.01)" },
  { id: "ambar", name: "Âmbar", short: "Âmbar", description: "Luz âmbar mais marcada, inspirada em iluminação de salão.", liveFilter: "contrast(1.05) saturate(1.04) sepia(.28) brightness(1.01)" },
  { id: "champagne", name: "Champagne", short: "Champagne", description: "Quente, claro e suave, com aparência de fotografia social.", liveFilter: "contrast(.98) saturate(.86) sepia(.14) brightness(1.06)" },
  { id: "rose", name: "Rosé", short: "Rosé", description: "Calor suave com um toque rosado, sem exagerar a pele.", liveFilter: "contrast(1.02) saturate(.96) sepia(.09) hue-rotate(-7deg) brightness(1.02)" },
  { id: "frio", name: "Frio", short: "Frio", description: "Temperatura fria e limpa.", liveFilter: "contrast(1.04) saturate(.98) hue-rotate(5deg) brightness(.99)" },
  { id: "blue-hour", name: "Blue Hour", short: "Blue Hour", description: "Azul noturno elegante para luzes frias e LED.", liveFilter: "contrast(1.09) saturate(.82) hue-rotate(8deg) brightness(.96)" },
  { id: "noturno", name: "Noturno", short: "Noturno", description: "Contraste de festa noturna, sombras mais profundas e cor controlada.", liveFilter: "contrast(1.16) saturate(.78) brightness(.92)" },
  { id: "arquivo18", name: "Arquivo 18", short: "Arquivo 18", description: "Ficha editorial de arquivo da noite, com número único.", liveFilter: "contrast(1.08) saturate(.78)" },
  { id: "flagra", name: "Flagra da Festa", short: "Flagra", description: "Visual de foto de imprensa com flash e registro do momento.", liveFilter: "contrast(1.16) saturate(.96) brightness(1.04)" },
  { id: "familia-nao", name: "A família NÃO vai ver", short: "Confidencial", description: "Documento censurado com tarjas e selo confidencial.", liveFilter: "contrast(1.12) saturate(.62)" },
  { id: "memoria", name: "Memória Desbloqueada", short: "Memória", description: "Registro da noite tratado como memória conquistada.", liveFilter: "contrast(1.08) saturate(1.04) brightness(.98)" },
  { id: "raridade", name: "Raridade da Foto", short: "Raridade", description: "Classificação aleatória exibida antes do clique e preservada na foto.", liveFilter: "contrast(1.06) saturate(1.12)" },
  { id: "detector-historias", name: "Detector de Histórias", short: "Detector", description: "Resultado aleatório aparece ao vivo e fica gravado na foto.", liveFilter: "contrast(1.05) saturate(1.04) sepia(.05)" },
  { id: "descartavel18", name: "Câmera Descartável 18", short: "Descartável", description: "Filme, grão, vazamento de luz e data impressa.", liveFilter: "contrast(1.06) saturate(.86) sepia(.12) brightness(1.04)" },
  { id: "primeira-noite", name: "Primeira Noite dos 18", short: "Primeira noite", description: "Moldura social em azul-marinho e dourado, inspirada na identidade da festa.", liveFilter: "contrast(1.08) saturate(.92) sepia(.13) brightness(.96)" },
  { id: "editorial2612", name: "Editorial 26.12", short: "Editorial", description: "Composição assimétrica de revista, discreta e elegante.", liveFilter: "contrast(1.06) saturate(.9) brightness(.99)" },
  { id: "filme35", name: "Filme 35", short: "Filme 35", description: "Borda de negativo 35 mm com numeração do frame.", liveFilter: "contrast(1.07) saturate(.88) sepia(.07) brightness(.99)" },
  { id: "cartao-garca", name: "Garça · 26.12", short: "Garça 26.12", description: "Moldura de lembrança da noite com localização e data.", liveFilter: "contrast(1.04) saturate(.94) sepia(.06) brightness(1.01)" },
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
      return { capturedAt, tellable: randomInt(2, 28), classified: randomInt(18, 87) };
    case "memoria":
      return { capturedAt, memoryId: randomInt(18, 999), xp: randomInt(180, 1818) };
    case "arquivo18":
      return { capturedAt, archiveId: `18-${String(randomInt(1, 9999)).padStart(4, "0")}` };
    case "flagra":
      return { capturedAt, flagraId: String(randomInt(1, 999)).padStart(3, "0") };
    case "filme35":
      return { capturedAt, frameNumber: String(randomInt(1, 36)).padStart(2, "0") };
    default:
      return { capturedAt };
  }
}

function formatLiveCapture(meta) {
  const date = new Date(meta?.capturedAt || Date.now());
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${min}`;
}

export function effectLiveOverlayHtml(effectId, meta = {}) {
  const effect = getEffect(effectId);
  const time = formatLiveCapture(meta);
  switch (effect.id) {
    case "arquivo18":
      return `<div class="live-overlay overlay-archive"><div class="archive-rule"></div><span>PEDRO / ARQUIVO 018</span><strong>${meta.archiveId || "18-0000"}</strong><small>26.12.2026 · GARÇA, SP</small><em>REGISTRO DA NOITE</em></div>`;
    case "flagra":
      return `<div class="live-overlay overlay-flagra"><span><b>●</b> ${time}</span><strong>FLAGRA ${meta.flagraId || "018"}</strong><small>PEDRO 18 · 26 DEZ 2026</small></div>`;
    case "familia-nao":
      return `<div class="live-overlay overlay-classified"><div class="classified-mark">CONFIDENCIAL</div><div class="redaction redaction-a"></div><div class="redaction redaction-b"></div><strong>NÃO ENVIAR AO GRUPO DA FAMÍLIA</strong><small>PEDRO 18 · DOCUMENTO DE ACESSO RESTRITO</small></div>`;
    case "memoria":
      return `<div class="live-overlay overlay-memory"><span>MEMÓRIA Nº ${meta.memoryId || "018"}</span><strong>26 · 12 · 2026</strong><small>+${meta.xp || 180} XP · PEDRO 18</small></div>`;
    case "raridade":
      return `<div class="live-overlay overlay-rarity ${meta.rarityCode === "X" ? "rarity-secret" : ""}"><span>RARIDADE DA FOTO</span><strong>${meta.rarity || "RARA"}</strong><small>PEDRO 18 · EDIÇÃO DA NOITE</small></div>`;
    case "detector-historias":
      return `<div class="live-overlay overlay-detector"><span>DETECTOR DE HISTÓRIAS</span><div><strong>${meta.tellable ?? 12}</strong><small>podem ser contadas</small></div><div><strong>${meta.classified ?? 43}</strong><small>melhor não contar</small></div><em>resultado totalmente científico</em></div>`;
    case "descartavel18":
      return `<div class="live-overlay overlay-disposable"><span>PEDRO 18</span><strong>26 12 '26</strong><small>${time}</small></div>`;
    case "primeira-noite":
      return `<div class="live-overlay overlay-first-night"><span>PEDRO</span><strong>XVIII</strong><small>PRIMEIRA NOITE · 26.12.2026 · GARÇA</small></div>`;
    case "editorial2612":
      return `<div class="live-overlay overlay-editorial"><span>26 / 12</span><strong>PEDRO XVIII</strong><small>GARÇA · SP</small><i>uma noite para guardar</i></div>`;
    case "filme35":
      return `<div class="live-overlay overlay-film35"><div class="film-edge film-top">PEDRO18 · 35MM · FRAME ${meta.frameNumber || "18"}</div><div class="film-edge film-bottom">26.12.2026 · GARÇA SP · ${time}</div></div>`;
    case "cartao-garca":
      return `<div class="live-overlay overlay-postcard"><span>GARÇA</span><strong>26.12.2026</strong><small>PEDRO · XVIII</small></div>`;
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
  drawVignette(ctx, width, height, 0.16);
  const u = Math.min(width, height);
  const pad = u * 0.05;
  const fine = Math.max(2, u * 0.0022);
  ctx.strokeStyle = "rgba(243,233,208,.82)";
  ctx.lineWidth = fine;
  ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
  ctx.beginPath();
  ctx.moveTo(pad, pad + u * 0.13); ctx.lineTo(width - pad, pad + u * 0.13);
  ctx.stroke();
  ctx.fillStyle = "rgba(243,233,208,.9)";
  ctx.font = `600 ${u * 0.022}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillText("PEDRO / ARQUIVO 018", pad * 1.18, pad + u * 0.05);
  ctx.fillStyle = "#f7eed9";
  ctx.font = `700 ${u * 0.053}px Georgia, serif`;
  ctx.fillText(meta?.archiveId || "18-0000", pad * 1.18, pad + u * 0.108);
  ctx.fillStyle = "rgba(247,238,217,.7)";
  ctx.font = `500 ${u * 0.019}px system-ui, sans-serif`;
  ctx.fillText("26.12.2026 · GARÇA, SP", width - pad - u * 0.31, pad + u * 0.051);
  ctx.save();
  ctx.translate(width - pad * 0.6, height * 0.5);
  ctx.rotate(Math.PI / 2);
  ctx.font = `600 ${u * 0.017}px system-ui, sans-serif`;
  ctx.letterSpacing = `${u * 0.004}px`;
  ctx.fillStyle = "rgba(247,238,217,.62)";
  ctx.fillText("REGISTRO DA NOITE · PEDRO XVIII", -u * 0.18, 0);
  ctx.restore();
}

function drawFlagra(ctx, width, height, meta) {
  adjustPixels(ctx, width, height, { contrast: 1.15, saturation: 0.92, warmth: -2, brightness: 6 });
  const u = Math.min(width, height);
  const flash = ctx.createRadialGradient(width * 0.54, height * 0.1, 0, width * 0.54, height * 0.1, u * 0.58);
  flash.addColorStop(0, "rgba(255,255,255,.28)");
  flash.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = flash; ctx.fillRect(0, 0, width, height);
  const pad = u * 0.045;
  const bottom = u * 0.135;
  ctx.fillStyle = "rgba(4,8,13,.72)";
  ctx.fillRect(0, height - bottom, width, bottom);
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${u * 0.044}px system-ui, sans-serif`;
  ctx.fillText(`FLAGRA ${meta?.flagraId || "018"}`, pad, height - bottom + u * 0.058);
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = `600 ${u * 0.019}px system-ui, sans-serif`;
  ctx.fillText(`PEDRO 18 · ${formatCapture(meta).date} · ${formatCapture(meta).time}`, pad, height - bottom + u * 0.096);
  ctx.fillStyle = "#ef4b4b";
  ctx.beginPath(); ctx.arc(width - pad, height - bottom + u * 0.052, u * 0.009, 0, Math.PI * 2); ctx.fill();
  const bracket = u * 0.065;
  ctx.strokeStyle = "rgba(255,255,255,.68)";
  ctx.lineWidth = Math.max(2, u * 0.0028);
  [[pad,pad,1,1],[width-pad,pad,-1,1]].forEach(([x,y,sx,sy]) => { ctx.beginPath(); ctx.moveTo(x + bracket*sx,y); ctx.lineTo(x,y); ctx.lineTo(x,y+bracket*sy); ctx.stroke(); });
}

function drawFamilyNo(ctx, width, height) {
  adjustPixels(ctx, width, height, { contrast: 1.13, saturation: 0.58, warmth: -1, brightness: -3 });
  drawVignette(ctx, width, height, 0.3);
  const u = Math.min(width, height);
  const pad = u * 0.05;
  ctx.strokeStyle = "rgba(239,232,218,.55)";
  ctx.lineWidth = Math.max(2, u * 0.002);
  ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
  ctx.save();
  ctx.translate(width * 0.5, height * 0.16);
  ctx.rotate(-0.035);
  ctx.strokeStyle = "rgba(180,37,47,.92)";
  ctx.lineWidth = Math.max(3, u * 0.0045);
  ctx.strokeRect(-u * 0.29, -u * 0.055, u * 0.58, u * 0.11);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,229,221,.96)";
  ctx.font = `900 ${u * 0.043}px ui-monospace, monospace`;
  ctx.fillText("CONFIDENCIAL", 0, 0);
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,.88)";
  ctx.fillRect(pad * 1.25, height - pad - u * 0.18, width * 0.43, u * 0.027);
  ctx.fillRect(width * 0.32, height - pad - u * 0.13, width * 0.5, u * 0.027);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,.86)";
  ctx.font = `700 ${u * 0.023}px system-ui, sans-serif`;
  ctx.fillText("NÃO ENVIAR AO GRUPO DA FAMÍLIA", pad * 1.25, height - pad - u * 0.055);
  ctx.fillStyle = "rgba(255,255,255,.5)";
  ctx.font = `600 ${u * 0.015}px system-ui, sans-serif`;
  ctx.fillText("PEDRO 18 · ACESSO RESTRITO", pad * 1.25, height - pad - u * 0.02);
}

function drawMemory(ctx, width, height, meta) {
  adjustPixels(ctx, width, height, { contrast: 1.08, saturation: 1.04, warmth: -3, brightness: -2 });
  drawVignette(ctx, width, height, 0.14);
  const u = Math.min(width, height);
  const pad = u * 0.05;
  const y = height - pad - u * 0.17;
  ctx.fillStyle = "rgba(5,14,28,.77)";
  ctx.fillRect(pad, y, width - pad * 2, u * 0.17);
  ctx.strokeStyle = "rgba(216,179,106,.72)";
  ctx.lineWidth = Math.max(2, u * 0.002);
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(width - pad, y); ctx.stroke();
  ctx.fillStyle = "#d8b36a";
  ctx.font = `700 ${u * 0.019}px system-ui, sans-serif`;
  ctx.fillText(`MEMÓRIA Nº ${meta?.memoryId || "018"}`, pad * 1.25, y + u * 0.043);
  ctx.fillStyle = "#f8f0df";
  ctx.font = `500 ${u * 0.05}px Georgia, serif`;
  ctx.fillText("26 · 12 · 2026", pad * 1.25, y + u * 0.103);
  ctx.fillStyle = "rgba(248,240,223,.58)";
  ctx.font = `600 ${u * 0.017}px system-ui, sans-serif`;
  ctx.fillText(`+${meta?.xp || 180} XP · PEDRO XVIII`, pad * 1.25, y + u * 0.143);
}

function drawRarity(ctx, width, height, meta) {
  adjustPixels(ctx, width, height, { contrast: 1.07, saturation: 1.13, warmth: 3, brightness: 0 });
  drawVignette(ctx, width, height, 0.13);
  const u = Math.min(width, height);
  const pad = u * 0.052;
  const rarity = String(meta?.rarity || "RARA");
  const secret = meta?.rarityCode === "X";
  ctx.strokeStyle = secret ? "rgba(209,70,78,.92)" : "rgba(216,179,106,.78)";
  ctx.lineWidth = Math.max(2, u * 0.0024);
  ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
  ctx.textAlign = "center";
  ctx.fillStyle = secret ? "#ffd3d6" : "#e7c77f";
  ctx.font = `700 ${u * 0.017}px system-ui, sans-serif`;
  ctx.fillText("RARIDADE DA FOTO · PEDRO 18", width / 2, pad + u * 0.038);
  ctx.fillStyle = "rgba(3,10,18,.64)";
  ctx.fillRect(width * 0.18, height - pad - u * 0.135, width * 0.64, u * 0.135);
  ctx.fillStyle = "#fff8e8";
  ctx.font = `500 ${u * (secret ? 0.038 : 0.06)}px Georgia, serif`;
  ctx.fillText(rarity, width / 2, height - pad - u * 0.064);
  ctx.fillStyle = secret ? "rgba(255,211,214,.75)" : "rgba(231,199,127,.75)";
  ctx.font = `600 ${u * 0.016}px system-ui, sans-serif`;
  ctx.fillText("EDIÇÃO DA NOITE · 26.12.2026", width / 2, height - pad - u * 0.026);
  ctx.textAlign = "left";
}

function drawDetector(ctx, width, height, meta) {
  adjustPixels(ctx, width, height, { contrast: 1.05, saturation: 1.03, warmth: 4, brightness: -1 });
  drawVignette(ctx, width, height, 0.12);
  const u = Math.min(width, height);
  const pad = u * 0.05;
  const y = height - pad - u * 0.205;
  ctx.fillStyle = "rgba(3,17,22,.78)";
  ctx.fillRect(pad, y, width - pad * 2, u * 0.205);
  ctx.strokeStyle = "rgba(82,224,185,.7)";
  ctx.lineWidth = Math.max(2, u * 0.002);
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(width - pad, y); ctx.stroke();
  ctx.fillStyle = "#65dfbf";
  ctx.font = `700 ${u * 0.018}px ui-monospace, monospace`;
  ctx.fillText("DETECTOR DE HISTÓRIAS", pad * 1.25, y + u * 0.038);
  ctx.fillStyle = "#fff";
  ctx.font = `500 ${u * 0.052}px Georgia, serif`;
  ctx.fillText(String(meta?.tellable ?? 12), pad * 1.25, y + u * 0.112);
  ctx.fillText(String(meta?.classified ?? 43), width * 0.54, y + u * 0.112);
  ctx.fillStyle = "rgba(255,255,255,.64)";
  ctx.font = `600 ${u * 0.016}px system-ui, sans-serif`;
  ctx.fillText("PODEM SER CONTADAS", pad * 1.25, y + u * 0.146);
  ctx.fillText("MELHOR NÃO CONTAR", width * 0.54, y + u * 0.146);
  ctx.fillStyle = "rgba(101,223,191,.55)";
  ctx.font = `500 ${u * 0.014}px system-ui, sans-serif`;
  ctx.fillText("resultado totalmente científico · pedro 18", pad * 1.25, y + u * 0.184);
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
  drawVignette(ctx, width, height, 0.25);
  const u = Math.min(width, height);
  const pad = u * 0.052;
  ctx.strokeStyle = "rgba(216,179,106,.7)";
  ctx.lineWidth = Math.max(2, u * 0.002);
  ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(width - pad, pad); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pad, height - pad); ctx.lineTo(width - pad, height - pad); ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#f0ddb0";
  ctx.font = `500 ${u * 0.03}px Georgia, serif`;
  ctx.fillText("PEDRO", width / 2, height - pad - u * 0.105);
  ctx.font = `500 ${u * 0.066}px Georgia, serif`;
  ctx.fillText("XVIII", width / 2, height - pad - u * 0.045);
  ctx.fillStyle = "rgba(240,221,176,.62)";
  ctx.font = `600 ${u * 0.015}px system-ui, sans-serif`;
  ctx.fillText("PRIMEIRA NOITE · 26.12.2026 · GARÇA", width / 2, height - pad + u * 0.032);
  ctx.textAlign = "left";
}

function drawEditorial2612(ctx, width, height) {
  adjustPixels(ctx, width, height, { contrast: 1.06, saturation: 0.9, warmth: 2, brightness: -1 });
  const u = Math.min(width, height);
  const pad = u * 0.05;
  ctx.fillStyle = "rgba(5,13,24,.68)";
  ctx.fillRect(pad, pad, u * 0.19, u * 0.19);
  ctx.fillStyle = "#f4ecda";
  ctx.font = `500 ${u * 0.058}px Georgia, serif`;
  ctx.fillText("26", pad * 1.25, pad + u * 0.073);
  ctx.font = `500 ${u * 0.031}px Georgia, serif`;
  ctx.fillText("/ 12", pad * 1.25, pad + u * 0.122);
  ctx.fillStyle = "rgba(244,236,218,.7)";
  ctx.font = `600 ${u * 0.015}px system-ui, sans-serif`;
  ctx.fillText("PEDRO XVIII", pad * 1.25, pad + u * 0.16);
  ctx.save();
  ctx.translate(width - pad * 0.7, height * 0.68);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "rgba(244,236,218,.74)";
  ctx.font = `500 ${u * 0.017}px system-ui, sans-serif`;
  ctx.fillText("GARÇA · SP · UMA NOITE PARA GUARDAR", 0, 0);
  ctx.restore();
  ctx.strokeStyle = "rgba(244,236,218,.42)";
  ctx.lineWidth = Math.max(2, u * 0.0018);
  ctx.beginPath(); ctx.moveTo(pad, height - pad); ctx.lineTo(width * 0.46, height - pad); ctx.stroke();
}

function drawFilm35(ctx, width, height, meta) {
  adjustPixels(ctx, width, height, { contrast: 1.07, saturation: 0.88, warmth: 5, brightness: 0 });
  drawNoise(ctx, width, height, 0.045);
  const u = Math.min(width, height);
  const edge = u * 0.072;
  ctx.fillStyle = "rgba(8,8,8,.94)";
  ctx.fillRect(0, 0, width, edge);
  ctx.fillRect(0, height - edge, width, edge);
  ctx.fillStyle = "rgba(246,226,176,.86)";
  ctx.font = `600 ${u * 0.015}px ui-monospace, monospace`;
  ctx.fillText(`PEDRO18  ·  35MM  ·  FRAME ${meta?.frameNumber || "18"}`, edge * 0.55, edge * 0.62);
  const stamp = formatCapture(meta);
  ctx.fillText(`26.12.2026  ·  GARÇA SP  ·  ${stamp.time}`, edge * 0.55, height - edge * 0.38);
  const perforationW = u * 0.022;
  const perforationH = u * 0.013;
  ctx.fillStyle = "rgba(246,236,210,.88)";
  const count = Math.max(6, Math.floor(width / (perforationW * 2.8)));
  for (let i = 0; i < count; i++) {
    const x = edge * 0.45 + i * ((width - edge * 0.9) / count);
    ctx.fillRect(x, edge * 0.12, perforationW, perforationH);
    ctx.fillRect(x, height - edge * 0.12 - perforationH, perforationW, perforationH);
  }
}

function drawPostcard(ctx, width, height) {
  adjustPixels(ctx, width, height, { contrast: 1.04, saturation: 0.94, warmth: 6, brightness: 2 });
  drawVignette(ctx, width, height, 0.08);
  const u = Math.min(width, height);
  const pad = u * 0.05;
  ctx.strokeStyle = "rgba(250,242,222,.82)";
  ctx.lineWidth = Math.max(2, u * 0.002);
  ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
  ctx.fillStyle = "rgba(4,14,27,.52)";
  ctx.fillRect(pad, height - pad - u * 0.14, width - pad * 2, u * 0.14);
  ctx.fillStyle = "#f7edd7";
  ctx.font = `500 ${u * 0.05}px Georgia, serif`;
  ctx.fillText("Garça", pad * 1.3, height - pad - u * 0.075);
  ctx.fillStyle = "rgba(247,237,215,.72)";
  ctx.font = `600 ${u * 0.018}px system-ui, sans-serif`;
  ctx.fillText("26.12.2026 · PEDRO XVIII", pad * 1.3, height - pad - u * 0.035);
  ctx.textAlign = "right";
  ctx.font = `500 italic ${u * 0.017}px Georgia, serif`;
  ctx.fillText("uma noite para lembrar", width - pad * 1.3, height - pad - u * 0.052);
  ctx.textAlign = "left";
}

function drawSimpleColor(ctx, width, height, kind) {
  const presets = {
    dourado: { contrast: 1.04, saturation: 0.96, warmth: 12, brightness: -1, vignette: 0.09 },
    quente: { contrast: 1.03, saturation: 1.05, warmth: 16, brightness: 2 },
    ambar: { contrast: 1.05, saturation: 1.04, warmth: 24, brightness: 1, vignette: 0.06 },
    champagne: { contrast: 0.98, saturation: 0.86, warmth: 10, brightness: 8, vignette: 0.04 },
    rose: { contrast: 1.02, saturation: 0.96, warmth: 10, brightness: 2, redLift: 5 },
    frio: { contrast: 1.04, saturation: 0.98, warmth: -15, brightness: -1 },
    "blue-hour": { contrast: 1.09, saturation: 0.82, warmth: -24, brightness: -4, vignette: 0.12 },
    noturno: { contrast: 1.16, saturation: 0.78, warmth: -7, brightness: -10, vignette: 0.2 },
  };
  const preset = presets[kind];
  if (!preset) return;
  adjustPixels(ctx, width, height, preset);
  if (preset.redLift) {
    const veil = ctx.createLinearGradient(0, 0, width, height);
    veil.addColorStop(0, `rgba(145,54,78,${preset.redLift / 100})`);
    veil.addColorStop(1, "rgba(145,54,78,0)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, width, height);
  }
  if (preset.vignette) drawVignette(ctx, width, height, preset.vignette);
}

function applyEffectDrawing(ctx, width, height, effectId, meta) {
  switch (effectId) {
    case "dourado": drawSimpleColor(ctx, width, height, "dourado"); break;
    case "quente": drawSimpleColor(ctx, width, height, "quente"); break;
    case "ambar": drawSimpleColor(ctx, width, height, "ambar"); break;
    case "champagne": drawSimpleColor(ctx, width, height, "champagne"); break;
    case "rose": drawSimpleColor(ctx, width, height, "rose"); break;
    case "frio": drawSimpleColor(ctx, width, height, "frio"); break;
    case "blue-hour": drawSimpleColor(ctx, width, height, "blue-hour"); break;
    case "noturno": drawSimpleColor(ctx, width, height, "noturno"); break;
    case "arquivo18": drawArchive(ctx, width, height, meta); break;
    case "flagra": drawFlagra(ctx, width, height, meta); break;
    case "familia-nao": drawFamilyNo(ctx, width, height, meta); break;
    case "memoria": drawMemory(ctx, width, height, meta); break;
    case "raridade": drawRarity(ctx, width, height, meta); break;
    case "detector-historias": drawDetector(ctx, width, height, meta); break;
    case "descartavel18": drawDisposable(ctx, width, height, meta); break;
    case "primeira-noite": drawFirstNight(ctx, width, height, meta); break;
    case "editorial2612": drawEditorial2612(ctx, width, height, meta); break;
    case "filme35": drawFilm35(ctx, width, height, meta); break;
    case "cartao-garca": drawPostcard(ctx, width, height, meta); break;
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
