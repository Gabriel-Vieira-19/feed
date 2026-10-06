import { handleError, json, methodNotAllowed } from "../server/http.js";
import { requireUser } from "../server/supabase-admin.js";

const MAX_CHUNK_BYTES = 3 * 1024 * 1024 + 64 * 1024;

function validateSessionUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    const error = new Error("Sessão de upload inválida.");
    error.statusCode = 400;
    throw error;
  }

  const validHost = url.hostname === "www.googleapis.com";
  const validPath = url.pathname === "/upload/drive/v3/files";
  const validType = url.searchParams.get("uploadType") === "resumable";
  const hasUploadId = Boolean(url.searchParams.get("upload_id"));

  if (url.protocol !== "https:" || !validHost || !validPath || !validType || !hasUploadId) {
    const error = new Error("Sessão de upload inválida.");
    error.statusCode = 400;
    throw error;
  }
  return url.toString();
}

async function readBinary(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  if (req.body instanceof Uint8Array) return Buffer.from(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function parseReceivedEnd(rangeValue) {
  const match = /bytes=0-(\d+)/i.exec(String(rangeValue || ""));
  return match ? Number(match[1]) : null;
}

export default async function handler(req, res) {
  if (req.method !== "PUT") return methodNotAllowed(res, ["PUT"]);

  try {
    await requireUser(req);
    const sessionUrl = validateSessionUrl(req.headers["x-drive-session-url"]);
    const contentRange = String(req.headers["content-range"] || "").trim();
    if (!contentRange.startsWith("bytes ")) {
      const error = new Error("Faixa do upload inválida.");
      error.statusCode = 400;
      throw error;
    }

    const isStatusQuery = /^bytes \*\/(\d+)$/.test(contentRange);
    const body = isStatusQuery ? Buffer.alloc(0) : await readBinary(req);
    if (body.length > MAX_CHUNK_BYTES) {
      const error = new Error("Bloco de upload grande demais.");
      error.statusCode = 413;
      throw error;
    }

    const headers = { "Content-Range": contentRange };
    if (!isStatusQuery) {
      headers["Content-Type"] = String(req.headers["content-type"] || "application/octet-stream");
      headers["Content-Length"] = String(body.length);
    }

    const googleResponse = await fetch(sessionUrl, {
      method: "PUT",
      headers,
      body: isStatusQuery ? undefined : body,
    });

    if (googleResponse.status === 200 || googleResponse.status === 201) {
      const metadata = await googleResponse.json().catch(() => ({}));
      return json(res, 200, { complete: true, metadata });
    }

    if (googleResponse.status === 308) {
      const end = parseReceivedEnd(googleResponse.headers.get("Range"));
      return json(res, 200, {
        complete: false,
        next: end == null ? 0 : end + 1,
      });
    }

    if (googleResponse.status === 404) {
      const error = new Error("A sessão de upload expirou. Tente publicar novamente.");
      error.statusCode = 409;
      throw error;
    }

    const text = await googleResponse.text().catch(() => "");
    const error = new Error(text || `Google Drive respondeu ${googleResponse.status}.`);
    error.statusCode = googleResponse.status >= 500 ? 502 : 400;
    throw error;
  } catch (error) {
    return handleError(res, error);
  }
}
