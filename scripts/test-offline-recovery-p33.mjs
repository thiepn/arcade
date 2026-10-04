import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign, createVerify, X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assessLongTermAssurance, validateAttestation, verifyAttestationSignature } from './p33-recovery-core.mjs';

const dir=mkdtempSync(join(tmpdir(),'p33-core-'));
const key=join(dir,'key.pem'),cert=join(dir,'cert.pem');
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-subj','/CN=P33 Test','-days','3650'],{stdio:'ignore'});
const certPem=readFileSync(cert,'utf8');
const now=Date.now();
const base={
  schemaVersion:1,phase:'P33',ceremonyVersion:'offline-key-v1',nonce:'a'.repeat(32),
  completedAt:new Date(now-60_000).toISOString(),sourceRunId:123,sourceCapturedAt:new Date(now-120_000).toISOString(),
  sourceSnapshotId:'fixture',ciphertextSha256:'a'.repeat(64),sourcePayloadSha256:'b'.repeat(64),sourceSchemaSha256:'c'.repeat(64),
  sourceTotalRows:10,decryptedTransportSha256:'d'.repeat(64),restoredPayloadSha256:'b'.repeat(64),restoredSchemaSha256:'c'.repeat(64),
  restoredTotalRows:10,countsMatch:true,relationshipsOk:true,transientRateLimits:0,coldTarget:true,productionMutated:false,
  offlinePrivateKeyUsed:true,recoveryCertificateFingerprint:new X509Certificate(certPem).fingerprint256,
  privateKeyPublicSha256:'e'.repeat(64),decryptDurationMs:10,restoreDurationMs:20,fullCeremonyMs:40,
};
assert.equal(validateAttestation(base,{certPem,now}).ok,true);
assert.equal(validateAttestation({...base,productionMutated:true},{certPem,now}).ok,false);
const bytes=Buffer.from(JSON.stringify(base));
const sig=execFileSync('openssl',['dgst','-sha256','-sign',key],{input:bytes});
assert.equal(verifyAttestationSignature(bytes,sig,certPem),true);
assert.equal(verifyAttestationSignature(Buffer.from('tampered'),sig,certPem),false);
const runs={completed_at:new Date(now-3600_000).toISOString(),conclusion:'success'};
const assessment=assessLongTermAssurance({latestP31:runs,latestP32:runs,latestP33:runs,attestation:base,signatureValid:true,certPem,now});
assert.equal(assessment.ready,true);
assert.equal(assessment.status,'READY');
assert.equal(assessLongTermAssurance({latestP31:runs,latestP32:runs,latestP33:null,attestation:null,signatureValid:false,certPem,now}).status,'PENDING_OFFLINE_CEREMONY');
console.log('P33 OFFLINE RECOVERY CORE TEST — PASS');
