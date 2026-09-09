CREATE TABLE recurring_series (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL,
  merchant text,
  amount_minor INTEGER NOT NULL,
  currency char(3) NOT NULL,
  category_id TEXT REFERENCES categories (id) ON DELETE SET NULL,
  frequency text NOT NULL CHECK (frequency IN ('monthly', 'weekly', 'yearly')),
  config TEXT NOT NULL DEFAULT '{}',
  next_due date NOT NULL,
  active INTEGER NOT NULL DEFAULT true,
  last_posted_entry_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX recurring_series_family_idx ON recurring_series (family_id);
CREATE INDEX recurring_series_due_idx ON recurring_series (active, next_due) WHERE active;

ALTER TABLE entries ADD COLUMN recurring_series_id TEXT REFERENCES recurring_series (id) ON DELETE SET NULL;
CREATE INDEX entries_recurring_idx ON entries (recurring_series_id);

CREATE TABLE budgets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories (id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  active INTEGER NOT NULL DEFAULT true,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX budgets_family_category_unique
  ON budgets (family_id, COALESCE(category_id, '00000000-0000-0000-0000-000000000000'))
  WHERE active;

CREATE TABLE saved_filters (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL,
  params TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX saved_filters_user_name_unique ON saved_filters (user_id, lower(name));

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content text NOT NULL DEFAULT '',
  tool_calls TEXT,
  tool_call_id text,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX chat_messages_family_user_created_idx ON chat_messages (family_id, user_id, created_at);
