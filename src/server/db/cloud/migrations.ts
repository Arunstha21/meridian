import migration6 from "../../../../db/cloud-migrations/0007_storage_guards.up.sql";
// Cloud migrations are bundled into the Worker; no runtime filesystem access.
import migration0 from "../../../../db/cloud-migrations/0001_init.up.sql";
import migration1 from "../../../../db/cloud-migrations/0002_features.up.sql";
import migration2 from "../../../../db/cloud-migrations/0003_sure_meroshare.up.sql";
import migration3 from "../../../../db/cloud-migrations/0004_chat_proposals.up.sql";
import migration4 from "../../../../db/cloud-migrations/0005_member_removal.up.sql";
import migration5 from "../../../../db/cloud-migrations/0006_cloudflare_access.up.sql";

export const cloudMigrations = [
  { name: "0001_init", sql: migration0 },
  { name: "0002_features", sql: migration1 },
  { name: "0003_sure_meroshare", sql: migration2 },
  { name: "0004_chat_proposals", sql: migration3 },
  { name: "0005_member_removal", sql: migration4 },
  { name: "0006_cloudflare_access", sql: migration5 },
  { name: "0007_storage_guards", sql: migration6 }
];
