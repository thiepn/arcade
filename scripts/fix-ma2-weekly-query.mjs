import { readFileSync, writeFileSync } from 'node:fs';

const path = 'worker/src/index.ts';
let source = readFileSync(path, 'utf8');
const oldText = `const WEEKLY_OVERALL_CTE = \`WITH weekly_best AS (\n  SELECT player_id, game_id, MAX(score) AS score, MIN(created_at) AS achieved_at\n  FROM score_submissions\n  WHERE created_at >= ? AND created_at < ?\n  GROUP BY player_id, game_id\n), totals AS (`;
const newText = `const WEEKLY_OVERALL_CTE = \`WITH ranked_weekly_submissions AS (\n  SELECT player_id, game_id, score, created_at,\n         ROW_NUMBER() OVER (PARTITION BY player_id, game_id ORDER BY score DESC, created_at ASC) AS game_rank\n  FROM score_submissions\n  WHERE created_at >= ? AND created_at < ?\n), weekly_best AS (\n  SELECT player_id, game_id, score, created_at AS achieved_at\n  FROM ranked_weekly_submissions\n  WHERE game_rank = 1\n), totals AS (`;
if (!source.includes(oldText)) throw new Error('Expected weekly CTE pattern not found');
source = source.replace(oldText, newText);
writeFileSync(path, source);
console.log('Weekly best-score tie-break query corrected');
