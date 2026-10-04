#!/usr/bin/env bash
set -euo pipefail
out="${1:-p33-ceremony-kit}"
repo="thiepn/arcade"
command -v gh >/dev/null
gh auth status >/dev/null
mkdir -p "$out"

run_id="$(gh api -X GET "repos/$repo/actions/workflows/p31-offsite-backup.yml/runs?status=success&per_page=20"   --jq '.workflow_runs | map(select(.head_branch=="main")) | .[0].id')"
if [[ -z "$run_id" || "$run_id" == "null" ]]; then
  echo "No successful main-branch P31 backup run found" >&2
  exit 69
fi

rm -rf "$out/source"
mkdir -p "$out/source"
gh run download "$run_id" -R "$repo" -n "arcade-p31-offsite-$run_id" -D "$out/source"
test -f "$out/source/manifest.json"
cms_count="$(find "$out/source" -maxdepth 1 -type f -name '*.cms' | wc -l | tr -d ' ')"
[[ "$cms_count" == "1" ]] || { echo "Expected exactly one P31 ciphertext in ceremony kit" >&2; exit 65; }
cms="$(find "$out/source" -maxdepth 1 -type f -name '*.cms' -print -quit)"
python3 - "$out/source/manifest.json" "$cms" <<'PY'
import hashlib,json,pathlib,sys
m=json.loads(pathlib.Path(sys.argv[1]).read_text())
actual=hashlib.sha256(pathlib.Path(sys.argv[2]).read_bytes()).hexdigest()
if m.get("verification_ok") is not True or m.get("ciphertext_sha256")!=actual:
    raise SystemExit("Ceremony kit P31 artifact verification failed")
print("P33 ceremony kit source verified: run",m.get("run_id"),"rows",m.get("total_rows"))
PY

echo "$run_id" > "$out/source-run-id.txt"
cat > "$out/README.txt" <<EOF
P33 offline-key ceremony kit
Source P31 run: $run_id

1. Keep the recovery private key OFF GitHub and OFF Supabase.
2. Start a disposable local PostgreSQL 17 database whose database name contains "p32" or "recovery".
3. Run:
   scripts/p33-offline-ceremony.sh "$cms" "$out/source/manifest.json" /secure/path/shared-recovery-private-key.pem "postgres://..." "$out/evidence"
4. Review evidence/attestation.json. It contains hashes/counts/timings only, not backup rows.
5. Run the command written to evidence/submit-command.txt to submit the signed proof to GitHub.
EOF

echo "P33 CEREMONY KIT — READY"
echo "Source run: $run_id"
echo "Directory: $out"
