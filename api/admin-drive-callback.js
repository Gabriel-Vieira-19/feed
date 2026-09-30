import { connectDriveWithCode, getAppUrl, verifyOAuthState } from "./_lib/google-drive.js";

export default async function handler(req, res) {
  const code = String(req.query?.code || "");
  const state = String(req.query?.state || "");
  const oauthError = String(req.query?.error || "");

  try {
    if (oauthError) throw new Error(`O Google cancelou a autorização: ${oauthError}.`);
    verifyOAuthState(state);
    if (!code) throw new Error("Código de autorização ausente.");
    await connectDriveWithCode(code);
    res.statusCode = 302;
    res.setHeader("Location", `${getAppUrl()}/?admin=drive&connected=1`);
    res.end();
  } catch (error) {
    console.error(error);
    const message = encodeURIComponent(error.message || "Falha ao conectar Google Drive.");
    res.statusCode = 302;
    res.setHeader("Location", `${getAppUrl()}/?admin=drive&drive_error=${message}`);
    res.end();
  }
}
