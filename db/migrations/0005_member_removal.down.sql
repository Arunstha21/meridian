DROP INDEX IF EXISTS users_family_active_idx;
ALTER TABLE users DROP COLUMN IF EXISTS removed_at;
