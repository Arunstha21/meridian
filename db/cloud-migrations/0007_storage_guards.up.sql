-- SQLite affinities are permissive. Reject non-integer/unsafe monetary values
-- and NULL identifiers even when writes bypass application validation.

CREATE TRIGGER families_storage_guard_insert
BEFORE INSERT ON families
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in families');
END;

CREATE TRIGGER families_storage_guard_update
BEFORE UPDATE ON families
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in families');
END;

CREATE TRIGGER users_storage_guard_insert
BEFORE INSERT ON users
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in users');
END;

CREATE TRIGGER users_storage_guard_update
BEFORE UPDATE ON users
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in users');
END;

CREATE TRIGGER sessions_storage_guard_insert
BEFORE INSERT ON sessions
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in sessions');
END;

CREATE TRIGGER sessions_storage_guard_update
BEFORE UPDATE ON sessions
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in sessions');
END;

CREATE TRIGGER auth_tokens_storage_guard_insert
BEFORE INSERT ON auth_tokens
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in auth_tokens');
END;

CREATE TRIGGER auth_tokens_storage_guard_update
BEFORE UPDATE ON auth_tokens
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in auth_tokens');
END;

CREATE TRIGGER invitations_storage_guard_insert
BEFORE INSERT ON invitations
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in invitations');
END;

CREATE TRIGGER invitations_storage_guard_update
BEFORE UPDATE ON invitations
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in invitations');
END;

CREATE TRIGGER categories_storage_guard_insert
BEFORE INSERT ON categories
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in categories');
END;

CREATE TRIGGER categories_storage_guard_update
BEFORE UPDATE ON categories
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in categories');
END;

CREATE TRIGGER tags_storage_guard_insert
BEFORE INSERT ON tags
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in tags');
END;

CREATE TRIGGER tags_storage_guard_update
BEFORE UPDATE ON tags
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in tags');
END;

CREATE TRIGGER accounts_storage_guard_insert
BEFORE INSERT ON accounts
WHEN (NEW.opening_balance_minor IS NOT NULL AND (typeof(NEW.opening_balance_minor) <> 'integer' OR NEW.opening_balance_minor < -9007199254740991 OR NEW.opening_balance_minor > 9007199254740991))
  OR NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in accounts');
END;

CREATE TRIGGER accounts_storage_guard_update
BEFORE UPDATE ON accounts
WHEN (NEW.opening_balance_minor IS NOT NULL AND (typeof(NEW.opening_balance_minor) <> 'integer' OR NEW.opening_balance_minor < -9007199254740991 OR NEW.opening_balance_minor > 9007199254740991))
  OR NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in accounts');
END;

CREATE TRIGGER account_shares_storage_guard_insert
BEFORE INSERT ON account_shares
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in account_shares');
END;

CREATE TRIGGER account_shares_storage_guard_update
BEFORE UPDATE ON account_shares
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in account_shares');
END;

CREATE TRIGGER entries_storage_guard_insert
BEFORE INSERT ON entries
WHEN (NEW.amount_minor IS NOT NULL AND (typeof(NEW.amount_minor) <> 'integer' OR NEW.amount_minor < -9007199254740991 OR NEW.amount_minor > 9007199254740991))
  OR NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in entries');
END;

CREATE TRIGGER entries_storage_guard_update
BEFORE UPDATE ON entries
WHEN (NEW.amount_minor IS NOT NULL AND (typeof(NEW.amount_minor) <> 'integer' OR NEW.amount_minor < -9007199254740991 OR NEW.amount_minor > 9007199254740991))
  OR NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in entries');
END;

CREATE TRIGGER transactions_storage_guard_insert
BEFORE INSERT ON transactions
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in transactions');
END;

CREATE TRIGGER transactions_storage_guard_update
BEFORE UPDATE ON transactions
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in transactions');
END;

CREATE TRIGGER valuations_storage_guard_insert
BEFORE INSERT ON valuations
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in valuations');
END;

CREATE TRIGGER valuations_storage_guard_update
BEFORE UPDATE ON valuations
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in valuations');
END;

CREATE TRIGGER transfers_storage_guard_insert
BEFORE INSERT ON transfers
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in transfers');
END;

CREATE TRIGGER transfers_storage_guard_update
BEFORE UPDATE ON transfers
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in transfers');
END;

CREATE TRIGGER exchange_rates_storage_guard_insert
BEFORE INSERT ON exchange_rates
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in exchange_rates');
END;

CREATE TRIGGER exchange_rates_storage_guard_update
BEFORE UPDATE ON exchange_rates
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in exchange_rates');
END;

CREATE TRIGGER balances_storage_guard_insert
BEFORE INSERT ON balances
WHEN (NEW.balance_minor IS NOT NULL AND (typeof(NEW.balance_minor) <> 'integer' OR NEW.balance_minor < -9007199254740991 OR NEW.balance_minor > 9007199254740991))
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in balances');
END;

CREATE TRIGGER balances_storage_guard_update
BEFORE UPDATE ON balances
WHEN (NEW.balance_minor IS NOT NULL AND (typeof(NEW.balance_minor) <> 'integer' OR NEW.balance_minor < -9007199254740991 OR NEW.balance_minor > 9007199254740991))
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in balances');
END;

CREATE TRIGGER audit_events_storage_guard_insert
BEFORE INSERT ON audit_events
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in audit_events');
END;

CREATE TRIGGER audit_events_storage_guard_update
BEFORE UPDATE ON audit_events
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in audit_events');
END;

CREATE TRIGGER debug_log_entries_storage_guard_insert
BEFORE INSERT ON debug_log_entries
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in debug_log_entries');
END;

CREATE TRIGGER debug_log_entries_storage_guard_update
BEFORE UPDATE ON debug_log_entries
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in debug_log_entries');
END;

CREATE TRIGGER jobs_storage_guard_insert
BEFORE INSERT ON jobs
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in jobs');
END;

CREATE TRIGGER jobs_storage_guard_update
BEFORE UPDATE ON jobs
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in jobs');
END;

CREATE TRIGGER recurring_series_storage_guard_insert
BEFORE INSERT ON recurring_series
WHEN (NEW.amount_minor IS NOT NULL AND (typeof(NEW.amount_minor) <> 'integer' OR NEW.amount_minor < -9007199254740991 OR NEW.amount_minor > 9007199254740991))
  OR NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in recurring_series');
END;

CREATE TRIGGER recurring_series_storage_guard_update
BEFORE UPDATE ON recurring_series
WHEN (NEW.amount_minor IS NOT NULL AND (typeof(NEW.amount_minor) <> 'integer' OR NEW.amount_minor < -9007199254740991 OR NEW.amount_minor > 9007199254740991))
  OR NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in recurring_series');
END;

CREATE TRIGGER budgets_storage_guard_insert
BEFORE INSERT ON budgets
WHEN (NEW.amount_minor IS NOT NULL AND (typeof(NEW.amount_minor) <> 'integer' OR NEW.amount_minor < -9007199254740991 OR NEW.amount_minor > 9007199254740991))
  OR NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in budgets');
END;

CREATE TRIGGER budgets_storage_guard_update
BEFORE UPDATE ON budgets
WHEN (NEW.amount_minor IS NOT NULL AND (typeof(NEW.amount_minor) <> 'integer' OR NEW.amount_minor < -9007199254740991 OR NEW.amount_minor > 9007199254740991))
  OR NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in budgets');
END;

CREATE TRIGGER saved_filters_storage_guard_insert
BEFORE INSERT ON saved_filters
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in saved_filters');
END;

CREATE TRIGGER saved_filters_storage_guard_update
BEFORE UPDATE ON saved_filters
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in saved_filters');
END;

CREATE TRIGGER chat_messages_storage_guard_insert
BEFORE INSERT ON chat_messages
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in chat_messages');
END;

CREATE TRIGGER chat_messages_storage_guard_update
BEFORE UPDATE ON chat_messages
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in chat_messages');
END;

CREATE TRIGGER mero_share_connections_storage_guard_insert
BEFORE INSERT ON mero_share_connections
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in mero_share_connections');
END;

CREATE TRIGGER mero_share_connections_storage_guard_update
BEFORE UPDATE ON mero_share_connections
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in mero_share_connections');
END;

CREATE TRIGGER mero_share_accounts_storage_guard_insert
BEFORE INSERT ON mero_share_accounts
WHEN (NEW.total_value_minor IS NOT NULL AND (typeof(NEW.total_value_minor) <> 'integer' OR NEW.total_value_minor < -9007199254740991 OR NEW.total_value_minor > 9007199254740991))
  OR NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in mero_share_accounts');
END;

CREATE TRIGGER mero_share_accounts_storage_guard_update
BEFORE UPDATE ON mero_share_accounts
WHEN (NEW.total_value_minor IS NOT NULL AND (typeof(NEW.total_value_minor) <> 'integer' OR NEW.total_value_minor < -9007199254740991 OR NEW.total_value_minor > 9007199254740991))
  OR NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in mero_share_accounts');
END;

CREATE TRIGGER mero_share_holdings_storage_guard_insert
BEFORE INSERT ON mero_share_holdings
WHEN (NEW.market_price_minor IS NOT NULL AND (typeof(NEW.market_price_minor) <> 'integer' OR NEW.market_price_minor < -9007199254740991 OR NEW.market_price_minor > 9007199254740991))
  OR (NEW.market_value_minor IS NOT NULL AND (typeof(NEW.market_value_minor) <> 'integer' OR NEW.market_value_minor < -9007199254740991 OR NEW.market_value_minor > 9007199254740991))
  OR (NEW.cost_basis_minor IS NOT NULL AND (typeof(NEW.cost_basis_minor) <> 'integer' OR NEW.cost_basis_minor < -9007199254740991 OR NEW.cost_basis_minor > 9007199254740991))
  OR NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in mero_share_holdings');
END;

CREATE TRIGGER mero_share_holdings_storage_guard_update
BEFORE UPDATE ON mero_share_holdings
WHEN (NEW.market_price_minor IS NOT NULL AND (typeof(NEW.market_price_minor) <> 'integer' OR NEW.market_price_minor < -9007199254740991 OR NEW.market_price_minor > 9007199254740991))
  OR (NEW.market_value_minor IS NOT NULL AND (typeof(NEW.market_value_minor) <> 'integer' OR NEW.market_value_minor < -9007199254740991 OR NEW.market_value_minor > 9007199254740991))
  OR (NEW.cost_basis_minor IS NOT NULL AND (typeof(NEW.cost_basis_minor) <> 'integer' OR NEW.cost_basis_minor < -9007199254740991 OR NEW.cost_basis_minor > 9007199254740991))
  OR NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in mero_share_holdings');
END;

CREATE TRIGGER mero_share_transactions_storage_guard_insert
BEFORE INSERT ON mero_share_transactions
WHEN (NEW.price_minor IS NOT NULL AND (typeof(NEW.price_minor) <> 'integer' OR NEW.price_minor < -9007199254740991 OR NEW.price_minor > 9007199254740991))
  OR (NEW.estimated_value_minor IS NOT NULL AND (typeof(NEW.estimated_value_minor) <> 'integer' OR NEW.estimated_value_minor < -9007199254740991 OR NEW.estimated_value_minor > 9007199254740991))
  OR NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in mero_share_transactions');
END;

CREATE TRIGGER mero_share_transactions_storage_guard_update
BEFORE UPDATE ON mero_share_transactions
WHEN (NEW.price_minor IS NOT NULL AND (typeof(NEW.price_minor) <> 'integer' OR NEW.price_minor < -9007199254740991 OR NEW.price_minor > 9007199254740991))
  OR (NEW.estimated_value_minor IS NOT NULL AND (typeof(NEW.estimated_value_minor) <> 'integer' OR NEW.estimated_value_minor < -9007199254740991 OR NEW.estimated_value_minor > 9007199254740991))
  OR NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in mero_share_transactions');
END;

CREATE TRIGGER chat_proposals_storage_guard_insert
BEFORE INSERT ON chat_proposals
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in chat_proposals');
END;

CREATE TRIGGER chat_proposals_storage_guard_update
BEFORE UPDATE ON chat_proposals
WHEN NEW.id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid stored value in chat_proposals');
END;
