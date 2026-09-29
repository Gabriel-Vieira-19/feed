import SparkMD5 from "spark-md5";
import { HttpError, json } from "./helpers.js";

const TOKEN_KEY = "terabox-token";

export class TeraTokenVault {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.refreshPromise = null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/exchange" && request.method === "POST") {
        const { code } = await request.json();
        const token = await this.exchangeCode(code);
        return json(this.publicToken(token));
      }
      if (url.pathname === "/token" && request.method === "GET") {
        const token = await this.ensureFresh();
        return json(token);
      }
      if (url.pathname === "/status" && request.method === "GET") {
        const stored = await this.ctx.storage.get(TOKEN_KEY);
        if (!stored) return json({ connected: false });
        try {
          const fresh = await this.ensureFresh();
          return json({ connected: true, ...this.publicToken(fresh) });
        } catch (error) {
          return json({ connected: true, needsReconnect: true, expiresAt: stored.expiresAt || null, error: error.message });
        }
      }
      if (url.pathname === "/disconnect" && request.method === "DELETE") {
        await this.ctx.storage.delete(TOKEN_KEY);
        return json({ ok: true });
      }
      return json({ error: "Not found" }, 404);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      return json({ error: error.message || "Erro TeraBox", code: error.code || "TERABOX_ERROR" }, status);
    }
  }

  publicToken(token) {
    return { expiresAt: token.expiresAt, apiDomain: token.apiDomain, uploadDomain: token.uploadDomain };
  }

  assertSecrets() {
    const names = ["TERABOX_CLIENT_ID", "TERABOX_CLIENT_SECRET", "TERABOX_PRIVATE_SECRET"];
    const missing = names.filter(name => !this.env[name]);
    if (missing.length) throw new HttpError(503, `Secrets TeraBox ausentes: ${missing.join(", ")}`, "TERABOX_SECRETS_MISSING");
  }

  sign(timestamp) {
    this.assertSecrets();
    return SparkMD5.hash(`${this.env.TERABOX_CLIENT_ID}_${timestamp}_${this.env.TERABOX_CLIENT_SECRET}_${this.env.TERABOX_PRIVATE_SECRET}`);
  }

  async exchangeCode(code) {
    this.assertSecrets();
    if (!code) throw new HttpError(400, "Código de autorização ausente.", "TERABOX_CODE_MISSING");
    const timestamp = Math.floor(Date.now() / 1000);
    const form = new FormData();
    form.set("client_id", this.env.TERABOX_CLIENT_ID);
    form.set("client_secret", this.env.TERABOX_CLIENT_SECRET);
    form.set("grant_type", "authorization_code");
    form.set("code", code);
    form.set("timestamp", String(timestamp));
    form.set("sign", this.sign(timestamp));

    const response = await fetch("https://www.terabox.com/oauth/gettoken", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok || Number(data.errno || 0) !== 0 || !data.data?.access_token) {
      throw new HttpError(502, data.show_msg || "O TeraBox recusou a autorização.", "TERABOX_EXCHANGE_FAILED", data);
    }
    const token = await this.enrichToken({
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt: Date.now() + Number(data.data.expires_in || 172800) * 1000,
    });
    await this.ctx.storage.put(TOKEN_KEY, token);
    return token;
  }

  async ensureFresh() {
    let token = await this.ctx.storage.get(TOKEN_KEY);
    if (!token) throw new HttpError(503, "A conta TeraBox ainda não foi conectada.", "TERABOX_NOT_CONNECTED");
    if (token.expiresAt && token.expiresAt - Date.now() > 5 * 60_000 && token.apiDomain && token.uploadDomain) return token;
    if (!this.refreshPromise) {
      this.refreshPromise = this.refresh(token).finally(() => { this.refreshPromise = null; });
    }
    return await this.refreshPromise;
  }

  async refresh(token) {
    this.assertSecrets();
    if (!token.refreshToken) throw new HttpError(503, "O TeraBox precisa ser reconectado.", "TERABOX_RECONNECT_REQUIRED");
    const timestamp = Math.floor(Date.now() / 1000);
    const form = new FormData();
    form.set("client_id", this.env.TERABOX_CLIENT_ID);
    form.set("client_secret", this.env.TERABOX_CLIENT_SECRET);
    form.set("refresh_token", token.refreshToken);
    form.set("timestamp", String(timestamp));
    form.set("sign", this.sign(timestamp));
    const response = await fetch("https://www.terabox.com/oauth/refreshtoken", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok || Number(data.errno || 0) !== 0 || !data.data?.access_token) {
      throw new HttpError(503, data.show_msg || "O TeraBox precisa ser reconectado.", "TERABOX_RECONNECT_REQUIRED", data);
    }
    const refreshed = await this.enrichToken({
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt: Date.now() + Number(data.data.expires_in || 172800) * 1000,
    });
    await this.ctx.storage.put(TOKEN_KEY, refreshed);
    return refreshed;
  }

  async enrichToken(token) {
    const form = new FormData();
    form.set("access_token", token.accessToken);
    const response = await fetch("https://www.terabox.com/oauth/tokeninfo", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok || Number(data.errno || 0) !== 0 || !data.data) {
      throw new HttpError(502, data.show_msg || "Não foi possível obter os domínios da conta TeraBox.", "TERABOX_TOKENINFO_FAILED", data);
    }
    const apiDomain = String(data.data.api_domain || "").trim();
    const uploadDomain = String(data.data.upload_domain || "").trim();
    if (!apiDomain || !uploadDomain) {
      throw new HttpError(502, "O TeraBox não retornou os domínios de API e upload esperados.", "TERABOX_TOKENINFO_DOMAINS_MISSING", data);
    }
    return {
      ...token,
      apiDomain,
      uploadDomain,
      userId: data.data.user_id || null,
    };
  }
}
