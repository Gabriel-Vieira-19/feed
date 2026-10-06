import { json } from "./_lib/http.js";
import { getDriveStatus } from "./_lib/google-drive.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Método não permitido." });
  try {
    const drive = await getDriveStatus();
    return json(res, 200, { ok: true, driveConnected: Boolean(drive.connected) });
  } catch {
    return json(res, 200, { ok: true, driveConnected: false });
  }
}
