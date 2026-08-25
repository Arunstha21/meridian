import type { Actor } from "../auth/context";
import { errors } from "@/lib/errors";

export function assertFamilyAdmin(actor: Actor): void {
  if (actor.familyRole !== "admin") {
    throw errors.forbidden("Only family admins can do that.");
  }
}

export function assertSuperAdmin(actor: Actor): void {
  if (actor.platformRole !== "super_admin") {
    throw errors.forbidden();
  }
}
