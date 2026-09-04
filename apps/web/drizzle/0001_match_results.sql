CREATE TABLE IF NOT EXISTS custom_contest_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS match_results (
  match_id varchar(28) PRIMARY KEY,
  room_id varchar(6) NOT NULL,
  mode varchar(8) NOT NULL CHECK (mode = 'BO1'),
  limit_minutes integer NOT NULL,
  seed text NOT NULL,
  problem jsonb NOT NULL,
  started_at timestamptz NOT NULL,
  deadline_at timestamptz NOT NULL,
  decided_at timestamptz NOT NULL,
  outcome varchar(8) NOT NULL,
  winner_seat varchar(8),
  reason varchar(40) NOT NULL,
  detail text,
  participants jsonb NOT NULL,
  submissions jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS match_results_expires_at_idx ON match_results (expires_at);

INSERT INTO custom_contest_migrations(version)
VALUES ('0001_match_results')
ON CONFLICT (version) DO NOTHING;
