-- Admin login OTP storage (second factor for the author/admin portal).
--
-- This table is read and written ONLY by the trusted server (the Vercel
-- serverless functions in /api, using the service role key). Row Level Security
-- is enabled with NO policies, so the anon and authenticated roles that the
-- browser uses can never select, insert, update or delete OTP state.
--
-- Re-runnable: uses CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS admin_login_otp (
  challenge_id uuid PRIMARY KEY,
  code_hash    text        NOT NULL,
  expires_at   timestamptz NOT NULL,
  attempts     integer     NOT NULL DEFAULT 0,
  max_attempts integer     NOT NULL DEFAULT 5,
  used         boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_login_otp_created_at_idx
  ON admin_login_otp (created_at DESC);

ALTER TABLE admin_login_otp ENABLE ROW LEVEL SECURITY;

-- Intentionally no policies are created. Only the service role (server side)
-- bypasses RLS, which is exactly what we want.
