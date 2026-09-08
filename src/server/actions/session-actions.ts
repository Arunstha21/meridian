"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { loadActor, SESSION_COOKIE } from "@/server/auth/context";
import { revokeSession } from "@/server/security/session";
import { getUserPrivacyMode, setUserPreference } from "@/server/domain/users";

export async function signOutAction(): Promise<void> {
  const db = getDb();
  const actor = await loadActor();
  if (actor) {
    await revokeSession(db, actor.sessionId);
  }
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/sign-in");
}

export async function togglePrivacyAction(): Promise<void> {
  const db = getDb();
  const actor = await loadActor();
  if (!actor) return;
  const current = await getUserPrivacyMode(db, actor.userId);
  await setUserPreference(db, actor.userId, "privacy_mode", !current);
  revalidatePath("/", "layout");
}

export async function setThemePreferenceAction(theme: "light" | "dark" | "system"): Promise<void> {
  if (theme !== "light" && theme !== "dark" && theme !== "system") return;
  const store = await cookies();
  store.set("theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const actor = await loadActor();
  if (actor) {
    await setUserPreference(getDb(), actor.userId, "theme", theme);
  }
}
