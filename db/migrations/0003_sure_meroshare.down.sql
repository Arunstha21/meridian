DROP TABLE IF EXISTS mero_share_transactions;
DROP TABLE IF EXISTS mero_share_holdings;
DROP TABLE IF EXISTS mero_share_accounts;
DROP TABLE IF EXISTS mero_share_connections;

DROP INDEX IF EXISTS tags_family_external_dedupe_idx;
ALTER TABLE tags DROP COLUMN IF EXISTS external_id;
ALTER TABLE tags DROP COLUMN IF EXISTS external_source;

DROP INDEX IF EXISTS categories_family_external_dedupe_idx;
ALTER TABLE categories DROP COLUMN IF EXISTS external_id;
ALTER TABLE categories DROP COLUMN IF EXISTS external_source;

DROP INDEX IF EXISTS accounts_family_external_dedupe_idx;
ALTER TABLE accounts DROP COLUMN IF EXISTS external_id;
ALTER TABLE accounts DROP COLUMN IF EXISTS external_source;
