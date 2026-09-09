-- S14: deactivate members instead of deleting them so owned accounts,
-- ledger entries, balances, and audit history survive removal.
ALTER TABLE users ADD COLUMN removed_at TEXT;

CREATE INDEX users_family_active_idx ON users (family_id) WHERE removed_at IS NULL;
