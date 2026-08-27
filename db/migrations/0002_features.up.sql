CREATE TABLE recurring_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL,
  merchant text,
  amount_minor bigint NOT NULL,
  currency char(3) NOT NULL,
  category_id uuid REFERENCES categories (id) ON DELETE SET NULL,
  frequency text NOT NULL CHECK (frequency IN ('monthly', 'weekly', 'yearly')),
  config jsonb NOT NULL DEFAULT '{}',
  next_due date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_posted_entry_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recurring_series_family_idx ON recurring_series (family_id);
CREATE INDEX recurring_series_due_idx ON recurring_series (active, next_due) WHERE active;

ALTER TABLE entries ADD COLUMN recurring_series_id uuid REFERENCES recurring_series (id) ON DELETE SET NULL;
CREATE INDEX entries_recurring_idx ON entries (recurring_series_id);

CREATE TABLE budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories (id) ON DELETE CASCADE,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX budgets_family_category_unique
  ON budgets (family_id, COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE active;

CREATE TABLE saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX saved_filters_user_name_unique ON saved_filters (user_id, lower(name));

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content text NOT NULL DEFAULT '',
  tool_calls jsonb,
  tool_call_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_family_user_created_idx ON chat_messages (family_id, user_id, created_at);
