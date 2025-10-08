import { createHmac } from "crypto";
import { env } from "./env";

export function signPayload(payload: unknown) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return createHmac("sha256", env.N8N_HMAC_SECRET).update(body).digest("hex");
}
