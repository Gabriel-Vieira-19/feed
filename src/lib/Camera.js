import { ColorPipeline, colorPresets } from "./ColorPipeline.js";
import { filtrosConfig } from "./filtrosConfig.js";

const SLIDERS = [
  { key: "warmth", label: "Temperatura", step: 0.01, limit: 0.8 },
  { key: "contrast", label: "Contraste", step: 0.01, limit: 0.45 },
  { key: "brightness", label: "Brilho", step: 0.01, limit: 0.25 },
];

function stopStream(stream) {
  stream?.getTracks().forEach(track => track.stop());
}

export async function compositePhoto(canvas, color, overlay, width, height, mirrored) {
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (mirrored) context.setTransform(-1, 0, 0, 1, width, 0);
  context.drawImage(color, 0, 0, width, height);
  if (overlay) context.drawImage(overlay, 0, 0, width, height);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.97));
  if (!blob) throw new Error("Não foi possível gerar a foto. Tente novamente.");
  const timestamp = Date.now();
  return new File([blob], `foto-${timestamp}.jpg`, { type: blob.type, lastModified: timestamp });
}

export class Camera {
  constructor(card, { onCapture, onClose, onError }) {
    this.onCapture = onCapture;
    this.onError = onError;
    this.preset = colorPresets[0];
    this.sliders = { warmth: 0, contrast: 0, brightness: 0 };
    card.innerHTML = `
      <div class="camera-stage">
        <video playsinline muted autoplay aria-hidden="true" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"></video>
        <div data-frame style="display:grid;width:100%">
          <canvas aria-label="Prévia da câmera" style="grid-area:1/1;width:100%;height:auto"></canvas>
          <canvas aria-hidden="true" style="grid-area:1/1;width:100%;height:auto;pointer-events:none" hidden></canvas>
        </div>
      </div>
      <div class="capture-actions">
        <button data-shutter class="btn btn-primary" type="button" disabled>TIRAR FOTO</button>
        <button data-switch class="btn btn-secondary" type="button" disabled>VIRAR CÂMERA</button>
        <button data-close class="btn btn-secondary" type="button">FECHAR CÂMERA</button>
        <p class="hint" data-status role="status">Abrindo câmera…</p>
        <div class="field">
          <label for="camera-preset">Filtro de cor</label>
          <select id="camera-preset" class="text-input"></select>
        </div>
        ${SLIDERS.map(({ key, label, step, limit }) => `
          <div class="field">
            <label for="camera-${key}">${label}</label>
            <input id="camera-${key}" type="range" value="0" min="${-limit}" max="${limit}" step="${step}" style="width:100%;accent-color:var(--gold)">
          </div>`).join("")}
        <div class="field">
          <label for="camera-effect">Efeito facial</label>
          <select id="camera-effect" class="text-input">
            <option value="">Sem efeito</option>
          </select>
          <p class="hint" data-effects-status role="status" hidden></p>
        </div>
      </div>`;
    this.frame = card.querySelector("[data-frame]");
    [this.colorCanvas, this.overlay] = this.frame.querySelectorAll("canvas");
    this.video = card.querySelector("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
    this.shutter = card.querySelector("[data-shutter]");
    this.flipButton = card.querySelector("[data-switch]");
    this.status = card.querySelector("[data-status]");
    this.effectStatus = card.querySelector("[data-effects-status]");
    this.effectSelect = card.querySelector("#camera-effect");
    this.pipeline = new ColorPipeline(this.colorCanvas);

    const presetSelect = card.querySelector("#camera-preset");
    colorPresets.forEach((preset, i) => presetSelect.add(new Option(preset.label, i)));
    filtrosConfig.forEach(effect => this.effectSelect.add(new Option(effect.label, effect.id)));
    presetSelect.onchange = () => {
      this.preset = colorPresets[presetSelect.selectedIndex];
      this.redraw();
    };
    for (const { key } of SLIDERS) {
      const input = card.querySelector(`#camera-${key}`);
      input.oninput = () => {
        this.sliders[key] = input.valueAsNumber;
        this.redraw();
      };
    }
    this.effectSelect.onchange = () => this.selectEffect(this.effectSelect.value);
    this.shutter.onclick = () => this.capture();
    this.flipButton.onclick = () => this.switchCamera();
    card.querySelector("[data-close]").onclick = onClose;
  }

  async open(facing = "environment") {
    this.ready = false;
    this.shutter.disabled = this.flipButton.disabled = true;
    this.status.hidden = false;
    this.status.textContent = "Abrindo câmera…";
    this.stopVideo();
    this.effects?.reset();
    this.overlay.hidden = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("A câmera requer um navegador compatível e uma conexão HTTPS.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: facing,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 60, max: 60 },
      },
    });
    if (this.disposed) return stopStream(stream);
    this.stream = stream;
    const track = stream.getVideoTracks()[0];
    this.facing = track.getSettings().facingMode || facing;
    this.video.srcObject = stream;
    try {
      await this.video.play();
    } catch (error) {
      if (this.disposed) return;
      this.stopVideo();
      throw error;
    }
    if (!this.disposed) this.scheduleFrame();
  }

  async switchCamera() {
    const previous = this.facing;
    try {
      await this.open(previous === "user" ? "environment" : "user");
      if (!this.disposed && this.facing === previous) this.onError("Outra câmera não está disponível.");
    } catch {
      if (this.disposed) return;
      this.onError("Não foi possível alternar a câmera.");
      try {
        await this.open(previous);
      } catch {
        if (!this.disposed) {
          this.status.textContent = "A câmera ficou indisponível. Feche e abra novamente.";
        }
      }
    }
  }

  async selectEffect(id) {
    const effect = filtrosConfig.find(entry => entry.id === id);
    this.overlay.hidden = true;
    this.effects?.reset();
    this.effectStatus.hidden = !effect;
    if (!effect) {
      await this.effects?.loadEffect(null);
      return;
    }
    this.effectStatus.textContent = "Carregando efeito facial…";
    try {
      this.effectEngine ??= import("./FaceFilterEngine.js").then(async ({ FaceFilterEngine }) => {
        if (this.disposed) return null;
        this.effects = new FaceFilterEngine(this.overlay);
        await this.effects.loadTracker();
        return this.effects;
      });
      const engine = await this.effectEngine;
      if (this.disposed || this.effectSelect.value !== id) return;
      await engine.loadEffect(effect);
      if (!this.disposed && this.effectSelect.value === id) this.effectStatus.hidden = true;
    } catch {
      if (!this.disposed && this.effectSelect.value === id) this.disableEffect();
    }
  }

  disableEffect() {
    this.effects?.reset();
    this.overlay.hidden = true;
    this.effectSelect.value = "";
    this.effectStatus.hidden = false;
    this.effectStatus.textContent = "Efeito facial indisponível. Os filtros de cor continuam funcionando.";
    this.effects?.loadEffect(null);
  }

  scheduleFrame() {
    if (this.video.requestVideoFrameCallback) {
      this.frameCallback = this.video.requestVideoFrameCallback((now, metadata) => {
        this.renderFrame(now, metadata.mediaTime);
      });
    } else {
      this.frameCallback = requestAnimationFrame(now => this.renderFrame(now, this.video.currentTime));
    }
  }

  renderFrame(now, frame) {
    this.frameCallback = undefined;
    if (this.disposed || !this.stream) return;
    if (this.video.readyState >= 2 && this.video.videoWidth &&
        (frame !== this.lastFrame || this.video.videoWidth !== this.videoWidth || this.video.videoHeight !== this.videoHeight)) {
      this.lastFrame = frame;
      this.videoWidth = this.video.videoWidth;
      this.videoHeight = this.video.videoHeight;
      this.redraw(now);
      if (!this.ready) {
        this.ready = true;
        this.shutter.disabled = this.flipButton.disabled = false;
        this.status.hidden = true;
      }
    }
    this.scheduleFrame();
  }

  draw(width, height, now, force = false) {
    this.pipeline.render(this.video, width, height, this.preset, this.sliders);
    if (this.effects && this.effectSelect.value) {
      try {
        this.effects.track(this.video, now, force ? this.video.currentTime : this.lastFrame, force);
        if (this.effects.hasEffect) {
          this.effects.render(width, height);
          this.overlay.hidden = false;
          return true;
        }
      } catch {
        this.disableEffect();
      }
    }
    this.overlay.hidden = true;
    return false;
  }

  redraw(now = performance.now()) {
    if (this.disposed || this.video.readyState < 2 || !this.videoWidth || !this.videoHeight) return;
    const { videoWidth: width, videoHeight: height } = this;
    const scale = Math.min(1, 960 / Math.max(width, height));
    this.frame.style.width = `min(100%, ${68 * width / height}svh)`;
    this.frame.style.transform = this.facing === "user" ? "scaleX(-1)" : "";
    this.draw(Math.round(scale * width), Math.round(scale * height), now);
  }

  async capture() {
    if (!this.ready || this.shutter.disabled) return;
    this.shutter.disabled = this.flipButton.disabled = true;
    let file;
    try {
      const { videoWidth: width, videoHeight: height } = this.video;
      const useOverlay = this.draw(width, height, performance.now(), true);
      const photo = compositePhoto(document.createElement("canvas"), this.colorCanvas,
        useOverlay ? this.overlay : null, width, height, this.facing === "user");
      this.redraw();
      file = await photo;
    } catch (error) {
      if (!this.disposed) {
        this.shutter.disabled = this.flipButton.disabled = false;
        this.onError(error.message);
      }
      return;
    }
    if (!this.disposed && await this.onCapture(file) === false) {
      this.shutter.disabled = this.flipButton.disabled = false;
    }
  }

  stopVideo() {
    if (this.frameCallback !== undefined) {
      if (this.video.cancelVideoFrameCallback) this.video.cancelVideoFrameCallback(this.frameCallback);
      else cancelAnimationFrame(this.frameCallback);
      this.frameCallback = undefined;
    }
    stopStream(this.stream);
    this.stream = null;
    this.video.srcObject = null;
    this.lastFrame = this.videoWidth = this.videoHeight = undefined;
  }

  dispose() {
    this.disposed = true;
    this.stopVideo();
    this.effects?.dispose();
    this.pipeline.dispose();
  }
}
