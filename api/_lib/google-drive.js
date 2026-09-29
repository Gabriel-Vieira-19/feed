import crypto from "node:crypto";
import { getSetting, setSetting, setSettings } from "./supabase-admin.js";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const ROOT_FOLDER_NAME = "Pedro Momentos";
const ORIGINALS_FOLDER_NAME = "Originais";
const PREVIEWS_FOLDER_NAME = "Prévias";

function env(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Variável ${name} não configurada.`);
  return value;
}

export function getAppUrl() {
  return env("APP_URL").replace(/\/$/, "");
}

export function getRedirectUri() {
  return `${getAppUrl()}/api/admin-drive-callback`;
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function createOAuthState() {
  const payload = base64url(JSON.stringify({
    nonce: crypto.randomBytes(18).toString("hex"),
    exp: Date.now() + 15 * 60_000,
  }));
  const signature = crypto.createHmac("sha256", env("ADMIN_KEY")).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOAuthState(state) {
  const [payload, signature] = String(state || "").split(".");
  if (!payload || !signature) throw new Error("Estado OAuth inválido.");
  const expected = crypto.createHmac("sha256", env("ADMIN_KEY")).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("Estado OAuth inválido.");
  let decoded;
  try { decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw new Error("Estado OAuth inválido."); }
  if (!decoded.exp || Date.now() > Number(decoded.exp)) throw new Error("A autorização expirou. Tente conectar novamente.");
  return decoded;
}

export function buildAuthorizationUrl() {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: createOAuthState(),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(params) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error_description || data.error || `Erro OAuth ${response.status}`;
    const error = new Error(message);
    if (data.error === "invalid_grant") error.message = "A autorização do Google Drive expirou ou foi revogada. Reconecte o Drive na área administrativa.";
    throw error;
  }
  return data;
}

export async function exchangeAuthorizationCode(code) {
  return tokenRequest({
    code,
    client_id: env("GOOGLE_CLIENT_ID"),
    client_secret: env("GOOGLE_CLIENT_SECRET"),
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
  });
}

export async function getDriveAccessToken() {
  const refreshToken = await getSetting("google_drive_refresh_token");
  if (!refreshToken) {
    const error = new Error("Google Drive ainda não foi conectado.");
    error.statusCode = 503;
    throw error;
  }
  const data = await tokenRequest({
    client_id: env("GOOGLE_CLIENT_ID"),
    client_secret: env("GOOGLE_CLIENT_SECRET"),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  if (data.refresh_token) await setSetting("google_drive_refresh_token", data.refresh_token);
  return data.access_token;
}

async function driveFetch(path, accessToken, options = {}) {
  const url = path.startsWith("http") ? path : `https://www.googleapis.com/drive/v3${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data?.error?.message || `Google Drive respondeu ${response.status}.`;
    const error = new Error(message);
    error.statusCode = response.status === 404 ? 404 : 502;
    throw error;
  }
  return response;
}

async function createFolder(accessToken, name, parentId = null) {
  const metadata = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) metadata.parents = [parentId];
  const response = await driveFetch("/files?fields=id,name,mimeType,parents", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(metadata),
  });
  return response.json();
}

async function folderIsValid(accessToken, id) {
  if (!id) return false;
  try {
    const response = await driveFetch(`/files/${encodeURIComponent(id)}?fields=id,mimeType,trashed`, accessToken);
    const data = await response.json();
    return data.mimeType === "application/vnd.google-apps.folder" && !data.trashed;
  } catch {
    return false;
  }
}

export async function ensureDriveFolders(accessToken) {
  let rootId = await getSetting("google_drive_root_folder_id");
  let originalsId = await getSetting("google_drive_originals_folder_id");
  let previewsId = await getSetting("google_drive_previews_folder_id");

  if (!(await folderIsValid(accessToken, rootId))) {
    const folder = await createFolder(accessToken, ROOT_FOLDER_NAME);
    rootId = folder.id;
    originalsId = null;
    previewsId = null;
  }
  if (!(await folderIsValid(accessToken, originalsId))) originalsId = (await createFolder(accessToken, ORIGINALS_FOLDER_NAME, rootId)).id;
  if (!(await folderIsValid(accessToken, previewsId))) previewsId = (await createFolder(accessToken, PREVIEWS_FOLDER_NAME, rootId)).id;

  await setSettings({
    google_drive_root_folder_id: rootId,
    google_drive_originals_folder_id: originalsId,
    google_drive_previews_folder_id: previewsId,
    google_drive_folder_name: ROOT_FOLDER_NAME,
  });

  return { rootId, originalsId, previewsId, folderName: ROOT_FOLDER_NAME };
}

export async function connectDriveWithCode(code) {
  const tokens = await exchangeAuthorizationCode(code);
  if (!tokens.refresh_token) throw new Error("O Google não devolveu um refresh token. Tente conectar novamente e aceite o acesso solicitado.");
  await setSetting("google_drive_refresh_token", tokens.refresh_token);
  const folders = await ensureDriveFolders(tokens.access_token);
  await setSetting("google_drive_connected_at", new Date().toISOString());
  return folders;
}

export async function getDriveStatus() {
  const refreshToken = await getSetting("google_drive_refresh_token");
  if (!refreshToken) return { connected: false };
  try {
    const accessToken = await getDriveAccessToken();
    const folders = await ensureDriveFolders(accessToken);
    return { connected: true, ...folders };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

function sanitizeDriveName(value) {
  return String(value || "foto")
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140) || "foto";
}

export async function createResumableSession({ accessToken, folderId, kind, filename, mimeType, size, uploadGroupId, ownerId }) {
  const url = new URL("https://www.googleapis.com/upload/drive/v3/files");
  url.searchParams.set("uploadType", "resumable");
  url.searchParams.set("fields", "id,name,mimeType,size,parents,appProperties,imageMediaMetadata,webViewLink,webContentLink");

  const metadata = {
    name: sanitizeDriveName(filename),
    mimeType,
    parents: [folderId],
    appProperties: {
      app_id: "pedro_momentos",
      upload_group: uploadGroupId,
      kind,
      owner_id: ownerId,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(size),
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Não foi possível iniciar o upload (${response.status}).`);
  }
  const sessionUrl = response.headers.get("Location");
  if (!sessionUrl) throw new Error("O Google Drive não devolveu a URL da sessão de upload.");
  return sessionUrl;
}

export async function getDriveFile(accessToken, fileId) {
  const fields = "id,name,mimeType,size,parents,appProperties,imageMediaMetadata,webViewLink,webContentLink,trashed";
  const response = await driveFetch(`/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}`, accessToken);
  return response.json();
}

function escapeDriveQueryValue(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

export async function findCompletedUploadFile(accessToken, { folderId, ownerId, uploadGroupId, kind }) {
  const q = [
    `'${escapeDriveQueryValue(folderId)}' in parents`,
    "trashed = false",
    `appProperties has { key='app_id' and value='pedro_momentos' }`,
    `appProperties has { key='owner_id' and value='${escapeDriveQueryValue(ownerId)}' }`,
    `appProperties has { key='upload_group' and value='${escapeDriveQueryValue(uploadGroupId)}' }`,
    `appProperties has { key='kind' and value='${escapeDriveQueryValue(kind)}' }`,
  ].join(" and ");

  const fields = "files(id,name,mimeType,size,parents,appProperties,imageMediaMetadata,webViewLink,webContentLink,trashed,createdTime)";
  const params = new URLSearchParams({
    q,
    spaces: "drive",
    pageSize: "10",
    orderBy: "createdTime desc",
    fields,
  });

  const response = await driveFetch(`/files?${params.toString()}`, accessToken);
  const data = await response.json();
  return Array.isArray(data.files) ? data.files : [];
}

export async function ensureAnyoneReader(accessToken, fileId) {
  const listResponse = await driveFetch(`/files/${encodeURIComponent(fileId)}/permissions?fields=permissions(id,type,role)`, accessToken);
  const list = await listResponse.json();
  const exists = (list.permissions || []).some(permission => permission.type === "anyone" && permission.role === "reader");
  if (exists) return;
  await driveFetch(`/files/${encodeURIComponent(fileId)}/permissions`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ type: "anyone", role: "reader" }),
  });
}

export async function fetchDriveMedia(accessToken, fileId) {
  return driveFetch(`/files/${encodeURIComponent(fileId)}?alt=media`, accessToken);
}
