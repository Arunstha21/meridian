import { cloudMigrations } from "./migrations";
import type { CloudStorage } from "./client";

export async function migrateCloudStorage(storage: CloudStorage): Promise<void> {
  await storage.transaction(async () => {
    storage.sql.exec("CREATE TABLE IF NOT EXISTS cloud_schema_migrations (name TEXT PRIMARY KEY)");
    const applied = new Set(
      storage.sql
        .exec("SELECT name FROM cloud_schema_migrations")
        .toArray()
        .map((row) => row.name)
    );
    for (const migration of cloudMigrations) {
      if (applied.has(migration.name)) continue;
      storage.sql.exec(migration.sql);
      storage.sql.exec("INSERT INTO cloud_schema_migrations (name) VALUES (?)", migration.name);
    }
  });
}
