import { getDriveStatus } from "../server/google-drive.js";
import { handleError, json, methodNotAllowed, requireAdmin } from "../server/http.js";

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
