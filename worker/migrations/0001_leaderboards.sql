CREATE TABLE players (
  id TEXT PRIMARY KEY,
  credential_hash TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'XX',
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE play_sessions (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX idx_play_sessions_player ON play_sessions(player_id, issued_at DESC);
CREATE INDEX idx_play_sessions_expiry ON play_sessions(expires_at);

CREATE TABLE score_submissions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  player_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES play_sessions(id) ON DELETE RESTRICT,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX idx_score_submissions_player ON score_submissions(player_id, created_at DESC);
CREATE INDEX idx_score_submissions_game ON score_submissions(game_id, created_at DESC);

CREATE TABLE best_scores (
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  achieved_at INTEGER NOT NULL,
  submissions INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (game_id, player_id),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX idx_best_scores_rank ON best_scores(game_id, score DESC, achieved_at ASC);
