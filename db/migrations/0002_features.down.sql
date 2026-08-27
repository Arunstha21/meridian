DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS saved_filters;
DROP TABLE IF EXISTS budgets;
DROP INDEX IF EXISTS entries_recurring_idx;
ALTER TABLE entries DROP COLUMN IF EXISTS recurring_series_id;
DROP TABLE IF EXISTS recurring_series;
