ALTER TABLE users ADD COLUMN access_subject text;
CREATE UNIQUE INDEX users_access_subject_unique ON users (access_subject);
