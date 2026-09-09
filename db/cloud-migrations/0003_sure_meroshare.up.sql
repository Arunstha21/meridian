ALTER TABLE accounts ADD COLUMN external_source text;
ALTER TABLE accounts ADD COLUMN external_id text;
CREATE UNIQUE INDEX accounts_family_external_dedupe_idx
  ON accounts (family_id, external_source, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE categories ADD COLUMN external_source text;
ALTER TABLE categories ADD COLUMN external_id text;
CREATE UNIQUE INDEX categories_family_external_dedupe_idx
  ON categories (family_id, external_source, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE tags ADD COLUMN external_source text;
ALTER TABLE tags ADD COLUMN external_id text;
CREATE UNIQUE INDEX tags_family_external_dedupe_idx
  ON tags (family_id, external_source, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE mero_share_connections (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  client_id integer NOT NULL CHECK (client_id > 0),
  dp_code text NOT NULL,
  dp_name text NOT NULL,
  username_encrypted text NOT NULL,
  password_encrypted text NOT NULL,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX mero_share_connections_family_idx ON mero_share_connections (family_id);

CREATE TABLE mero_share_accounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  connection_id TEXT NOT NULL REFERENCES mero_share_connections(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  boid text NOT NULL CHECK (length(boid) = 16 AND boid NOT GLOB '*[^0-9]*'),
  name text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'NPR' CHECK (currency = 'NPR'),
  total_value_minor INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (connection_id, boid),
  UNIQUE (account_id)
);

CREATE TABLE mero_share_holdings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  mero_share_account_id TEXT NOT NULL REFERENCES mero_share_accounts(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  name text NOT NULL,
  quantity TEXT NOT NULL CHECK (CAST(quantity AS REAL) >= 0),
  market_price_minor INTEGER NOT NULL DEFAULT 0,
  market_value_minor INTEGER NOT NULL DEFAULT 0,
  cost_basis_minor INTEGER,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (mero_share_account_id, ticker)
);

CREATE TABLE mero_share_transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  mero_share_account_id TEXT NOT NULL REFERENCES mero_share_accounts(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  ticker text NOT NULL,
  name text NOT NULL,
  quantity TEXT NOT NULL,
  price_minor INTEGER,
  estimated_value_minor INTEGER,
  activity_label text NOT NULL,
  occurred_on date NOT NULL,
  description text,
  transaction_code text,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (mero_share_account_id, external_id)
);
