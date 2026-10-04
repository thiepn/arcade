import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes, X509Certificate, createHash } from 'node:crypto';
import { certificateFingerprint } from './p33-recovery-core.mjs';

const manifest=JSON.parse(await readFile(process.env.P33_MANIFEST,'utf8'));
const summary=JSON.parse(await readFile(process.env.P33_PLAINTEXT_SUMMARY,'utf8'));
const restore=JSON.parse(await readFile(process.env.P33_RESTORE_REPORT,'utf8'));
const certPem=await readFile(process.env.P33_RECOVERY_CERT||'ops/p31-backup-recovery-cert.pem','utf8');
const privateKeyPublicSha256=process.env.P33_PRIVATE_KEY_PUBLIC_SHA256||'';
if(!/^[0-9a-f]{64}$/.test(privateKeyPublicSha256))throw new Error('P33 private-key public hash missing');
const totalRows=Object.values(restore.rowCounts||{}).reduce((a,b)=>a+Number(b||0),0);
const attestation={
  schemaVersion:1,
  phase:'P33',
  ceremonyVersion:'offline-key-v1',
  nonce:randomBytes(16).toString('hex'),
  completedAt:new Date().toISOString(),
  sourceRunId:Number(manifest.run_id),
  sourceCapturedAt:manifest.captured_at,
  sourceSnapshotId:summary.snapshot_id,
  ciphertextSha256:manifest.ciphertext_sha256,
  sourcePayloadSha256:summary.payload_sha256,
  sourceSchemaSha256:summary.schema_sha256,
  sourceTotalRows:Number(summary.total_rows),
  decryptedTransportSha256:summary.transport_sha256,
  restoredPayloadSha256:restore.restoredPayloadSha256,
  restoredSchemaSha256:restore.restoredSchemaSha256,
  restoredTotalRows:totalRows,
  countsMatch:restore.countsMatch===true,
  relationshipsOk:restore.relationshipsOk===true,
  transientRateLimits:Number(restore.transientRateLimits),
  coldTarget:restore.coldTarget===true,
  productionMutated:restore.productionMutated,
  offlinePrivateKeyUsed:true,
  recoveryCertificateFingerprint:certificateFingerprint(certPem),
  privateKeyPublicSha256,
  decryptDurationMs:Number(process.env.P33_DECRYPT_DURATION_MS),
  restoreDurationMs:Number(process.env.P33_RESTORE_DURATION_MS),
  fullCeremonyMs:Number(process.env.P33_FULL_DURATION_MS),
};
if(attestation.sourcePayloadSha256!==attestation.restoredPayloadSha256||attestation.sourceSchemaSha256!==attestation.restoredSchemaSha256||attestation.sourceTotalRows!==attestation.restoredTotalRows){
  throw new Error('P33 restore evidence does not exactly match decrypted source');
}
await writeFile(process.env.P33_ATTESTATION_OUT||'p33-attestation.json',JSON.stringify(attestation,null,2)+'\n');
console.log('P33 signed-attestation payload prepared for '+attestation.sourceTotalRows+' rows.');
