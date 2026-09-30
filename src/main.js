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
import { clearUploadRecovery, downloadOriginalPhoto, uploadPhotoToDrive } from "./lib/drive.js";
import {
  clearPendingCapture,
  loadPendingCapture,
  requestPersistentStorage,
  savePendingCapture,
} from "./lib/pending-upload.js";
import {
  downloadBlob,
  escapeHtml,
  formatBytes,
  formatRelativeTime,
  normalizeName,
} from "./lib/utils.js";

const app = document.querySelector("#app");

const icons = {
  feed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8.5 5.5 10 3.8h4L15.5 5.5H19A2 2 0 0 1 21 7.5v9A2 2 0 0 1 19 18.5H5A2 2 0 0 1 3 16.5v-9A2 2 0 0 1 5 5.5Z"/><circle cx="12" cy="12" r="3.3"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9" r="1.5"/><path d="m5 18 5-5 3 3 2-2 4 4"/></svg>`,
  heart: `<svg viewBox="0 0 24 24"><path d="M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.1a5 5 0 0 0 0-7.1Z"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 20h14"/></svg>`,
};

const sortLabels = {
  newest: "Mais recentes",
  oldest: "Mais antigas",
  most_liked: "Mais curtidas",
  least_liked: "Menos curtidas",
  user_az: "Usuários A–Z",
  user_za: "Usuários Z–A",
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
  feedOffset: 0,
  feedSort: "newest",
  myPhotos: [],
  myLiked: new Set(),
  mineDone: false,
  mineLoading: false,
  mineOffset: 0,
  mineSort: "newest",
  realtimeCleanup: null,
  refreshTimer: null,
  realtimeRefreshTimeout: null,
  uploading: false,
  downloading: false,
};

function sortOptions(selected) {
  return Object.entries(sortLabels)
    .map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`)
    .join("");
}

function renderConfigError(missing) {
  app.innerHTML = `
    <div class="screen-center">
      <section class="config-card">
        <div class="brand-kicker">CONFIGURAÇÃO</div>
        <h1 class="brand-title">Aplicativo ainda não configurado</h1>
        <p class="brand-subtitle">Defina as variáveis de ambiente da Vercel antes de publicar.</p>
        <div class="admin-status"><strong>Faltando:</strong><br>${missing.map(escapeHtml).join("<br>")}</div>
      </section>
    </div>`;
}

function getStoredName() {
  return normalizeName(localStorage.getItem("party_display_name") || "");
}

function storeName(name) {
  localStorage.setItem("party_display_name", normalizeName(name));
}

function renderOnboarding(prefill = "") {
  app.innerHTML = `
    <div class="screen-center">
      <section class="onboarding-card">
        <div class="brand-kicker">${escapeHtml(config.eventTitle)}</div>
        <h1 class="brand-title">Momentos da festa</h1>
        <p class="brand-subtitle">Registre o que está acontecendo agora, publique no mural e acompanhe os cliques de todo mundo.</p>
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
      requestPersistentStorage();
      renderApp();
      await startDataLayer();
      await restorePendingPhoto();
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
      <div id="connection-banner" class="connection-banner" hidden>Você está sem internet. O envio será retomado quando a conexão voltar.</div>
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
          <div class="section-heading section-heading-actions">
            <div><h2>Feed da festa</h2><p>Os registros aparecem aqui em tempo real.</p></div>
            <label class="sort-control">ORDENAR
              <select id="feed-sort">${sortOptions(state.feedSort)}</select>
            </label>
          </div>
          <div id="feed" class="feed"></div>
          <button id="load-more" class="btn btn-secondary btn-block load-more" type="button" hidden>CARREGAR MAIS</button>
        </section>

        <section id="view-camera" class="view" data-view="camera">
          <div class="section-heading"><div><h2>Tirar uma foto</h2><p>Use a câmera do celular. Nesta versão, somente fotos tiradas durante a festa podem ser publicadas.</p></div></div>
          <div class="capture-wrap"><div id="camera-card" class="camera-card"></div></div>
          <input id="camera-input" class="file-input" type="file" accept="image/*" capture="environment" />
        </section>

        <section id="view-mine" class="view" data-view="mine">
          <div class="section-heading section-heading-actions">
            <div><h2>Meus cliques</h2><p>Suas publicações. O download do original fica disponível somente aqui.</p></div>
            <label class="sort-control">ORDENAR
              <select id="mine-sort">${sortOptions(state.mineSort)}</select>
            </label>
          </div>
          <div id="mine-feed" class="feed"></div>
          <button id="mine-load-more" class="btn btn-secondary btn-block load-more" type="button" hidden>CARREGAR MAIS</button>
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
  updateConnectionBanner();
}

function bindAppEvents() {
  document.querySelectorAll("[data-nav]").forEach(button => {
    button.addEventListener("click", () => switchView(button.dataset.nav));
  });
  document.querySelector("#camera-input").addEventListener("change", handleFileInput);
  document.querySelector("#load-more").addEventListener("click", () => loadFeedPage(false));
  document.querySelector("#mine-load-more").addEventListener("click", () => loadMinePage(false));
  document.querySelector("#profile-pill").addEventListener("click", editDisplayName);
  document.querySelector("#feed-sort").addEventListener("change", event => {
    state.feedSort = event.target.value;
    loadFeedPage(true);
  });
  document.querySelector("#mine-sort").addEventListener("change", event => {
    state.mineSort = event.target.value;
    loadMinePage(true);
  });
  window.addEventListener("online", updateConnectionBanner);
  window.addEventListener("offline", updateConnectionBanner);
}

function updateConnectionBanner() {
  const banner = document.querySelector("#connection-banner");
  if (!banner) return;
  banner.hidden = navigator.onLine;
  if (navigator.onLine && state.selectedFile) toast("Conexão restabelecida. Você pode continuar a publicação.", "success", 2800);
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  document.querySelectorAll("[data-nav]").forEach(el => el.classList.toggle("active", el.dataset.nav === view));
  window.scrollTo({ top: 0, behavior: "auto" });
  if (view === "mine" && !state.myPhotos.length && !state.mineLoading) loadMinePage(true);
}

function renderCameraEmpty() {
  const card = document.querySelector("#camera-card");
  if (!card) return;
  card.innerHTML = `
    <div class="camera-stage">
      <div class="camera-placeholder">
        <div class="camera-icon">${icons.camera}</div>
        <h3>Registre esse momento</h3>
        <p>Ao tocar abaixo, o celular abrirá a câmera para uma nova foto.</p>
      </div>
    </div>
    <div class="capture-actions">
      <button id="take-photo" class="btn btn-primary" type="button">ABRIR CÂMERA</button>
      <button id="go-feed" class="btn btn-secondary" type="button">VER FEED</button>
    </div>`;
  document.querySelector("#take-photo").onclick = () => document.querySelector("#camera-input").click();
  document.querySelector("#go-feed").onclick = () => switchView("feed");
}

async function handleFileInput(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("A câmera não retornou uma imagem válida.", "error");
  if (file.size > config.maxPhotoBytes) return toast("Essa foto ultrapassa 30 MB.", "error");

  if (state.selectedFile) clearUploadRecovery(state.selectedFile);
  await clearSelectedFile(true);
  state.selectedFile = file;
  state.selectedUrl = URL.createObjectURL(file);
  await savePendingCapture(file);
  renderPhotoPreview();
}

function renderPhotoPreview() {
  const card = document.querySelector("#camera-card");
  if (!card || !state.selectedFile) return;
  card.innerHTML = `
    <div class="preview-stage">
      <img src="${state.selectedUrl}" alt="Prévia da foto tirada" />
      <div class="preview-badge">${escapeHtml(formatBytes(state.selectedFile.size))}</div>
      <div id="upload-panel" hidden></div>
    </div>
    <div class="preview-actions">
      <button id="publish-photo" class="btn btn-primary btn-block" type="button">PUBLICAR NA FESTA</button>
      <button id="retake-photo" class="btn btn-secondary btn-block" type="button">TIRAR OUTRA FOTO</button>
    </div>`;
  document.querySelector("#publish-photo").onclick = publishSelectedPhoto;
  document.querySelector("#retake-photo").onclick = async () => {
    if (state.selectedFile) clearUploadRecovery(state.selectedFile);
    await clearSelectedFile(true);
    renderCameraEmpty();
    document.querySelector("#camera-input").click();
  };
}

async function publishSelectedPhoto() {
  if (!state.selectedFile || state.uploading) return;
  if (!navigator.onLine) return toast("Você está sem internet. Tente novamente quando a conexão voltar.", "error");

  const panel = document.querySelector("#upload-panel");
  const publishButton = document.querySelector("#publish-photo");
  const retakeButton = document.querySelector("#retake-photo");
  const selectedFile = state.selectedFile;

  state.uploading = true;
  for (const button of [publishButton, retakeButton]) if (button) button.disabled = true;
  if (publishButton) publishButton.textContent = "PUBLICANDO…";

  panel.hidden = false;
  panel.className = "upload-panel";
  panel.innerHTML = `<div class="upload-card"><h3>Preparando…</h3><p>Não feche esta tela. Se a internet oscilar, a próxima tentativa reaproveita o que já chegou ao Drive.</p><div class="progress-track"><div class="progress-bar"></div></div><strong class="upload-percent">0%</strong></div>`;
  const title = panel.querySelector("h3");
  const description = panel.querySelector("p");
  const bar = panel.querySelector(".progress-bar");
  const percent = panel.querySelector(".upload-percent");

  try {
    const photo = await uploadPhotoToDrive(selectedFile, state.profile.display_name, progress => {
      title.textContent = progress.label;
      const value = Math.max(0, Math.min(1, progress.value));
      bar.style.width = `${Math.max(2, value * 100)}%`;
      percent.textContent = `${Math.round(value * 100)}%`;
    });

    toast("Foto publicada no feed!", "success");
    clearUploadRecovery(selectedFile);
    await clearSelectedFile(true);
    renderCameraEmpty();
    await loadFeedPage(true, true);
    await loadMinePage(true, true);
    switchView("feed");
  } catch (err) {
    title.textContent = "Não foi possível concluir";
    description.textContent = navigator.onLine
      ? "Toque em PUBLICAR novamente. O aplicativo vai reaproveitar o que já tiver sido enviado."
      : "Sua foto ficou salva neste aparelho. Quando a internet voltar, toque em PUBLICAR novamente.";
    bar.style.width = "0%";
    percent.textContent = "0%";
    if (publishButton) {
      publishButton.disabled = false;
      publishButton.textContent = "TENTAR PUBLICAR NOVAMENTE";
    }
    if (retakeButton) retakeButton.disabled = false;
    toast(err.message || "Não foi possível publicar a foto.", "error", 6000);
  } finally {
    state.uploading = false;
  }
}

async function clearSelectedFile(removePending = false) {
  if (state.selectedUrl) URL.revokeObjectURL(state.selectedUrl);
  state.selectedUrl = null;
  state.selectedFile = null;
  if (removePending) await clearPendingCapture();
}

async function restorePendingPhoto() {
  if (state.selectedFile) return;
  const file = await loadPendingCapture();
  if (!file || file.size > config.maxPhotoBytes || !file.type.startsWith("image/")) return;
  state.selectedFile = file;
  state.selectedUrl = URL.createObjectURL(file);
  renderPhotoPreview();
  toast("Encontramos uma foto que ainda não terminou de ser publicada. Abra a Câmera para continuar.", "success", 5200);
}

async function startDataLayer() {
  await loadFeedPage(true);
  state.realtimeCleanup?.();
  state.realtimeCleanup = subscribeToPhotoChanges(() => {
    clearTimeout(state.realtimeRefreshTimeout);
    state.realtimeRefreshTimeout = setTimeout(() => {
      loadFeedPage(true, true);
      if (state.view === "mine") loadMinePage(true, true);
    }, 450);
  });

  clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(() => {
    if (!document.hidden && state.view === "feed") loadFeedPage(true, true);
  }, config.refreshIntervalMs);
}

async function loadFeedPage(reset = false, silent = false) {
  if (state.feedLoading) return;
  state.feedLoading = true;
  if (reset) {
    state.feedOffset = 0;
    state.feedDone = false;
    if (!silent) renderFeedLoading("#feed");
  }
  try {
    const { photos, liked } = await fetchFeed({ offset: state.feedOffset, sort: state.feedSort });
    if (reset) {
      state.feed = photos;
      state.liked = liked;
    } else {
      state.feed.push(...photos.filter(newPhoto => !state.feed.some(old => old.id === newPhoto.id)));
      for (const id of liked) state.liked.add(id);
    }
    state.feedOffset = state.feed.length;
    state.feedDone = photos.length < config.feedPageSize;
    renderFeed();
  } catch (err) {
    if (!silent) renderFeedError(err.message);
  } finally {
    state.feedLoading = false;
  }
}

async function loadMinePage(reset = false, silent = false) {
  if (state.mineLoading) return;
  state.mineLoading = true;
  if (reset) {
    state.mineOffset = 0;
    state.mineDone = false;
    if (!silent) renderFeedLoading("#mine-feed");
  }
  try {
    const { photos, liked } = await fetchFeed({
      userId: state.session.user.id,
      offset: state.mineOffset,
      sort: state.mineSort,
    });
    if (reset) {
      state.myPhotos = photos;
      state.myLiked = liked;
    } else {
      state.myPhotos.push(...photos.filter(newPhoto => !state.myPhotos.some(old => old.id === newPhoto.id)));
      for (const id of liked) state.myLiked.add(id);
    }
    state.mineOffset = state.myPhotos.length;
    state.mineDone = photos.length < config.feedPageSize;
    renderMine();
  } catch (err) {
    const el = document.querySelector("#mine-feed");
    if (el && !silent) el.innerHTML = `<div class="error-card">${escapeHtml(err.message)}</div>`;
  } finally {
    state.mineLoading = false;
  }
}

function renderFeedLoading(selector) {
  const feed = document.querySelector(selector);
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
  renderPhotoCollection("#feed", state.feed, state.liked, { context: "feed" });
  const loadMore = document.querySelector("#load-more");
  if (loadMore) loadMore.hidden = state.feedDone || state.feed.length === 0;
}

function renderMine() {
  renderPhotoCollection("#mine-feed", state.myPhotos, state.myLiked, {
    context: "mine",
    emptyText: "Você ainda não publicou nenhuma foto neste aparelho.",
  });
  const loadMore = document.querySelector("#mine-load-more");
  if (loadMore) loadMore.hidden = state.mineDone || state.myPhotos.length === 0;
}

function renderPhotoCollection(selector, photos, likedSet, { context = "feed", emptyText = "Ainda não há fotos no feed. Seja o primeiro a publicar!" } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;
  if (!photos.length) {
    container.innerHTML = `<div class="empty-card">${icons.image}<div>${escapeHtml(emptyText)}</div></div>`;
    return;
  }
  container.innerHTML = photos.map(photo => photoCardHtml(photo, likedSet.has(photo.id), context)).join("");
  container.querySelectorAll("[data-like]").forEach(button => button.addEventListener("click", handleLikeClick));
  container.querySelectorAll("[data-photo-open]").forEach(img => {
    img.addEventListener("click", () => openPhotoModal(img.dataset.photoOpen, img.dataset.context === "mine"));
    img.addEventListener("error", () => {
      const frame = img.closest(".photo-frame");
      if (frame) frame.innerHTML = `<div class="thumbnail-pending"><small>Prévia indisponível. Atualize a página para tentar novamente.</small></div>`;
    });
  });
  container.querySelectorAll("[data-download]").forEach(button => {
    button.addEventListener("click", () => handleOriginalDownload(button.dataset.download, button));
  });
}

function safePhotoAspect(photo) {
  const width = Number(photo?.width);
  const height = Number(photo?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 4 / 3;
  return Math.max(0.72, Math.min(1.65, width / height));
}

function photoCardHtml(photo, liked, context) {
  const preview = escapeHtml(photo.preview_url || "");
  const aspect = safePhotoAspect(photo);
  const download = context === "mine"
    ? `<button class="photo-download" type="button" data-download="${photo.id}" aria-label="Baixar foto original">${icons.download}<span>Baixar original</span></button>`
    : "";
  return `<article class="photo-card" data-photo-card="${photo.id}">
    <div class="photo-frame" style="aspect-ratio:${aspect}">
      <img loading="lazy" decoding="async" src="${preview}" alt="Foto publicada por ${escapeHtml(photo.display_name)}" data-photo-open="${photo.id}" data-context="${context}" />
    </div>
    <div class="photo-card-body">
      <div class="photo-meta"><p class="photo-author">Publicado por <strong>${escapeHtml(photo.display_name)}</strong></p><div class="photo-time">${escapeHtml(formatRelativeTime(photo.created_at))}</div>${download}</div>
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
    if (["most_liked", "least_liked"].includes(state.feedSort)) loadFeedPage(true, true);
    if (["most_liked", "least_liked"].includes(state.mineSort) && state.view === "mine") loadMinePage(true, true);
  } catch {
    setLikedEverywhere(id, current);
    photos.forEach(photo => {
      photo.likes_count = Math.max(0, Number(photo.likes_count || 0) + (next ? -1 : 1));
    });
    renderAllPhotoViews();
    toast("Não foi possível registrar a curtida.", "error");
  }
}

function openPhotoModal(photoId, allowDownload) {
  const root = document.querySelector("#modal-root");
  const photo = findPhotoEverywhere(photoId)[0];
  const previewUrl = photo?.preview_url || `/api/media?photo=${encodeURIComponent(photoId)}`;
  root.innerHTML = `<div class="modal-backdrop"><div class="photo-modal">
    <button class="modal-close" type="button" aria-label="Fechar">×</button>
    <img src="${escapeHtml(previewUrl)}" alt="Foto da festa" />
    <div class="modal-actions">
      ${allowDownload ? `<button id="download-original" class="btn btn-primary" type="button">BAIXAR FOTO ORIGINAL</button>` : ""}
      <button id="close-original" class="btn btn-secondary" type="button">FECHAR</button>
    </div>
  </div></div>`;
  root.querySelector(".modal-close").onclick = closePhotoModal;
  root.querySelector("#close-original").onclick = closePhotoModal;
  root.querySelector(".modal-backdrop").addEventListener("click", event => {
    if (event.target.classList.contains("modal-backdrop")) closePhotoModal();
  });
  if (allowDownload) {
    root.querySelector("#download-original").onclick = event => handleOriginalDownload(photoId, event.currentTarget);
  }
}

function closePhotoModal() {
  document.querySelector("#modal-root").innerHTML = "";
}

async function handleOriginalDownload(photoId, button) {
  if (state.downloading) return;
  const photo = state.myPhotos.find(item => item.id === photoId);
  if (!photo) return toast("O download do original só está disponível em Meus cliques.", "error");
  state.downloading = true;
  const originalText = button?.textContent || "BAIXAR FOTO ORIGINAL";
  if (button) button.disabled = true;
  try {
    const { blob, filename } = await downloadOriginalPhoto(photo, ratio => {
      if (button) button.textContent = `BAIXANDO ${Math.round(ratio * 100)}%`;
    });
    downloadBlob(blob, filename);
    toast("Foto original enviada para os downloads do aparelho.", "success");
  } catch (err) {
    toast(err.message || "Não foi possível baixar a foto original.", "error", 5200);
  } finally {
    state.downloading = false;
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
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
  try { state.profile = await getOwnProfile(); } catch {}
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
  requestPersistentStorage();
  renderApp();
  await startDataLayer();
  await restorePendingPhoto();
}

function renderAdminRecentPhotos(photos = []) {
  if (!photos.length) return `<div class="empty-card compact">Nenhuma publicação encontrada.</div>`;
  return photos.map(photo => `
    <article class="admin-photo-row" data-admin-photo="${photo.id}">
      ${photo.published
        ? `<img src="/api/media?photo=${encodeURIComponent(photo.id)}" alt="Prévia" loading="lazy" />`
        : `<div class="admin-photo-placeholder">OCULTA</div>`}
      <div class="admin-photo-info">
        <strong>${escapeHtml(photo.display_name)}</strong>
        <span>${escapeHtml(new Date(photo.created_at).toLocaleString("pt-BR"))}</span>
        <small>${formatBytes(Number(photo.size_bytes || 0))} · ${Number(photo.likes_count || 0)} curtidas · ${photo.published ? "visível" : "oculta"}</small>
      </div>
      <div class="admin-photo-actions">
        <button class="btn btn-secondary btn-small" data-admin-action="${photo.published ? "hide" : "show"}" data-photo-id="${photo.id}" type="button">${photo.published ? "OCULTAR" : "MOSTRAR"}</button>
        <button class="btn btn-danger btn-small" data-admin-action="delete" data-photo-id="${photo.id}" type="button">EXCLUIR</button>
      </div>
    </article>`).join("");
}

function renderDriveAdmin() {
  const params = new URLSearchParams(location.search);
  const connectedParam = params.get("connected") === "1";
  const driveError = params.get("drive_error") || "";
  app.innerHTML = `<div class="admin-layout"><section class="admin-card admin-card-wide">
    <div class="brand-kicker">ADMINISTRAÇÃO</div>
    <h1>Pedro Momentos</h1>
    <p class="brand-subtitle">Conexão com o Drive, painel da festa, limpeza e moderação das publicações.</p>
    <div class="field">
      <label for="admin-key">CHAVE DE ADMINISTRAÇÃO</label>
      <input id="admin-key" class="text-input" type="password" autocomplete="off" placeholder="ADMIN_KEY" />
    </div>
    <div class="admin-actions">
      <button id="check-drive" class="btn btn-secondary" type="button">ATUALIZAR PAINEL</button>
      <button id="connect-drive" class="btn btn-primary" type="button">CONECTAR / RECONECTAR DRIVE</button>
    </div>
    <div id="admin-status" class="admin-status">${escapeHtml(driveError || (connectedParam ? "Autorização concluída. Informe a chave e atualize o painel." : "Informe a chave de administração."))}</div>

    <div id="admin-dashboard" hidden>
      <div class="admin-production-note"><strong>Antes da festa:</strong> no Google Cloud, deixe a tela OAuth em <b>Em produção</b>. Em modo de teste, o refresh token pode expirar em poucos dias.</div>
      <div id="admin-stats" class="admin-stats"></div>
      <div class="admin-tools">
        <button id="cleanup-files" class="btn btn-secondary" type="button">LIMPAR UPLOADS ABANDONADOS</button>
        <button id="lock-originals" class="btn btn-secondary" type="button">PRIVATIZAR ORIGINAIS ANTIGOS</button>
      </div>
      <section class="admin-section">
        <div><h2>QR Code da festa</h2><p>Use este QR no salão para abrir o aplicativo rapidamente.</p></div>
        <div class="qr-wrap"><canvas id="app-qr" width="220" height="220"></canvas><button id="download-qr" class="btn btn-secondary btn-small" type="button">BAIXAR QR CODE</button></div>
      </section>
      <section class="admin-section">
        <div><h2>Publicações recentes</h2><p>Você pode ocultar ou excluir uma foto.</p></div>
        <div id="admin-photos" class="admin-photo-list"></div>
      </section>
    </div>
  </section></div>`;

  const keyInput = document.querySelector("#admin-key");
  const status = document.querySelector("#admin-status");
  const dashboard = document.querySelector("#admin-dashboard");
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

  async function drawQr() {
    try {
      const QRCodeModule = await import("qrcode");
      const toCanvas = QRCodeModule.toCanvas || QRCodeModule.default?.toCanvas;
      if (!toCanvas) throw new Error("Gerador de QR indisponível.");
      const canvas = document.querySelector("#app-qr");
      await toCanvas(canvas, `${location.origin}/`, {
        width: 220,
        margin: 2,
        color: { dark: "#071a33", light: "#f5efdf" },
      });
      document.querySelector("#download-qr").onclick = () => {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "pedro-momentos-qr.png";
        link.click();
      };
    } catch {
      document.querySelector(".qr-wrap").innerHTML = `<div class="admin-status">Não foi possível gerar o QR Code neste navegador.</div>`;
    }
  }

  function bindAdminPhotoActions() {
    document.querySelectorAll("[data-admin-action]").forEach(button => {
      button.onclick = async () => {
        const action = button.dataset.adminAction;
        const photoId = button.dataset.photoId;
        if (action === "delete" && !confirm("Excluir esta foto do feed e também do Google Drive? Essa ação não pode ser desfeita.")) return;
        button.disabled = true;
        try {
          await adminFetch("/api/admin-photo-action", {
            method: "POST",
            body: JSON.stringify({ action, photoId }),
          });
          await loadDashboard();
        } catch (err) {
          status.textContent = err.message;
        } finally {
          button.disabled = false;
        }
      };
    });
  }

  async function loadDashboard() {
    status.textContent = "Atualizando painel…";
    try {
      const [drive, data] = await Promise.all([
        adminFetch("/api/admin-drive-status"),
        adminFetch("/api/admin-dashboard"),
      ]);
      status.textContent = drive.connected
        ? `Google Drive conectado. Pasta: ${drive.folderName || "Pedro Momentos"}.`
        : `Google Drive não conectado${drive.error ? `: ${drive.error}` : "."}`;
      dashboard.hidden = false;
      document.querySelector("#admin-stats").innerHTML = `
        <div><strong>${data.stats.photos}</strong><span>fotos</span></div>
        <div><strong>${data.stats.users}</strong><span>usuários</span></div>
        <div><strong>${data.stats.likes}</strong><span>curtidas</span></div>
        <div><strong>${data.stats.hidden}</strong><span>ocultas</span></div>
        <div><strong>${escapeHtml(formatBytes(data.stats.storageBytes))}</strong><span>armazenados</span></div>`;
      document.querySelector("#admin-photos").innerHTML = renderAdminRecentPhotos(data.recentPhotos);
      bindAdminPhotoActions();
      drawQr();
    } catch (err) {
      status.textContent = err.message;
    }
  }

  document.querySelector("#check-drive").onclick = loadDashboard;
  document.querySelector("#connect-drive").onclick = async () => {
    status.textContent = "Preparando autorização…";
    try {
      const data = await adminFetch("/api/admin-drive-auth", { method: "POST", body: "{}" });
      window.location.href = data.url;
    } catch (err) {
      status.textContent = err.message;
    }
  };
  document.querySelector("#cleanup-files").onclick = async () => {
    status.textContent = "Limpando uploads abandonados…";
    try {
      const data = await adminFetch("/api/cleanup-abandoned", { method: "POST", body: "{}" });
      status.textContent = `Limpeza concluída: ${data.deleted || 0} arquivo(s) removido(s).`;
      await loadDashboard();
    } catch (err) {
      status.textContent = err.message;
    }
  };
  document.querySelector("#lock-originals").onclick = async () => {
    status.textContent = "Removendo compartilhamentos públicos antigos…";
    try {
      const data = await adminFetch("/api/admin-private-originals", { method: "POST", body: "{}" });
      status.textContent = `Privacidade revisada: ${data.updated || 0} original(is) ajustado(s).`;
    } catch (err) {
      status.textContent = err.message;
    }
  };

  if (connectedParam && savedKey) loadDashboard();
}

if (new URLSearchParams(location.search).get("admin") === "drive") {
  renderDriveAdmin();
} else {
  bootstrapApp().catch(error => renderConfigError([error.message || "Erro ao iniciar"]));
}
