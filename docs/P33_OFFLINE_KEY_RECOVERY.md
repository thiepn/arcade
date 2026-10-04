# P33 — Offline-Key Recovery Ceremony, Encrypted-Backup Restore Certification & Long-Term DR Assurance

Date: 2026-10-04.

## Purpose

P31 proves that Arcade continuously creates encrypted off-site backups. P32 proves that a fresh verified recovery payload can rebuild the full application stack in an isolated cold environment.

P33 closes the remaining trust gap: prove periodically that the **actual retained encrypted CMS artifact can be decrypted by the offline recovery private key**, restored exactly into a cold database, and cryptographically attested without ever placing that private key or plaintext backup in GitHub or Supabase.

The P33 trust chain is:

`retained P31 ciphertext → offline private key → local decrypt → P31 verifier → fresh local PostgreSQL restore → exact P32 hash/count checks → signed non-sensitive attestation → GitHub signature verification → recurring long-term assurance`.

## Private-key boundary

The production recovery private key remains outside:

- the Arcade repository;
- GitHub Actions;
- GitHub Secrets;
- Supabase;
- Supabase Edge Functions;
- P33 evidence artifacts.

P33 does not add a GitHub secret containing the private key.

The committed recovery certificate is the only public-key material GitHub needs. GitHub verifies the offline signature using that certificate.

If the private key is passphrase-protected, the local ceremony supports `P33_KEY_PASS_FILE`. The passphrase file is read locally and is never part of the attestation or submission.

## Preparing a ceremony kit

On the trusted operator machine:

```bash
scripts/p33-prepare-ceremony.sh p33-ceremony-kit
```

The helper uses the authenticated GitHub CLI to:

1. find the newest successful `P31 Encrypted Offsite Backup` run on `main`;
2. download exactly `arcade-p31-offsite-<run_id>`;
3. verify the ciphertext SHA-256 against its P31 manifest;
4. write a small local README with the source run and ceremony command.

The kit contains encrypted recovery data only. It contains no private key.

## Offline recovery ceremony

The ceremony requires:

- the downloaded P31 `.cms` file;
- its `manifest.json`;
- the offline recovery private key;
- a disposable local PostgreSQL target whose hostname is `localhost` or `127.0.0.1` and whose database name contains `p32` or `recovery`;
- Bun, Python 3 and OpenSSL.

Run:

```bash
scripts/p33-offline-ceremony.sh \
  p33-ceremony-kit/source/arcade-p31-....cms \
  p33-ceremony-kit/source/manifest.json \
  /secure/offline/shared-recovery-private-key.pem \
  'postgres://postgres:...@127.0.0.1:55433/arcade_p33_recovery' \
  p33-ceremony-kit/evidence
```

The script performs these checks in order:

1. verify the retained ciphertext SHA-256 before decryption;
2. derive the public key from the offline private key and require it to match the committed recovery certificate exactly;
3. decrypt CMS locally;
4. run the P31 plaintext backup verifier;
5. invoke the existing P32 cold-restore engine against the disposable database;
6. require exact source/restored schema SHA-256 equality;
7. require exact source/restored payload SHA-256 equality;
8. require exact row counts and relationship verification;
9. require transient rate-limit state to remain empty;
10. build a non-sensitive P33 attestation;
11. sign the exact attestation bytes with RSA-SHA256 using the offline recovery key;
12. immediately verify that signature locally with the public certificate;
13. remove the plaintext backup from the temporary working directory.

The resulting `evidence` directory contains only:

- `attestation.json`;
- `attestation.sig.b64`;
- `submit-command.txt`.

No backed-up row values are retained in that evidence directory.

## Signed attestation contents

The signed P33 document contains only recovery evidence:

- source P31 workflow run ID;
- backup capture time and snapshot ID;
- ciphertext SHA-256;
- source/restored payload SHA-256;
- source/restored schema SHA-256;
- protected row count;
- relationship/count success booleans;
- transient rate-limit count;
- `coldTarget=true`;
- `productionMutated=false`;
- `offlinePrivateKeyUsed=true`;
- recovery-certificate fingerprint;
- public-key SHA-256 derived from the private key;
- measured decrypt, restore and complete-ceremony durations;
- a random attestation nonce.

It does not contain players, credentials, sessions, scores, reviews or any other backup row content.

## Submitting proof to GitHub

The local script writes a ready-to-run command using:

`P33 Offline Ceremony Attestation`

The manual workflow accepts only:

- Base64 of the signed non-sensitive attestation;
- Base64 of the signature.

It does **not** accept a private key or plaintext backup.

The workflow then independently:

1. verifies the attestation contract;
2. verifies the RSA-SHA256 signature with the committed recovery certificate;
3. reads the signed source P31 run ID;
4. downloads the exact retained P31 Actions artifact from that run;
5. verifies the actual `.cms` bytes against the P31 manifest;
6. verifies run ID, capture time, row count, payload hash and schema hash against the signed attestation;
7. requires the source workflow to be a successful main-branch `P31 Encrypted Offsite Backup`;
8. persists the signed evidence into a dedicated closed GitHub issue.

The issue stores the exact attestation bytes and signature in hidden markers so future assurance runs can cryptographically re-verify them. This is a durable non-sensitive evidence ledger; it is not a backup.

## Long-term assurance policy

`P33 Long-Term DR Assurance` runs daily at 06:11 UTC, on relevant P33 changes, and manually.

P33 reports **READY** only while all of the following hold:

- latest successful P31 encrypted backup age ≤ 30 hours;
- latest successful P32 full-stack cold-recovery exercise age ≤ 8 days;
- latest successful P33 offline-attestation workflow age ≤ 90 days;
- signed offline ceremony completion age ≤ 90 days;
- persisted P33 signature re-verifies against the recovery certificate;
- persisted attestation still satisfies the P33 safety contract;
- recovery certificate has at least 180 days remaining before expiry.

If no real offline ceremony has ever been accepted, the state is:

`PENDING_OFFLINE_CEREMONY`

That state opens a dedicated P33 assurance issue. It is intentionally distinct from an application outage.

If any later layer expires or becomes invalid, the state becomes `DEGRADED` and the same issue reopens.

## Recommended ceremony cadence

The hard evidence ceiling is 90 days. Perform the real offline-key ceremony about every **60–75 days** so there is margin for travel, hardware problems, GitHub/Supabase outages or operator availability.

The daily assurance job will continue verifying the last signed proof between ceremonies.

## CI-only cryptographic drill

CI does not have the production recovery key.

Instead, `tests/p33-offline-ceremony-postgres.mjs` creates an **ephemeral CI-only RSA key/certificate**, then exercises the exact same technical ceremony:

- real P31 export package;
- CMS AES-256-GCM encryption;
- private-key/certificate match;
- CMS decryption;
- P31 package validation;
- brand-new PostgreSQL cold restore;
- exact schema/payload hashes;
- offline RSA signature;
- P33 signature verification;
- retained ciphertext binding.

The ephemeral test key is destroyed with the runner. Passing this test proves the procedure/software works; only a real operator ceremony can prove the actual offline recovery key works.

## Long-term evidence interpretation

P33 distinguishes:

1. **Backup availability** — P31.
2. **Automated full-stack recoverability** — P32.
3. **Actual offline-key decryptability** — P33.

All three must remain current for long-term DR assurance to be READY.

Measured ceremony or P32 recovery times are evidence, not contractual RTO guarantees.

## Security constraints

P33 must never:

- commit or upload the recovery private key;
- store it in GitHub Secrets for convenience;
- upload decrypted backup JSON;
- restore into the canonical production database as part of an automated drill;
- treat a CI-generated test key as proof of the production offline key;
- accept a signed attestation without independently binding it back to the retained P31 ciphertext;
- declare READY when the real offline ceremony is absent or older than 90 days.

## Current certification state

P33 implementation can be fully code-certified in CI without access to the private key.

However, the **real production-key certification is not complete until the first operator ceremony is performed and its signed attestation is accepted**.

Before that event, the correct operational state is `PENDING_OFFLINE_CEREMONY`, even when P31 and P32 are green.

## Exit criteria

P33 implementation is complete when:

- static/deterministic P33 gates pass;
- the real PostgreSQL + ephemeral-key ceremony integration passes;
- manual signed-attestation verification is merged;
- daily long-term assurance is merged;
- P31 and P32 remain healthy after deployment.

P33 operational certification is complete only when:

- a recent retained production P31 artifact is decrypted with the real offline key;
- that payload restores exactly into an isolated database;
- the real key signs the P33 attestation;
- GitHub verifies the signature and exact retained ciphertext;
- the signed evidence ledger is persisted;
- long-term assurance reports READY.
