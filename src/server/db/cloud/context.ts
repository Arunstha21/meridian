import { AsyncLocalStorage } from "node:async_hooks";
import type { CloudDatabase } from "./client";

// The Worker entry and Next server bundles share one isolate but can contain
// separate module copies. This symbol keeps request context shared between them.
const key = Symbol.for("meridian.cloud.database-context");
const registry = globalThis as typeof globalThis & {
  [key]?: AsyncLocalStorage<CloudDatabase>;
};
export const cloudDatabaseContext = (registry[key] ??= new AsyncLocalStorage<CloudDatabase>());
