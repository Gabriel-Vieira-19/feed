import { createClient } from "@supabase/supabase-js";
import { TeraTokenVault } from "./terabox-vault.js";
import {
  HttpError,
  assertAdmin,
  assertOrigin,
  corsHeaders,
  getBearer,
  getUploadToken,
  isAcceptedImageMime,
  json,
  readJson,
  sanitizeExtension,
  signUploadSession,
  uniquePath,
  verifyUploadSession,
} from "./helpers.js";

export { TeraTokenVault };

function adminClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function authClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function verifyUser(request, env) {
  const jwt = getBearer(request);
  const client = authClient(env);
  const { data, error } = await client.auth.getUser(jwt);
  if (error || !data.user?.id) throw new HttpError(401, "Sua sessão expirou. Reabra o aplicativo.", "INVALID_USER_SESSION");
  return data.user;
}

function getVault(env) {
  const id = env.TERA_TOKEN_VAULT.idFromName("primary");
  return env.TERA_TOKEN_VAULT.get(id);
}

async function getTeraToken(env) {
  const response = await getVault(env).fetch("https://vault/token");
  const data = await response.json();
  if (!response.ok) throw new HttpError(response.status, data.error || "TeraBox indisponível.", data.code || "TERABOX_ERROR");
  return data;
}

function teraBase(domain) {
  const clean = String(domain || "www.terabox.com").replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return `https://${clean}`;
}

async function teraFormRequest(env, token, pathname, form) {
  const params = new URLSearchParams({ access_tokens: token.accessToken });
  const response = await fetch(`${teraBase(token.apiDomain)}${pathname}?${params}`, { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok || Number(data.errno || 0) !== 0) {
    throw new HttpError(502, data.show_msg || `Falha no TeraBox (${data.errno ?? response.status}).`, "TERABOX_API_ERROR", data);
  }
  return data;
}

async function teraPrecreate(env, token, path, blocks) {
  const form = new URLSearchParams();
  form.set("path", path);
  form.set("autoinit", "1");
  form.set("block_list", JSON.stringify(blocks));
  return teraFormRequest(env, token, "/openapi/api/precreate", form);
}

async function teraCreate(env, token, payload) {
  const form = new URLSearchParams();
  form.set("path", payload.path);
  form.set("size", String(payload.size));
  form.set("uploadid", payload.uploadid);
  form.set("block_list", JSON.stringify(payload.blocks));
  form.set("rtype", "1");
  return teraFormRequest(env, token, "/openapi/api/create", form);
}

async function teraFileMeta(env, token, path) {
  const params = new URLSearchParams({
    access_tokens: token.accessToken,
    target: JSON.stringify([path]),
    dlink: "0",
  });
  const response = await fetch(`${teraBase(token.apiDomain)}/openapi/api/filemetas?${params}`);
  const data = await response.json();
  if (!response.ok || Number(data.errno || 0) !== 0) {
    throw new HttpError(502, data.show_msg || "Não foi possível gerar a prévia da foto.", "TERABOX_FILEMETA_ERROR", data);
  }
  return data.info?.[0] || null;
}

function previewFromMeta(meta) {
  return meta?.thumbs?.url3 || meta?.thumbs?.url2 || meta?.thumbs?.url1 || null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function teraFileMetaWithRetry(env, token, path, attempts = 4) {
  let lastMeta = null;
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      lastMeta = await teraFileMeta(env, token, path);
      if (previewFromMeta(lastMeta) || attempt === attempts - 1) return lastMeta;
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
    }
    await delay(450 * (attempt + 1));
  }
  if (lastError) throw lastError;
  return lastMeta;
}

async function teraDlink(env, token, fsId) {
  const params = new URLSearchParams({
    access_tokens: token.accessToken,
    fidlist: JSON.stringify([String(fsId)]),
    type: "dlink",
  });
  const response = await fetch(`${teraBase(token.apiDomain)}/openapi/api/download?${params}`, {
    headers: { "Accept": "application/json" },
  });
  const data = await response.json();
  if (!response.ok || Number(data.errno || 0) !== 0 || !data.dlink?.[0]?.dlink) {
    throw new HttpError(502, data.show_msg || "Não foi possível abrir a foto original.", "TERABOX_DLINK_ERROR", data);
  }
  const url = new URL(data.dlink[0].dlink);
  url.searchParams.set("access_tokens", token.accessToken);
  return url.toString();
}

async function getProfileName(env, userId) {
  const client = adminClient(env);
  const { data, error } = await client.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  if (error) throw new HttpError(502, "Não foi possível consultar seu perfil.", "PROFILE_LOOKUP_FAILED");
  const name = String(data?.display_name || "").trim();
  if (!name) throw new HttpError(400, "Defina seu nome antes de publicar.", "PROFILE_NAME_MISSING");
  return name.slice(0, 40);
}

async function insertPhoto(env, values) {
  const client = adminClient(env);
  const { data, error } = await client.from("photos").insert(values).select("id,user_id,display_name,preview_url,mime_type,size_bytes,width,height,likes_count,created_at").single();
  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await client.from("photos").select("id,user_id,display_name,preview_url,mime_type,size_bytes,width,height,likes_count,created_at").eq("tera_path", values.tera_path).maybeSingle();
      if (existing) return existing;
    }
    throw new HttpError(502, "A foto chegou ao TeraBox, mas não foi registrada no feed.", "PHOTO_DB_INSERT_FAILED", error.message);
  }
  return data;
}

async function getPhotoRecord(env, photoId) {
  const client = adminClient(env);
  const { data, error } = await client.from("photos").select("id,tera_fs_id,tera_path,mime_type,preview_url,published").eq("id", photoId).eq("published", true).maybeSingle();
  if (error) throw new HttpError(502, "Falha ao consultar a foto.", "PHOTO_LOOKUP_FAILED");
  if (!data) throw new HttpError(404, "Foto não encontrada.", "PHOTO_NOT_FOUND");
  return data;
}

async function getPhotoByPath(env, teraPath) {
  const client = adminClient(env);
  const { data, error } = await client
    .from("photos")
    .select("id,user_id,display_name,preview_url,mime_type,size_bytes,width,height,likes_count,created_at")
    .eq("tera_path", teraPath)
    .maybeSingle();
  if (error) throw new HttpError(502, "Falha ao consultar a publicação existente.", "PHOTO_LOOKUP_FAILED");
  return data || null;
}

async function updatePreview(env, photoId, previewUrl) {
  const client = adminClient(env);
  await client.from("photos").update({ preview_url: previewUrl, preview_refreshed_at: new Date().toISOString() }).eq("id", photoId);
}

function validateUploadStart(body, env) {
  const maxBytes = Number(env.MAX_UPLOAD_BYTES || 30 * 1024 * 1024);
  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0) throw new HttpError(400, "Foto vazia ou inválida.", "INVALID_FILE_SIZE");
  if (size > maxBytes) throw new HttpError(413, "A foto ultrapassa o limite de 30 MB.", "FILE_TOO_LARGE");
  if (!isAcceptedImageMime(body.mimeType)) throw new HttpError(415, "Formato de imagem não permitido.", "INVALID_IMAGE_TYPE");
  if (!Array.isArray(body.blocks) || body.blocks.length < 1 || body.blocks.length > 16 || body.blocks.some(hash => !/^[a-f0-9]{32}$/i.test(hash))) {
    throw new HttpError(400, "Assinaturas dos fragmentos inválidas.", "INVALID_BLOCK_LIST");
  }
  if (!Array.isArray(body.partSizes) || body.partSizes.length !== body.blocks.length) {
    throw new HttpError(400, "Tamanhos dos fragmentos inválidos.", "INVALID_PART_SIZES");
  }
  if (body.partSizes.some(n => !Number.isInteger(Number(n)) || Number(n) <= 0 || Number(n) > maxBytes)) {
    throw new HttpError(400, "Tamanho de fragmento inválido.", "INVALID_PART_SIZE");
  }
  const sum = body.partSizes.reduce((acc, n) => acc + Number(n), 0);
  if (sum !== size) throw new HttpError(400, "Os fragmentos não correspondem ao tamanho da foto.", "PART_SIZE_MISMATCH");
  if (body.partSizes.length > 1 && body.partSizes.some(n => Number(n) <= 4 * 1024 * 1024)) {
    throw new HttpError(400, "Cada fragmento do TeraBox precisa ter mais de 4 MB.", "PART_TOO_SMALL");
  }
  for (const value of [body.width, body.height]) {
    if (value != null && (!Number.isInteger(Number(value)) || Number(value) <= 0 || Number(value) > 100000)) {
      throw new HttpError(400, "Dimensões da imagem inválidas.", "INVALID_IMAGE_DIMENSIONS");
    }
  }
}

async function handleUploadStart(request, env) {
  if (!env.UPLOAD_SESSION_SECRET) throw new HttpError(503, "UPLOAD_SESSION_SECRET não configurada.", "UPLOAD_SECRET_MISSING");
  const user = await verifyUser(request, env);
  const body = await readJson(request);
  validateUploadStart(body, env);
  const displayName = await getProfileName(env, user.id);
  const extension = sanitizeExtension(body.originalName, body.mimeType);
  const path = uniquePath(env.TERABOX_ROOT_DIR, extension);
  const token = await getTeraToken(env);
  const pre = await teraPrecreate(env, token, path, body.blocks);

  if (Number(pre.return_type) === 2 && pre.info?.fs_id) {
    const meta = await teraFileMetaWithRetry(env, token, pre.info.path || path).catch(() => null);
    const previewUrl = previewFromMeta(meta);
    const photo = await insertPhoto(env, {
      user_id: user.id,
      display_name: displayName,
      tera_fs_id: String(pre.info.fs_id),
      tera_path: pre.info.path || path,
      preview_url: previewUrl,
      preview_refreshed_at: previewUrl ? new Date().toISOString() : null,
      mime_type: body.mimeType,
      size_bytes: body.size,
      width: body.width || null,
      height: body.height || null,
      published: true,
    });
    return { alreadyExists: true, photo };
  }

  const partsToUpload = Array.isArray(pre.block_list) && pre.block_list.length ? pre.block_list.map(Number) : [0];
  const payload = {
    uid: user.id,
    displayName,
    path,
    uploadid: pre.uploadid,
    blocks: body.blocks,
    partSizes: body.partSizes.map(Number),
    partsToUpload,
    size: body.size,
    mimeType: body.mimeType,
    width: body.width || null,
    height: body.height || null,
    exp: Date.now() + 30 * 60_000,
  };
  return { session: await signUploadSession(payload, env.UPLOAD_SESSION_SECRET), partsToUpload };
}

async function handleUploadChunk(request, env, url) {
  if (!request.body) throw new HttpError(400, "Fragmento vazio.", "EMPTY_CHUNK");
  const session = await verifyUploadSession(getUploadToken(request), env.UPLOAD_SESSION_SECRET);
  const part = Number(url.searchParams.get("part"));
  if (!Number.isInteger(part) || part < 0 || part >= session.blocks.length || !session.partsToUpload.includes(part)) {
    throw new HttpError(400, "Número de fragmento inválido.", "INVALID_PART_INDEX");
  }

  const token = await getTeraToken(env);
  const params = new URLSearchParams({
    method: "upload",
    app_id: String(env.TERABOX_APP_ID || "250528"),
    path: session.path,
    uploadid: session.uploadid,
    partseq: String(part),
    access_tokens: token.accessToken,
  });
  // Fragmentos são mantidos em ~8 MiB no frontend. Usar FormData nativo aqui
  // evita incompatibilidades de servidores que não aceitam multipart em streaming.
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength !== Number(session.partSizes[part])) {
    throw new HttpError(400, "O tamanho do fragmento não corresponde ao esperado.", "CHUNK_SIZE_MISMATCH");
  }
  const form = new FormData();
  form.set("file", new Blob([bytes], { type: "application/octet-stream" }), `part-${part}.bin`);
  const response = await fetch(`${teraBase(token.uploadDomain)}/rest/2.0/pcs/superfile2?${params}`, {
    method: "POST",
    body: form,
  });
  const data = await response.json();
  if (!response.ok || Number(data.errno || 0) !== 0) {
    throw new HttpError(502, data.show_msg || `Falha ao enviar fragmento ${part + 1}.`, "TERABOX_CHUNK_ERROR", data);
  }
  if (data.md5 && String(data.md5).toLowerCase() !== String(session.blocks[part]).toLowerCase()) {
    throw new HttpError(502, "O TeraBox recebeu um fragmento diferente do original. Tente novamente.", "CHUNK_MD5_MISMATCH");
  }
  return { ok: true, part };
}

async function handleUploadFinish(request, env) {
  const session = await verifyUploadSession(getUploadToken(request), env.UPLOAD_SESSION_SECRET);

  // Torna a finalização idempotente. Se a resposta anterior se perdeu depois
  // de registrar a publicação, uma repetição devolve a mesma foto.
  const existing = await getPhotoByPath(env, session.path);
  if (existing) return { photo: existing, recovered: true };

  const token = await getTeraToken(env);
  let created;
  try {
    created = await teraCreate(env, token, session);
  } catch (error) {
    // Se o arquivo já foi criado no TeraBox, mas a resposta/registro no banco
    // falhou, recuperamos seus metadados pelo caminho e seguimos.
    if (Number(error?.details?.errno) !== -8) throw error;
    const recoveredMeta = await teraFileMetaWithRetry(env, token, session.path, 3);
    if (!recoveredMeta?.fs_id) throw error;
    created = { fs_id: recoveredMeta.fs_id, path: recoveredMeta.path || session.path };
  }

  const meta = await teraFileMetaWithRetry(env, token, created.path || session.path).catch(() => null);
  const previewUrl = previewFromMeta(meta);
  const photo = await insertPhoto(env, {
    user_id: session.uid,
    display_name: session.displayName,
    tera_fs_id: String(created.fs_id),
    tera_path: created.path || session.path,
    preview_url: previewUrl,
    preview_refreshed_at: previewUrl ? new Date().toISOString() : null,
    mime_type: session.mimeType,
    size_bytes: session.size,
    width: session.width || null,
    height: session.height || null,
    published: true,
  });
  return { photo };
}

async function handleThumbnail(request, env, photoId) {
  await verifyUser(request, env);
  const photo = await getPhotoRecord(env, photoId);
  const token = await getTeraToken(env);
  const meta = await teraFileMetaWithRetry(env, token, photo.tera_path, 3);
  const previewUrl = previewFromMeta(meta);
  if (!previewUrl) throw new HttpError(502, "O TeraBox ainda não gerou a prévia desta foto.", "THUMBNAIL_NOT_READY");
  await updatePreview(env, photoId, previewUrl);
  return { previewUrl };
}

async function handleOriginal(request, env, photoId) {
  await verifyUser(request, env);
  const photo = await getPhotoRecord(env, photoId);
  const token = await getTeraToken(env);
  const dlink = await teraDlink(env, token, photo.tera_fs_id);
  const upstream = await fetch(dlink, { headers: { "Accept": photo.mime_type || "image/*" } });
  if (!upstream.ok || !upstream.body) throw new HttpError(502, "Não foi possível carregar a foto original.", "ORIGINAL_FETCH_FAILED");
  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("Content-Type") || photo.mime_type || "application/octet-stream");
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("Content-Disposition", "inline");
  return new Response(upstream.body, { status: 200, headers });
}

async function handleAdmin(request, env, url) {
  assertAdmin(request, env);
  const vault = getVault(env);
  if (url.pathname === "/admin/terabox/status" && request.method === "GET") {
    const response = await vault.fetch("https://vault/status");
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json" } });
  }
  if (url.pathname === "/admin/terabox/exchange" && request.method === "POST") {
    const body = await readJson(request);
    const response = await vault.fetch("https://vault/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: body.code }) });
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json" } });
  }
  if (url.pathname === "/admin/terabox/disconnect" && request.method === "DELETE") {
    const response = await vault.fetch("https://vault/disconnect", { method: "DELETE" });
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json" } });
  }
  throw new HttpError(404, "Rota administrativa não encontrada.", "NOT_FOUND");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      assertOrigin(request, env);
      let result;

      if (url.pathname === "/api/health" && request.method === "GET") {
        result = json({ ok: true, service: "pedro-momentos-api" });
      } else if (url.pathname.startsWith("/admin/")) {
        result = await handleAdmin(request, env, url);
      } else if (url.pathname === "/api/uploads/start" && request.method === "POST") {
        result = json(await handleUploadStart(request, env));
      } else if (url.pathname === "/api/uploads/chunk" && request.method === "POST") {
        result = json(await handleUploadChunk(request, env, url));
      } else if (url.pathname === "/api/uploads/finish" && request.method === "POST") {
        result = json(await handleUploadFinish(request, env));
      } else {
        const thumbMatch = url.pathname.match(/^\/api\/photos\/([0-9a-f-]+)\/thumbnail$/i);
        const originalMatch = url.pathname.match(/^\/api\/photos\/([0-9a-f-]+)\/original$/i);
        if (thumbMatch && request.method === "POST") result = json(await handleThumbnail(request, env, thumbMatch[1]));
        else if (originalMatch && request.method === "GET") result = await handleOriginal(request, env, originalMatch[1]);
        else throw new HttpError(404, "Rota não encontrada.", "NOT_FOUND");
      }

      const headers = new Headers(result.headers);
      for (const [key, value] of Object.entries(cors)) headers.set(key, value);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Referrer-Policy", "no-referrer");
      return new Response(result.body, { status: result.status, headers });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const body = { error: error.message || "Erro interno.", code: error.code || "INTERNAL_ERROR" };
      if (error.details && status < 500) body.details = error.details;
      const response = json(body, status);
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(cors)) headers.set(key, value);
      return new Response(response.body, { status, headers });
    }
  },
};
