#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 5 ]]; then
  echo "Usage: $0 <encrypted-backup.cms> <manifest.json> <offline-private-key.pem> <local-recovery-postgres-url> <output-dir>" >&2
  exit 64
fi

encrypted="$1"
manifest="$2"
private_key="$3"
database_url="$4"
output_dir="$5"
root="$(cd "$(dirname "$0")/.." && pwd)"
cert="${P33_RECOVERY_CERT:-$root/ops/p31-backup-recovery-cert.pem}"

for file in "$encrypted" "$manifest" "$private_key" "$cert"; do
  test -f "$file" || { echo "Missing required file: $file" >&2; exit 66; }
done
command -v openssl >/dev/null
command -v python3 >/dev/null
command -v bun >/dev/null

mkdir -p "$output_dir"
chmod 700 "$output_dir" 2>/dev/null || true
tmp="$(mktemp -d)"
cleanup() {
  if [[ -f "$tmp/plaintext.json" ]]; then
    shred -u "$tmp/plaintext.json" 2>/dev/null || rm -f "$tmp/plaintext.json"
  fi
  rm -rf "$tmp"
}
trap cleanup EXIT INT TERM
umask 077

now_ms() {
  python3 - <<'PY'
import time
print(time.time_ns()//1_000_000)
PY
}

passin=()
if [[ -n "${P33_KEY_PASS_FILE:-}" ]]; then
  test -f "$P33_KEY_PASS_FILE" || { echo "P33_KEY_PASS_FILE does not exist" >&2; exit 66; }
  passin=(-passin "file:$P33_KEY_PASS_FILE")
fi

python3 - "$manifest" "$encrypted" <<'PY'
import hashlib,json,pathlib,sys
manifest=json.loads(pathlib.Path(sys.argv[1]).read_text())
cipher=pathlib.Path(sys.argv[2]).read_bytes()
actual=hashlib.sha256(cipher).hexdigest()
if manifest.get("format")!="arcade-p31-offsite-evidence-v1" or manifest.get("verification_ok") is not True:
    raise SystemExit("P33: source P31 manifest is not verified")
if actual!=manifest.get("ciphertext_sha256"):
    raise SystemExit("P33: ciphertext hash mismatch before decryption")
print("P33 retained ciphertext hash verified:",actual)
PY

openssl x509 -in "$cert" -pubkey -noout | openssl pkey -pubin -outform DER > "$tmp/cert-public.der"
openssl pkey -in "$private_key" "${passin[@]}" -pubout -outform DER > "$tmp/key-public.der"
cmp -s "$tmp/cert-public.der" "$tmp/key-public.der" || {
  echo "P33: offline private key does not match committed recovery certificate" >&2
  exit 65
}
private_public_sha="$(python3 - "$tmp/key-public.der" <<'PY'
import hashlib,pathlib,sys
print(hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest())
PY
)"

ceremony_start="$(now_ms)"
decrypt_start="$(now_ms)"
openssl cms -decrypt -binary -inform DER   -in "$encrypted"   -recip "$cert"   -inkey "$private_key" "${passin[@]}"   -out "$tmp/plaintext.json"
decrypt_end="$(now_ms)"

python3 "$root/scripts/p31-verify-offsite.py" "$tmp/plaintext.json" > "$tmp/plaintext-summary.json"
restore_start="$(now_ms)"
P32_DATABASE_URL="$database_url" P32_SOURCE="$tmp/plaintext.json" P32_REPORT_DIR="$tmp/p32-report"   bun "$root/scripts/p32-cold-restore.mjs"
restore_end="$(now_ms)"
ceremony_end="$(now_ms)"

P33_MANIFEST="$manifest" P33_PLAINTEXT_SUMMARY="$tmp/plaintext-summary.json" P33_RESTORE_REPORT="$tmp/p32-report/restore.json" P33_RECOVERY_CERT="$cert" P33_PRIVATE_KEY_PUBLIC_SHA256="$private_public_sha" P33_DECRYPT_DURATION_MS="$((decrypt_end-decrypt_start))" P33_RESTORE_DURATION_MS="$((restore_end-restore_start))" P33_FULL_DURATION_MS="$((ceremony_end-ceremony_start))" P33_ATTESTATION_OUT="$output_dir/attestation.json"   bun "$root/scripts/p33-build-attestation.mjs"

openssl dgst -sha256 -sign "$private_key" "${passin[@]}"   -out "$tmp/attestation.sig" "$output_dir/attestation.json"
python3 - "$tmp/attestation.sig" "$output_dir/attestation.sig.b64" <<'PY'
import base64,pathlib,sys
pathlib.Path(sys.argv[2]).write_text(base64.b64encode(pathlib.Path(sys.argv[1]).read_bytes()).decode()+"\n")
PY

P33_RECOVERY_CERT="$cert"   bun "$root/scripts/p33-verify-attestation.mjs"     "$output_dir/attestation.json" "$output_dir/attestation.sig.b64" "$cert"

python3 - "$output_dir/attestation.json" "$output_dir/attestation.sig.b64" "$output_dir/submit-command.txt" <<'PY'
import base64,pathlib,shlex,sys
att=base64.b64encode(pathlib.Path(sys.argv[1]).read_bytes()).decode()
sig=pathlib.Path(sys.argv[2]).read_text().strip()
cmd=(
  "gh workflow run p33-offline-attestation.yml -R thiepn/arcade "
  + "-f attestation_b64="+shlex.quote(att)+" "
  + "-f signature_b64="+shlex.quote(sig)
)
pathlib.Path(sys.argv[3]).write_text(cmd+"\n")
PY

echo "P33 OFFLINE-KEY RECOVERY CEREMONY — PASS"
echo "Private key remained local. Plaintext is removed on exit."
echo "Evidence: $output_dir/attestation.json"
echo "Signature: $output_dir/attestation.sig.b64"
echo "Submit with: $output_dir/submit-command.txt"
