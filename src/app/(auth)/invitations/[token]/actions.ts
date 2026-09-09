"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { loadActor, loadAccessIdentity, requestMeta, SESSION_COOKIE } from "@/server/auth/context";
import { usesCloudflareAccess } from "@/server/auth/access";
import {
  acceptInvitationForExistingUser,
  acceptInvitationWithNewAccount,
  acceptInvitationWithAccess
} from "@/server/domain/invitations";
import { createSession } from "@/server/security/session";
import { isProd } from "@/lib/env";
import { errors } from "@/lib/errors";
import { runAction, formValues, type ActionState } from "@/server/actions/runner";

const schema = z.object({
  token: z.string().min(10),
  name: z.string().optional(),
  password: z.string().optional()
});

export async function acceptInvitationAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  return runAction("invitation.accept", async () => {
    if (usesCloudflareAccess()) {
      const identity = await loadAccessIdentity();
      if (!identity) throw errors.unauthorized();
      const input = schema.parse(formValues(formData));
      const actor = await loadActor();
      await acceptInvitationWithAccess(
        getDb(),
        input.token,
        identity,
        input.name ?? actor?.name ?? identity.email
      );
      redirect("/");
    }
    const input = schema.parse(formValues(formData));
    const db = getDb();
    const actor = await loadActor();

    let userId: string;
    if (actor) {
      const res = await acceptInvitationForExistingUser(db, input.token, {
        id: actor.userId,
        email: actor.email
      });
      userId = res.userId;
    } else {
      if (!input.name || !input.password) {
        throw errors.validation("Name and password are required.");
      }
      const res = await acceptInvitationWithNewAccount(db, input.token, {
        name: input.name,
        password: input.password
      });
      userId = res.userId;
    }

    const meta = await requestMeta();
    const { token } = await createSession(db, userId, meta);
    const store = await cookies();
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
    redirect("/");
  });
}
