export class HttpError extends Error {
  constructor(status, message, code = "ERROR", details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export function parseAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(v => v.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = parseAllowedOrigins(env);
  const selected = origin && allowed.includes(origin.replace(/\/$/, "")) ? origin : allowed[0] || "";
  return {
    ...(selected ? { "Access-Control-Allow-Origin": selected } : {}),
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Admin-Key",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function assertOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return;
  const allowed = parseAllowedOrigins(env);
  if (!allowed.includes(origin.replace(/\/$/, ""))) {
    throw new HttpError(403, "Origem não autorizada.", "ORIGIN_NOT_ALLOWED");
  }
}

export async function readJson(request) {
  const type = request.headers.get("Content-Type") || "";
  if (!type.includes("application/json")) throw new HttpError(415, "Envie JSON.", "INVALID_CONTENT_TYPE");
  try { return await request.json(); } catch { throw new HttpError(400, "JSON inválido.", "INVALID_JSON"); }
}

export function getBearer(request) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) throw new HttpError(401, "Sessão ausente.", "AUTH_REQUIRED");
  return header.slice(7).trim();
}

export function getUploadToken(request) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Upload ")) throw new HttpError(401, "Sessão de upload ausente.", "UPLOAD_AUTH_REQUIRED");
  return header.slice(7).trim();
}

export function constantTimeEqual(a, b) {
  const aa = new TextEncoder().encode(String(a || ""));
  const bb = new TextEncoder().encode(String(b || ""));
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i += 1) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

export function assertAdmin(request, env) {
  if (!env.ADMIN_KEY) throw new HttpError(503, "ADMIN_KEY não configurada.", "ADMIN_NOT_CONFIGURED");
  if (!constantTimeEqual(request.headers.get("X-Admin-Key"), env.ADMIN_KEY)) {
    throw new HttpError(401, "Chave de administração inválida.", "INVALID_ADMIN_KEY");
  }
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}
function base64UrlToBytes(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signUploadSession(payload, secret) {
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyUploadSession(token, secret) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) throw new HttpError(401, "Sessão de upload inválida.", "INVALID_UPLOAD_SESSION");
  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, base64UrlToBytes(signature), new TextEncoder().encode(body));
  if (!valid) throw new HttpError(401, "Sessão de upload inválida.", "INVALID_UPLOAD_SESSION");
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))); } catch { throw new HttpError(401, "Sessão de upload corrompida.", "INVALID_UPLOAD_SESSION"); }
  if (!payload.exp || Date.now() > payload.exp) throw new HttpError(401, "A sessão de upload expirou. Tente publicar novamente.", "UPLOAD_SESSION_EXPIRED");
  return payload;
}

export function sanitizeExtension(name, mime) {
  const mimeMap = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp",
    "image/heic": "heic", "image/heif": "heif", "image/avif": "avif",
  };
  if (mimeMap[mime]) return mimeMap[mime];
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return match?.[1] || "jpg";
}

export function uniquePath(root, extension) {
  const cleanRoot = String(root || "").trim().replace(/\/+$/, "");
  if (!cleanRoot.startsWith("/")) throw new HttpError(500, "TERABOX_ROOT_DIR inválido.", "TERABOX_ROOT_INVALID");
  return `${cleanRoot}/photo_${Date.now()}_${crypto.randomUUID().replaceAll("-", "")}.${extension}`;
}

export function isAcceptedImageMime(mime) {
  return ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif"].includes(String(mime || "").toLowerCase());
}
