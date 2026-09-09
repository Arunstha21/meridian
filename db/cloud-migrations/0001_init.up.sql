CREATE TABLE families (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  name text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  locale text NOT NULL DEFAULT 'en',
  timezone text NOT NULL DEFAULT 'Etc/UTC',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  family_role text NOT NULL DEFAULT 'member' CHECK (family_role IN ('admin', 'member')),
  platform_role text NOT NULL DEFAULT 'user' CHECK (platform_role IN ('user', 'super_admin')),
  email_verified_at TEXT,
  preferences TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE INDEX users_family_idx ON users (family_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  ip text,
  user_agent text,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE auth_tokens (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX auth_tokens_user_purpose_idx ON auth_tokens (user_id, purpose);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  email text NOT NULL,
  family_role text NOT NULL DEFAULT 'member' CHECK (family_role IN ('admin', 'member')),
  token_hash text NOT NULL UNIQUE,
  invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX invitations_family_idx ON invitations (family_id);

CREATE TABLE categories (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  color text,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX categories_family_name_unique ON categories (family_id, lower(name));
CREATE INDEX categories_parent_idx ON categories (parent_id);

CREATE TABLE tags (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX tags_family_name_unique ON tags (family_id, lower(name));

CREATE TABLE accounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('depository', 'credit_card', 'other_asset', 'other_liability')),
  subtype text,
  name text NOT NULL,
  institution text,
  currency char(3) NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'disabled')),
  included_in_reports INTEGER NOT NULL DEFAULT true,
  opening_balance_minor INTEGER NOT NULL DEFAULT 0,
  opened_on date NOT NULL DEFAULT current_date,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX accounts_family_idx ON accounts (family_id);

CREATE TABLE account_shares (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('full_control', 'read_write', 'read_only')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (account_id, user_id)
);

CREATE TABLE entries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  parent_entry_id TEXT REFERENCES entries(id) ON DELETE CASCADE,
  date date NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency char(3) NOT NULL,
  name text NOT NULL,
  notes text,
  external_source text,
  external_id text,
  entryable_type text NOT NULL CHECK (entryable_type IN ('transaction', 'valuation')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX entries_account_date_idx ON entries (account_id, date DESC, id DESC);
CREATE INDEX entries_parent_idx ON entries (parent_entry_id);
CREATE UNIQUE INDEX entries_external_dedupe_idx ON entries (account_id, external_source, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  entry_id TEXT NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  merchant text,
  transfer_id TEXT REFERENCES transfers(id) ON DELETE SET NULL
);

CREATE TABLE valuations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  entry_id TEXT NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'current' CHECK (kind IN ('opening', 'reconciliation', 'current'))
);

CREATE TABLE transfers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  outflow_entry_id TEXT NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE,
  inflow_entry_id TEXT NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (outflow_entry_id <> inflow_entry_id)
);

CREATE TABLE transaction_tags (
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);
CREATE INDEX transaction_tags_tag_idx ON transaction_tags (tag_id);


CREATE INDEX transactions_transfer_idx ON transactions (transfer_id);
CREATE INDEX transactions_category_idx ON transactions (category_id);

CREATE TABLE exchange_rates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  base_currency char(3) NOT NULL,
  quote_currency char(3) NOT NULL,
  rate TEXT NOT NULL,
  quoted_on date NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (base_currency, quote_currency, quoted_on),
  CONSTRAINT exchange_rates_positive CHECK (CAST(rate AS REAL) > 0)
);
CREATE INDEX exchange_rates_pair_date_idx ON exchange_rates (base_currency, quote_currency, quoted_on DESC);

CREATE TABLE balances (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  as_of date NOT NULL,
  balance_minor INTEGER NOT NULL,
  currency char(3) NOT NULL,
  PRIMARY KEY (account_id, as_of)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX audit_events_family_created_idx ON audit_events (family_id, created_at DESC);

CREATE TABLE debug_log_entries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  category text NOT NULL,
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message text NOT NULL,
  source text,
  provider_key text,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX debug_log_entries_created_idx ON debug_log_entries (created_at DESC);
CREATE INDEX debug_log_entries_category_idx ON debug_log_entries (category, created_at DESC);

CREATE TABLE feature_flags (
  key text PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE rate_limit_counters (
  bucket_key text NOT NULL,
  window_started_at TEXT NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_started_at)
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  queue text NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  dedupe_key text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'dead')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  run_after TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  locked_at TEXT,
  locked_by text,
  last_error text,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX jobs_dedupe_active_idx ON jobs (queue, dedupe_key) WHERE status = 'pending' AND dedupe_key IS NOT NULL;
CREATE INDEX jobs_claim_idx ON jobs (status, run_after) WHERE status = 'pending';
CREATE INDEX jobs_recent_idx ON jobs (created_at DESC);

CREATE TABLE cron_schedules (
  key text PRIMARY KEY,
  queue text NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  cron text NOT NULL,
  next_run_at TEXT NOT NULL,
  last_run_at TEXT,
  enabled INTEGER NOT NULL DEFAULT true
);

