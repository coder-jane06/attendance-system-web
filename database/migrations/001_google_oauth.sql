-- Google Sign-In: link OAuth accounts and allow password-less users.
-- Run once: psql -U postgres -d attendance_db -f database/migrations/001_google_oauth.sql

ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub) WHERE google_sub IS NOT NULL;
