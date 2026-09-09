import assert from "node:assert/strict";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import worker from "../src/index.ts";
import { SCORING_PROFILES, RHYTHM_MODES, toArcadePoints } from "../../shared/scoring";
const sqlite = new Database(":memory:");
for (const path of ["0001_leaderboards.sql", "0002_weekly_overall.sql"])
  sqlite.exec(readFileSync(`worker/migrations/${path}`, "utf8"));
const golden = JSON.parse(readFileSync("balance-report/golden.json", "utf8"));
let checks = 0;
const eq = (a, b, label) => {
  checks++;
  assert.deepEqual(a, b, label);
};
for (const [i, v] of golden.filter((v) => v.version === 1).entries()) {
  const pid = `legacy-${i}`, sid = `legacy-session-${i}`;
  sqlite.run("INSERT INTO players VALUES(?,?,?,?,?,?)", [pid, `hash-${i}`, pid, "XX", 0, 0]);
  sqlite.run("INSERT INTO play_sessions VALUES(?,?,?,?,?,?)", [sid, pid, v.game, 0, 1e5, 1000]);
  sqlite.run("INSERT INTO score_submissions VALUES(?,?,?,?,?,?,?)", [`score-${i}`, sid, pid, v.game, v.raw, 1000, 1000]);
  sqlite.run("INSERT INTO best_scores VALUES(?,?,?,?,?)", [v.game, pid, v.raw, 1000, 1]);
}
sqlite.exec(readFileSync("worker/migrations/0003_scoring_v2.sql", "utf8"));
for (const [i, v] of golden.filter((v) => v.version === 1).entries()) {
  for (const table of ["best_scores", "score_submissions"]) {
    const row = sqlite.query(`SELECT score,raw_score,source_version FROM ${table} WHERE player_id=?`).get(`legacy-${i}`);
    eq(row, { score: v.points, raw_score: v.raw, source_version: 1 }, `${table} legacy vector ${i}`);
  }
}
sqlite.exec("DELETE FROM score_submissions;DELETE FROM best_scores;DELETE FROM play_sessions;DELETE FROM players;");

class Prepared {
  sql;
  params = [];
  constructor(sql) {
    this.sql = sql;
  }
  bind(...args) {
    this.params = args;
    return this;
  }
  first() {
    return sqlite.query(this.sql).get(...this.params);
  }
  all() {
    return { results: sqlite.query(this.sql).all(...this.params), success: true };
  }
  run() {
    const info = sqlite.query(this.sql).run(...this.params);
    return { success: true, meta: { changes: info.changes } };
  }
}
const env = { DB: { prepare: (s) => new Prepared(s), batch: (stmts) => sqlite.transaction(() => stmts.map((s) => s.run()))() }, ALLOWED_ORIGINS: "https://thiepn.dev", CREDENTIAL_PEPPER: "fixture-only-not-a-production-secret", GUEST_RATE_LIMITER: { limit: () => ({ success: true }) }, SESSION_RATE_LIMITER: { limit: () => ({ success: true }) }, SCORE_RATE_LIMITER: { limit: () => ({ success: true }) } };
let now = Date.UTC(2026, 8, 9, 12), credential = "";
const realNow = Date.now;
Date.now = () => now;
async function req(path, body, auth = credential) {
  const headers = { origin: "https://thiepn.dev" };
  if (auth)
    headers.authorization = `Bearer ${auth}`;
  if (body !== undefined)
    headers["content-type"] = "application/json";
  const res = await worker.fetch(new Request(`https://fixture.invalid${path}`, { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
  return { status: res.status, data: await res.json() };
}
try {
  credential = (await req("/v1/guest", {})).data.credential;
  const playerId = credential.split(".")[0];
  let modes = 0;
  for (const [id, p] of Object.entries(SCORING_PROFILES)) {
    const all = id === "rhythm" ? Object.keys(RHYTHM_MODES) : id === "airhockey" ? ["EASY", "MEDIUM", "HARD"] : ["standard"];
    for (const modeId of all) {
      const session = await req("/v1/sessions", { gameId: id, modeId, scoreVersion: 2 });
      eq(session.status, 201, "session created");
      now += 1000;
      const raw = (id === "rhythm" ? RHYTHM_MODES[modeId].anchors : p.anchors)[1];
      const result = await req("/v1/scores", { sessionId: session.data.session.id, modeId, scoreVersion: 2, score: raw, durationMs: 1000 });
      eq(result.status, 200, `${id}/${modeId} accepts raw score`);
      eq(result.data.score, toArcadePoints(id, raw, modeId), "server/browser identical AP");
      eq(result.data.scoreVersion, 2, "points version");
      const row = sqlite.query("SELECT score,raw_score,mode_id,source_version FROM score_submissions WHERE session_id=?").get(session.data.session.id);
      eq(row, { score: result.data.score, raw_score: raw, mode_id: modeId, source_version: 2 }, "native evidence saved");
      eq((await req("/v1/scores", { sessionId: session.data.session.id, modeId, scoreVersion: 2, score: raw, durationMs: 1000 })).status, 409, "replay rejected");
      modes++;
    }
  }
  eq(modes, 36, "all selectable modes covered");
  eq(sqlite.query("SELECT count(*) AS n FROM best_scores").get(), { n: 32 }, "mode switching never creates extra overall entries");
  const board = await req("/v1/leaderboards/overall");
  eq(board.data.scoreVersion, 2, "overall uses AP");
  const local = Object.fromEntries(sqlite.query("SELECT game_id,score FROM best_scores").all().map((r) => [r.game_id, r.score]));
  eq(board.data.userEntry.total_score, Object.values(local).reduce((s, v) => s + v, 0), "overall total matches saved points");
  eq(board.data.userEntry.games_played, 32, "32 cabinets not 36 modes");
  const weekly = await req("/v1/leaderboards/weekly");
  eq(weekly.data.userEntry.rating_score, board.data.userEntry.rating_score, "weekly and all-time same aggregation");
  const mismatch = (await req("/v1/sessions", { gameId: "airhockey", modeId: "MEDIUM", scoreVersion: 2 })).data.session;
  now += 1000;
  eq((await req("/v1/scores", { sessionId: mismatch.id, modeId: "HARD", scoreVersion: 2, score: 5000, durationMs: 1000 })).status, 422, "mode escalation rejected");
  eq((await req("/v1/scores", { sessionId: mismatch.id, score: 5000, durationMs: 1000 })).status, 422, "version downgrade rejected");
  eq((await req("/v1/scores", { sessionId: mismatch.id, modeId: "MEDIUM", scoreVersion: 2, score: 5000, durationMs: 1000 })).status, 200, "rejected mutation did not consume token");
  const legacy = (await req("/v1/sessions", { gameId: "chain" })).data.session;
  now += 1000;
  const old = await req("/v1/scores", { sessionId: legacy.id, score: 1400000, durationMs: 1000 });
  eq(old.status, 200, "cached v1 client accepted");
  eq(old.data.score, 6000, "cached v1 raw never mixed into v2 records");
  eq((await req("/v1/sessions", { gameId: "rhythm", modeId: "nonsense", scoreVersion: 2 })).status, 400, "unknown mode rejected");
  eq((await req("/v1/sessions", { gameId: "chain", scoreVersion: 3 })).status, 400, "future rules require supported backend");
  eq((await req("/v1/sessions", { gameId: "__proto__", scoreVersion: 2 })).status, 400, "prototype key rejected");
  const expired = (await req("/v1/sessions", { gameId: "stack", scoreVersion: 2 })).data.session;
  now += 21600001;
  eq((await req("/v1/scores", { sessionId: expired.id, score: 100, scoreVersion: 2, modeId: "standard", durationMs: 21600001 })).status, 410, "expired session rejected");
  console.log(`Scoring Worker PASS: ${checks} checks, 256 migrated legacy vectors in both tables, 36 authenticated mode submissions, replay/mismatch/expiry guards, rating parity.`);
} finally {
  Date.now = realNow;
  sqlite.close();
}
