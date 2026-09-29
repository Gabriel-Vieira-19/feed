import { buildAuthorizationUrl } from "./_lib/google-drive.js";
import { handleError, json, methodNotAllowed, requireAdmin } from "./_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    requireAdmin(req);
    return json(res, 200, { url: buildAuthorizationUrl() });
  } catch (error) {
    return handleError(res, error);
  }
}
