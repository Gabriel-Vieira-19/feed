import "./styles.css";
import { config, assertPublicConfig } from "./config.js";
import {
  ensureAnonymousSession,
  fetchFeed,
  getOwnProfile,
  getSupabase,
  saveProfile,
  setLike,
  subscribeToPhotoChanges,
} from "./lib/supabase.js";
import { getOriginalViewUrl, uploadPhotoToDrive } from "./lib/drive.js";
import {
  downloadBlob,
  escapeHtml,
  formatBytes,
  formatRelativeTime,
  normalizeName,
  safeFilename,
} from "./lib/utils.js";

const app = document.querySelector("#app");

const icons = {
  feed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8.5 5.5 10 3.8h4L15.5 5.5H19A2 2 0 0 1 21 7.5v9A2 2 0 0 1 19 18.5H5A2 2 0 0 1 3 16.5v-9A2 2 0 0 1 5 5.5Z"/><circle cx="12" cy="12" r="3.3"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9" r="1.5"/><path d="m5 18 5-5 3 3 2-2 4 4"/></svg>`,
  heart: `<svg viewBox="0 0 24 24"><path d="M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.1a5 5 0 0 0 0-7.1Z"/></svg>`,
};

const state = {
  session: null,
  profile: null,
  view: "feed",
  selectedFile: null,
  selectedUrl: null,
  feed: [],
  liked: new Set(),
  feedDone: false,
  feedLoading: false,
  myPhotos: [],
  myLiked: new Set(),
  realtimeCleanup: null,
  refreshTimer: null,
  uploading: false,
};

function renderConfigError(missing) {
  app.innerHTML = `
    <div class="screen-center">
      <section class="config-card">
        <div class="brand-kicker">CONFIGURAÇÃO</div>
        <h1 class="brand-title">Aplicativo ainda não configurado</h1>
        <p class="brand-subtitle">Defina as variáveis de ambiente do Vercel antes de publicar.</p>
        <div class="admin-status"><strong>Faltando:</strong><br>${missing.map(escapeHtml).join("<br>")}</div>
      </section>
    </div>`;
}

function getStoredName() {
  return normalizeName(localStorage.getItem("party_display_name") || "");
}
function storeName(name) { localStorage.setItem("party_display_name", normalizeName(name)); }

function renderOnboarding(prefill = "") {
  app.innerHTML = `
    <div class="screen-center">
      <section class="onboarding-card">
        <div class="brand-kicker">${escapeHtml(config.eventTitle)}</div>
        <h1 class="brand-title">Momentos da festa</h1>
        <p class="brand-subtitle">Tire fotos, publique no mural e acompanhe os registros de todo mundo durante a festa.</p>
        <form id="onboarding-form">
          <div class="field">
            <label for="display-name">COMO PODEMOS CHAMAR VOCÊ?</label>
            <input id="display-name" class="text-input" maxlength="${config.maxDisplayNameLength}" autocomplete="name" placeholder="Seu nome" value="${escapeHtml(prefill)}" />
            <div id="name-error" class="error-text"></div>
          </div>
          <button class="btn btn-primary btn-block" type="submit">ENTRAR NA FESTA</button>
        </form>
      </section>
    </div>`;

  document.querySelector("#onboarding-form").addEventListener("submit", async event => {
    event.preventDefault();
    const input = document.querySelector("#display-name");
    const error = document.querySelector("#name-error");
    const name = normalizeName(input.value);
    if (name.length < 2) {
      error.textContent = "Digite um nome válido.";
      input.focus();
      return;
    }
    if (name.length > config.maxDisplayNameLength) {
      error.textContent = `Use no máximo ${config.maxDisplayNameLength} caracteres.`;
      return;
    }
    const button = event.submitter;
    button.disabled = true;
    button.textContent = "ENTRANDO…";
    try {
      state.session = await ensureAnonymousSession(name);
      state.profile = { id: state.session.user.id, display_name: name };
      storeName(name);
      renderApp();
      await startDataLayer();
    } catch (err) {
      error.textContent = err.message || "Não foi possível entrar agora.";
      button.disabled = false;
      button.textContent = "ENTRAR NA FESTA";
    }
  });
}

function renderApp() {
  app.innerHTML = `
    <div class="app">
      <header class="topbar">
        <div class="topbar-title">
          <strong>${escapeHtml(config.eventTitle)}</strong>
          <span>${escapeHtml(config.eventSubtitle)}</span>
        </div>
        <button id="profile-pill" class="profile-pill" type="button" aria-label="Editar nome">
          <i class="profile-dot"></i><span>${escapeHtml(state.profile?.display_name || "Convidado")}</span>
        </button>
      </header>

      <main class="main-content">
        <section id="view-feed" class="view active" data-view="feed">
          <div class="section-heading"><div><h2>Feed da festa</h2><p>Os momentos aparecem aqui em tempo real.</p></div></div>
          <div id="feed" class="feed"></div>
          <button id="load-more" class="btn btn-secondary btn-block load-more" type="button" hidden>CARREGAR MAIS</button>
        </section>

        <section id="view-camera" class="view" data-view="camera">
          <div class="section-heading"><div><h2>Tirar uma foto</h2><p>Sem filtros. A foto original será preservada.</p></div></div>
          <div class="capture-wrap"><div id="camera-card" class="camera-card"></div></div>
          <input id="camera-input" class="file-input" type="file" accept="image/*" capture="environment" />
          <input id="gallery-input" class="file-input" type="file" accept="image/*" />
        </section>

        <section id="view-mine" class="view" data-view="mine">
          <div class="section-heading"><div><h2>Meus cliques</h2><p>As fotos que você publicou neste aparelho.</p></div></div>
          <div id="mine-feed" class="feed"></div>
        </section>
      </main>

      <nav class="bottom-nav" aria-label="Navegação principal">
        <button class="nav-item active" type="button" data-nav="feed">${icons.feed}<span>Feed</span></button>
        <button class="nav-item nav-camera" type="button" data-nav="camera">${icons.camera}<span>Câmera</span></button>
        <button class="nav-item" type="button" data-nav="mine">${icons.user}<span>Meus cliques</span></button>
      </nav>
      <div id="toasts" class="toast-stack"></div>
      <div id="modal-root"></div>
    </div>`;

  bindAppEvents();
  renderCameraEmpty();
  renderFeed();
  renderMine();
}

function bindAppEvents() {
  document.querySelectorAll("[data-nav]").forEach(button => {
    button.addEventListener("click", () => switchView(button.dataset.nav));
  });
  document.querySelector("#camera-input").addEventListener("change", handleFileInput);
  document.querySelector("#gallery-input").addEventListener("change", handleFileInput);
  document.querySelector("#load-more").addEventListener("click", () => loadFeedPage(false));
  document.querySelector("#profile-pill").addEventListener("click", editDisplayName);
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  document.querySelectorAll("[data-nav]").forEach(el => el.classList.toggle("active", el.dataset.nav === view));
  window.scrollTo({ top: 0, behavior: "auto" });
  if (view === "mine") loadMine();
}

function renderCameraEmpty() {
  const card = document.querySelector("#camera-card");
  if (!card) return;
  card.innerHTML = `
    <div class="camera-stage">
      <div class="camera-placeholder">
        <div class="camera-icon">${icons.camera}</div>
        <h3>Registre esse momento</h3>
        <p>Use a câmera normal do celular ou escolha uma foto que já esteja na galeria.</p>
      </div>
    </div>
    <div class="capture-actions">
      <button id="take-photo" class="btn btn-primary" type="button">ABRIR CÂMERA</button>
      <button id="choose-gallery" class="btn btn-secondary" type="button">ESCOLHER DA GALERIA</button>
      <button id="go-feed" class="btn btn-secondary" type="button">VER FEED</button>
    </div>`;
  document.querySelector("#take-photo").onclick = () => document.querySelector("#camera-input").click();
  document.querySelector("#choose-gallery").onclick = () => document.querySelector("#gallery-input").click();
  document.querySelector("#go-feed").onclick = () => switchView("feed");
}

function handleFileInput(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("Escolha uma foto.", "error");
  if (file.size > config.maxPhotoBytes) return toast("Essa foto ultrapassa 30 MB.", "error");
  clearSelectedFile();
  state.selectedFile = file;
  state.selectedUrl = URL.createObjectURL(file);
  renderPhotoPreview();
}

function renderPhotoPreview() {
  const card = document.querySelector("#camera-card");
  if (!card || !state.selectedFile) return;
  card.innerHTML = `
    <div class="preview-stage">
      <img src="${state.selectedUrl}" alt="Prévia da foto selecionada" />
      <div class="preview-badge">${escapeHtml(formatBytes(state.selectedFile.size))}</div>
      <div id="upload-panel" hidden></div>
    </div>
    <div class="preview-actions">
      <button id="publish-photo" class="btn btn-primary btn-block" type="button">PUBLICAR NA FESTA</button>
      <div class="preview-actions-row">
        <button id="save-photo" class="btn btn-secondary" type="button">SALVAR NO CELULAR</button>
        <button id="retake-photo" class="btn btn-secondary" type="button">ESCOLHER OUTRA</button>
      </div>
    </div>`;
  document.querySelector("#publish-photo").onclick = publishSelectedPhoto;
  document.querySelector("#save-photo").onclick = () => {
    downloadBlob(state.selectedFile, safeFilename(state.selectedFile.name || `foto-${Date.now()}.jpg`));
    toast("Foto enviada para os downloads do aparelho.", "success");
  };
  document.querySelector("#retake-photo").onclick = () => {
    clearSelectedFile();
    renderCameraEmpty();
  };
}

async function publishSelectedPhoto() {
  if (!state.selectedFile || state.uploading) return;
  const panel = document.querySelector("#upload-panel");
  const publishButton = document.querySelector("#publish-photo");
  state.uploading = true;
  if (publishButton) publishButton.disabled = true;
  panel.hidden = false;
  panel.className = "upload-panel";
  panel.innerHTML = `<div class="upload-card"><h3>Preparando…</h3><p>Não feche esta tela.</p><div class="progress-track"><div class="progress-bar"></div></div></div>`;
  const title = panel.querySelector("h3");
  const bar = panel.querySelector(".progress-bar");
  try {
    const photo = await uploadPhotoToDrive(state.selectedFile, state.profile.display_name, progress => {
      title.textContent = progress.label;
      bar.style.width = `${Math.max(2, Math.min(100, progress.value * 100))}%`;
    });
    toast("Foto publicada no feed!", "success");
    clearSelectedFile();
    renderCameraEmpty();
    state.feed = [photo, ...state.feed.filter(item => item.id !== photo.id)];
    state.myPhotos = [photo, ...state.myPhotos.filter(item => item.id !== photo.id)];
    renderFeed();
    renderMine();
    switchView("feed");
  } catch (err) {
    panel.hidden = true;
    if (publishButton) publishButton.disabled = false;
    toast(err.message || "Não foi possível publicar a foto.", "error", 5000);
  } finally {
    state.uploading = false;
  }
}

function clearSelectedFile() {
  if (state.selectedUrl) URL.revokeObjectURL(state.selectedUrl);
  state.selectedUrl = null;
  state.selectedFile = null;
}

async function startDataLayer() {
  await loadFeedPage(true);
  state.realtimeCleanup?.();
  state.realtimeCleanup = subscribeToPhotoChanges(payload => {
    const next = payload.new;
    if (!next?.id) return;
    const index = state.feed.findIndex(photo => photo.id === next.id);
    if (payload.eventType === "INSERT" && next.published) {
      if (index < 0) state.feed.unshift(next);
    } else if (payload.eventType === "UPDATE" && index >= 0) {
      state.feed[index] = { ...state.feed[index], ...next };
    } else if (payload.eventType === "DELETE" && index >= 0) {
      state.feed.splice(index, 1);
    }
    renderFeed();
    if (state.view === "mine") loadMine();
  });

  clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(() => {
    if (!document.hidden && state.view === "feed") refreshFeedHead();
  }, config.refreshIntervalMs);
}

async function refreshFeedHead() {
  if (state.feedLoading) return;
  try {
    const { photos, liked } = await fetchFeed({ limit: config.feedPageSize });
    const headIds = new Set(photos.map(photo => photo.id));
    const tail = state.feed.filter(photo => !headIds.has(photo.id));
    state.feed = [...photos, ...tail];
    for (const photo of photos) {
      if (liked.has(photo.id)) state.liked.add(photo.id);
      else state.liked.delete(photo.id);
    }
    renderFeed();
  } catch {
    // O Realtime já cobre novas fotos; esta atualização é apenas fallback.
  }
}

async function loadFeedPage(reset = false, silent = false) {
  if (state.feedLoading) return;
  state.feedLoading = true;
  if (reset && !silent) renderFeedLoading();
  try {
    const before = reset ? null : state.feed.at(-1)?.created_at || null;
    const { photos, liked } = await fetchFeed({ before });
    if (reset) {
      state.feed = photos;
      state.liked = liked;
      state.feedDone = photos.length < config.feedPageSize;
    } else {
      state.feed.push(...photos.filter(newPhoto => !state.feed.some(old => old.id === newPhoto.id)));
      for (const id of liked) state.liked.add(id);
      state.feedDone = photos.length < config.feedPageSize;
    }
    renderFeed();
  } catch (err) {
    if (!silent) renderFeedError(err.message);
  } finally {
    state.feedLoading = false;
  }
}

function renderFeedLoading() {
  const feed = document.querySelector("#feed");
  if (!feed) return;
  feed.innerHTML = Array.from({ length: 4 }, () => `<article class="photo-card"><div class="photo-frame"><div class="photo-skeleton"></div></div><div class="photo-card-body"><div class="photo-meta"><div class="photo-skeleton" style="width:130px;height:13px;border-radius:6px"></div></div></div></article>`).join("");
}

function renderFeedError(message) {
  const feed = document.querySelector("#feed");
  if (!feed) return;
  feed.innerHTML = `<div class="error-card">${escapeHtml(message || "Não foi possível carregar o feed.")}<br><br><button id="retry-feed" class="btn btn-secondary" type="button">TENTAR NOVAMENTE</button></div>`;
  document.querySelector("#retry-feed").onclick = () => loadFeedPage(true);
}

function renderFeed() {
  renderPhotoCollection("#feed", state.feed, state.liked);
  const loadMore = document.querySelector("#load-more");
  if (loadMore) loadMore.hidden = state.feedDone || state.feed.length === 0;
}

function renderMine() {
  renderPhotoCollection("#mine-feed", state.myPhotos, state.myLiked, "Você ainda não publicou nenhuma foto neste aparelho.");
}

async function loadMine() {
  try {
    const { photos, liked } = await fetchFeed({ userId: state.session.user.id, limit: 100 });
    state.myPhotos = photos;
    state.myLiked = liked;
    renderMine();
  } catch (err) {
    const el = document.querySelector("#mine-feed");
    if (el) el.innerHTML = `<div class="error-card">${escapeHtml(err.message)}</div>`;
  }
}

function renderPhotoCollection(selector, photos, likedSet, emptyText = "Ainda não há fotos no feed. Seja o primeiro a publicar!") {
  const container = document.querySelector(selector);
  if (!container) return;
  if (!photos.length) {
    container.innerHTML = `<div class="empty-card">${icons.image}<div>${escapeHtml(emptyText)}</div></div>`;
    return;
  }
  container.innerHTML = photos.map(photo => photoCardHtml(photo, likedSet.has(photo.id))).join("");
  container.querySelectorAll("[data-like]").forEach(button => button.addEventListener("click", handleLikeClick));
  container.querySelectorAll("[data-photo-open]").forEach(img => {
    img.addEventListener("click", () => openOriginalPhoto(img.dataset.photoOpen));
    img.addEventListener("error", () => {
      const frame = img.closest(".photo-frame");
      if (frame) frame.innerHTML = `<div class="thumbnail-pending"><small>Prévia indisponível. Atualize a página para tentar novamente.</small></div>`;
    });
  });
}

function safePhotoAspect(photo) {
  const width = Number(photo?.width);
  const height = Number(photo?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 4 / 3;
  return Math.max(0.72, Math.min(1.65, width / height));
}

function photoCardHtml(photo, liked) {
  const preview = escapeHtml(photo.preview_url || "");
  const aspect = safePhotoAspect(photo);
  return `<article class="photo-card" data-photo-card="${photo.id}">
    <div class="photo-frame" style="aspect-ratio:${aspect}">
      <img loading="lazy" decoding="async" src="${preview}" alt="Foto publicada por ${escapeHtml(photo.display_name)}" data-photo-open="${photo.id}" />
    </div>
    <div class="photo-card-body">
      <div class="photo-meta"><p class="photo-author">Publicado por <strong>${escapeHtml(photo.display_name)}</strong></p><div class="photo-time">${escapeHtml(formatRelativeTime(photo.created_at))}</div></div>
      <button class="like-button ${liked ? "liked" : ""}" type="button" data-like="${photo.id}" aria-label="${liked ? "Remover curtida" : "Curtir foto"}">${icons.heart}<span class="like-count">${Number(photo.likes_count || 0)}</span></button>
    </div>
  </article>`;
}

function findPhotoEverywhere(id) {
  const found = [];
  for (const collection of [state.feed, state.myPhotos]) {
    const photo = collection.find(item => item.id === id);
    if (photo && !found.includes(photo)) found.push(photo);
  }
  return found;
}

function setLikedEverywhere(id, liked) {
  for (const set of [state.liked, state.myLiked]) {
    if (liked) set.add(id); else set.delete(id);
  }
}

function renderAllPhotoViews() {
  renderFeed();
  renderMine();
}

async function handleLikeClick(event) {
  const button = event.currentTarget;
  const id = button.dataset.like;
  const current = state.liked.has(id) || state.myLiked.has(id);
  const next = !current;
  button.disabled = true;

  const photos = findPhotoEverywhere(id);
  setLikedEverywhere(id, next);
  photos.forEach(photo => {
    photo.likes_count = Math.max(0, Number(photo.likes_count || 0) + (next ? 1 : -1));
  });
  renderAllPhotoViews();

  try {
    await setLike(id, next);
  } catch (err) {
    setLikedEverywhere(id, current);
    photos.forEach(photo => {
      photo.likes_count = Math.max(0, Number(photo.likes_count || 0) + (next ? -1 : 1));
    });
    renderAllPhotoViews();
    toast("Não foi possível registrar a curtida.", "error");
  }
}

async function openOriginalPhoto(photoId) {
  const root = document.querySelector("#modal-root");
  const photo = findPhotoEverywhere(photoId)[0];
  const previewUrl = photo?.preview_url || `/api/media?photo=${encodeURIComponent(photoId)}`;
  root.innerHTML = `<div class="modal-backdrop"><div class="photo-modal">
    <button class="modal-close" type="button" aria-label="Fechar">×</button>
    <img src="${escapeHtml(previewUrl)}" alt="Foto da festa" />
    <div class="modal-actions">
      <button id="open-original" class="btn btn-primary" type="button">ABRIR FOTO ORIGINAL</button>
      <button id="close-original" class="btn btn-secondary" type="button">FECHAR</button>
    </div>
  </div></div>`;
  root.querySelector(".modal-close").onclick = closePhotoModal;
  root.querySelector("#close-original").onclick = closePhotoModal;
  root.querySelector(".modal-backdrop").addEventListener("click", event => {
    if (event.target.classList.contains("modal-backdrop")) closePhotoModal();
  });
  root.querySelector("#open-original").onclick = async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "ABRINDO…";
    const popup = window.open("about:blank", "_blank");
    try {
      const url = await getOriginalViewUrl(photoId);
      if (popup) {
        popup.opener = null;
        popup.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (err) {
      popup?.close();
      toast(err.message || "Não foi possível abrir a foto original.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "ABRIR FOTO ORIGINAL";
    }
  };
}

function closePhotoModal() {
  document.querySelector("#modal-root").innerHTML = "";
}

async function editDisplayName() {
  const current = state.profile.display_name;
  const nextRaw = window.prompt("Como podemos chamar você?", current);
  if (nextRaw === null) return;
  const next = normalizeName(nextRaw);
  if (next.length < 2 || next.length > config.maxDisplayNameLength) {
    toast("Digite um nome entre 2 e 40 caracteres.", "error");
    return;
  }
  try {
    await saveProfile(state.session.user.id, next);
    state.profile.display_name = next;
    storeName(next);
    document.querySelector("#profile-pill span").textContent = next;
    toast("Nome atualizado. As fotos já publicadas mantêm o nome usado na publicação.", "success", 4200);
  } catch (err) {
    toast(err.message || "Não foi possível atualizar seu nome.", "error");
  }
}

function toast(message, type = "", duration = 3200) {
  const stack = document.querySelector("#toasts");
  if (!stack) return;
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  stack.appendChild(node);
  setTimeout(() => node.remove(), duration);
}

async function bootstrapApp() {
  const missing = assertPublicConfig();
  if (missing.length) return renderConfigError(missing);

  const stored = getStoredName();
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (!data.session) return renderOnboarding(stored);

  state.session = data.session;
  try {
    state.profile = await getOwnProfile();
  } catch {}
  if (!state.profile?.display_name) {
    if (!stored) return renderOnboarding("");
    try {
      await saveProfile(data.session.user.id, stored);
      state.profile = { id: data.session.user.id, display_name: stored };
    } catch {
      return renderOnboarding(stored);
    }
  }
  storeName(state.profile.display_name);
  renderApp();
  await startDataLayer();
}

function renderDriveAdmin() {
  const params = new URLSearchParams(location.search);
  const connectedParam = params.get("connected") === "1";
  const driveError = params.get("drive_error") || "";
  app.innerHTML = `<div class="admin-layout"><section class="admin-card">
    <div class="brand-kicker">ADMINISTRAÇÃO</div>
    <h1>Google Drive</h1>
    <p class="brand-subtitle">Conecte uma única conta Google. É nela que o aplicativo guardará as fotos originais e as prévias.</p>
    <div class="field">
      <label for="admin-key">CHAVE DE ADMINISTRAÇÃO</label>
      <input id="admin-key" class="text-input" type="password" autocomplete="off" placeholder="ADMIN_KEY" />
    </div>
    <div class="admin-actions">
      <button id="check-drive" class="btn btn-secondary" type="button">VERIFICAR CONEXÃO</button>
      <button id="connect-drive" class="btn btn-primary" type="button">CONECTAR / RECONECTAR GOOGLE DRIVE</button>
    </div>
    <div id="admin-status" class="admin-status">${escapeHtml(driveError || (connectedParam ? "Autorização concluída. Informe a chave e verifique a conexão." : "Informe a chave de administração."))}</div>
    <p class="hint">A conta Google é autorizada somente nesta página. Os convidados nunca fazem login no Google.</p>
  </section></div>`;

  const keyInput = document.querySelector("#admin-key");
  const status = document.querySelector("#admin-status");
  const savedKey = sessionStorage.getItem("pedro_momentos_admin_key") || "";
  keyInput.value = savedKey;

  async function adminFetch(path, options = {}) {
    const key = keyInput.value.trim();
    if (!key) throw new Error("Informe a ADMIN_KEY primeiro.");
    sessionStorage.setItem("pedro_momentos_admin_key", key);
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Key": key,
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Erro ${response.status}.`);
    return data;
  }

  document.querySelector("#check-drive").onclick = async () => {
    status.textContent = "Verificando…";
    try {
      const data = await adminFetch("/api/admin-drive-status");
      status.textContent = data.connected
        ? `Google Drive conectado. Pasta: ${data.folderName || "Pedro Momentos"}.`
        : "Google Drive ainda não está conectado.";
    } catch (err) {
      status.textContent = err.message;
    }
  };

  document.querySelector("#connect-drive").onclick = async () => {
    status.textContent = "Preparando autorização…";
    try {
      const data = await adminFetch("/api/admin-drive-auth", { method: "POST", body: "{}" });
      window.location.href = data.url;
    } catch (err) {
      status.textContent = err.message;
    }
  };

  if (connectedParam && savedKey) document.querySelector("#check-drive").click();
}

if (new URLSearchParams(location.search).get("admin") === "drive") {
  renderDriveAdmin();
} else {
  bootstrapApp().catch(error => renderConfigError([error.message || "Erro ao iniciar"]));
}
