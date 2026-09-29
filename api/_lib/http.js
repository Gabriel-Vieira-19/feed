export function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  return json(res, 405, { error: "Método não permitido." });
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch { throw new Error("JSON inválido."); }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("JSON inválido.");
  }
}

export function getBearerToken(req) {
  const value = String(req.headers.authorization || "");
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? match[1].trim() : "";
}

export function requireAdmin(req) {
  const expected = String(process.env.ADMIN_KEY || "");
  const received = String(req.headers["x-admin-key"] || "");
  if (!expected || !received || received !== expected) {
    const error = new Error("Chave de administração inválida.");
    error.statusCode = 401;
    throw error;
  }
}

export function handleError(res, error, fallback = "Erro interno.") {
  const status = Number(error?.statusCode) || 500;
  const message = status >= 500 && !error?.expose ? (error?.message || fallback) : (error?.message || fallback);
  console.error(error);
  return json(res, status, { error: message });
}
