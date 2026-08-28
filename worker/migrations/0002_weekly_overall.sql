CREATE INDEX idx_score_submissions_weekly_overall
ON score_submissions(created_at, player_id, game_id, score DESC);
