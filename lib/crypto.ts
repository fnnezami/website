import { createHmac } from "crypto";
import { envServer as env } from "./env-server";

export function signPayload(payload: unknown) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return createHmac("sha256", env.N8N_HMAC_SECRET).update(body).digest("hex");
}
