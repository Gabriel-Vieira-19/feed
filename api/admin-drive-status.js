import { getDriveStatus } from "./_lib/google-drive.js";
import { handleError, json, methodNotAllowed, requireAdmin } from "./_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    requireAdmin(req);
    const status = await getDriveStatus();
    return json(res, 200, status);
  } catch (error) {
    return handleError(res, error);
  }
}
