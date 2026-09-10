import { headers } from "next/headers";
import { getDb } from "@/server/db/client";
import { verifyApiKey } from "@/server/domain/api-keys";
import { loadActor, type Actor } from "./context";
import { DomainError } from "@/lib/errors";

export async function extractApiKeyFromRequest(requestHeaders: Headers): Promise<string | null> {
  const authHeader = requestHeaders.get("authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0] && parts[0].toLowerCase() === "bearer" && parts[1]) {
      return parts[1].trim();
    }
  }

  const xApiKey = requestHeaders.get("x-api-key");
  if (xApiKey) {
    return xApiKey.trim();
  }

  return null;
}

export async function authenticateApiRequest(req?: Request): Promise<Actor> {
  const reqHeaders = req ? req.headers : await headers();
  const token = await extractApiKeyFromRequest(reqHeaders);

  if (token) {
    const db = getDb();
    const actor = await verifyApiKey(db, token);
    if (!actor) {
      throw new DomainError("auth.invalid_api_key", "Invalid or revoked API key.", { status: 401 });
    }
    return actor;
  }

  // Fallback to active browser session (useful when testing in browser / dev)
  const sessionActor = await loadActor();
  if (sessionActor) {
    return sessionActor;
  }

  throw new DomainError(
    "auth.required",
    "Missing or invalid API key. Pass 'Authorization: Bearer <api_key>' or 'X-API-Key: <api_key>'.",
    { status: 401 }
  );
}
