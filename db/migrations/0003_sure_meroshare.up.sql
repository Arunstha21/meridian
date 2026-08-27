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
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  client_id integer NOT NULL CHECK (client_id > 0),
  dp_code text NOT NULL,
  dp_name text NOT NULL,
  username_encrypted text NOT NULL,
  password_encrypted text NOT NULL,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mero_share_connections_family_idx ON mero_share_connections (family_id);

CREATE TABLE mero_share_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES mero_share_connections(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  boid text NOT NULL CHECK (boid ~ '^[0-9]{16}$'),
  name text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'NPR' CHECK (currency = 'NPR'),
  total_value_minor bigint NOT NULL DEFAULT 0,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, boid),
  UNIQUE (account_id)
);

CREATE TABLE mero_share_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mero_share_account_id uuid NOT NULL REFERENCES mero_share_accounts(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  name text NOT NULL,
  quantity numeric(24, 8) NOT NULL CHECK (quantity >= 0),
  market_price_minor bigint NOT NULL DEFAULT 0,
  market_value_minor bigint NOT NULL DEFAULT 0,
  cost_basis_minor bigint,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mero_share_account_id, ticker)
);

CREATE TABLE mero_share_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mero_share_account_id uuid NOT NULL REFERENCES mero_share_accounts(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  ticker text NOT NULL,
  name text NOT NULL,
  quantity numeric(24, 8) NOT NULL,
  price_minor bigint,
  estimated_value_minor bigint,
  activity_label text NOT NULL,
  occurred_on date NOT NULL,
  description text,
  transaction_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mero_share_account_id, external_id)
);
