#!/usr/bin/env python3
"""Validate a plaintext Arcade P31 backup package without printing private row data."""
import argparse, datetime, hashlib, json, re
from pathlib import Path

TABLES = [
    "micro_arcade_players",
    "micro_arcade_play_sessions",
    "micro_arcade_score_submissions",
    "micro_arcade_best_scores",
    "micro_arcade_scoring_profiles",
    "micro_arcade_lb_policy",
    "micro_arcade_lb_sessions",
    "micro_arcade_lb_runs",
    "micro_arcade_lb_reviews",
]
HEX64 = re.compile(r"^[0-9a-f]{64}$")
MAX_BYTES = 50 * 1024 * 1024

def fail(message):
    raise SystemExit("P31 backup verification failed: " + message)

def ids(rows, field="id"):
    return {str(row.get(field, "")) for row in rows}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    args = parser.parse_args()
    path = Path(args.path)
    if not path.is_file():
        fail("backup file missing")
    size = path.stat().st_size
    if size <= 0 or size > MAX_BYTES:
        fail(f"backup size outside 1..{MAX_BYTES} bytes")
    try:
        package = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"invalid JSON ({exc.__class__.__name__})")

    if package.get("format") != "arcade-p31-offsite-v1":
        fail("unexpected format")
    if package.get("project_ref") != "hycegznamzjhwinegaai":
        fail("wrong canonical project")
    if package.get("snapshot_count") != 1:
        fail("snapshot_count must be exactly 1")
    if not HEX64.fullmatch(str(package.get("schema_sha256", ""))):
        fail("invalid package schema hash")
    excluded = package.get("excluded_transient")
    if not isinstance(excluded, list) or "micro_arcade_rate_limits" not in excluded:
        fail("transient exclusion contract missing")
    drill = package.get("restore_drill")
    if not isinstance(drill, dict) or drill.get("ok") is not True or drill.get("productionMutated") is not False:
        fail("database restore drill did not pass non-destructively")

    snapshot = package.get("snapshot")
    if not isinstance(snapshot, dict) or snapshot.get("verified") is not True:
        fail("verified snapshot missing")
    for field in ("schema_sha256", "payload_sha256"):
        if not HEX64.fullmatch(str(snapshot.get(field, ""))):
            fail(f"invalid {field}")
    if snapshot.get("schema_sha256") != package.get("schema_sha256"):
        fail("package/snapshot schema hash mismatch")
    payload = snapshot.get("payload")
    counts = snapshot.get("row_counts")
    if not isinstance(payload, dict) or not isinstance(counts, dict):
        fail("payload/counts missing")
    if set(payload) != set(TABLES) or set(counts) != set(TABLES):
        fail("durable table set mismatch")
    if "micro_arcade_rate_limits" in payload:
        fail("rate-limit state must never be backed up")

    total_rows = 0
    for table in TABLES:
        rows = payload.get(table)
        if not isinstance(rows, list):
            fail(f"{table} is not an array")
        if counts.get(table) != len(rows):
            fail(f"{table} row count mismatch")
        if any(not isinstance(row, dict) for row in rows):
            fail(f"{table} has a non-object row")
        total_rows += len(rows)

    players = ids(payload["micro_arcade_players"])
    play_sessions = ids(payload["micro_arcade_play_sessions"])
    score_sessions = {str(x.get("session_id", "")) for x in payload["micro_arcade_score_submissions"]}
    lb_sessions = ids(payload["micro_arcade_lb_sessions"])
    run_sessions = {str(x.get("session_id", "")) for x in payload["micro_arcade_lb_runs"]}
    runs = ids(payload["micro_arcade_lb_runs"])

    if play_sessions != score_sessions:
        fail("historical play-session set is not exactly submission-backed")
    if lb_sessions != run_sessions:
        fail("leaderboard session set is not exactly run-backed")
    if any(str(x.get("player_id", "")) not in players for x in payload["micro_arcade_score_submissions"]):
        fail("score submission references missing player")
    if any(str(x.get("player_id", "")) not in players for x in payload["micro_arcade_best_scores"]):
        fail("best score references missing player")
    if any(str(x.get("player_id", "")) not in players for x in payload["micro_arcade_lb_runs"]):
        fail("leaderboard run references missing player")
    if any(str(x.get("run_id", "")) not in runs for x in payload["micro_arcade_lb_reviews"]):
        fail("review references missing run")

    captured = snapshot.get("captured_at")
    if not isinstance(captured, str):
        fail("captured_at missing")
    try:
        captured_dt = datetime.datetime.fromisoformat(captured.replace("Z", "+00:00"))
        age = datetime.datetime.now(datetime.timezone.utc) - captured_dt.astimezone(datetime.timezone.utc)
    except Exception:
        fail("captured_at invalid")
    if age.total_seconds() < -300 or age.total_seconds() > 30 * 3600:
        fail("snapshot is not fresh enough for off-site retention")

    declared_bytes = int(snapshot.get("payload_bytes", 0))
    if declared_bytes <= 0 or declared_bytes > MAX_BYTES:
        fail("declared payload size outside safety bound")

    summary = {
        "ok": True,
        "format": package["format"],
        "snapshot_id": snapshot.get("id"),
        "captured_at": captured,
        "schema_sha256": snapshot["schema_sha256"],
        "payload_sha256": snapshot["payload_sha256"],
        "payload_bytes": declared_bytes,
        "transport_bytes": size,
        "total_rows": total_rows,
        "row_counts": counts,
        "restore_drill_ok": True,
        "excluded_transient": excluded,
        "transport_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }
    print(json.dumps(summary, separators=(",", ":")))

if __name__ == "__main__":
    main()
