import { X509Certificate, createHash, verify as cryptoVerify } from 'node:crypto';

export const P33_CEREMONY_MAX_ACCEPT_AGE_MS = 24 * 60 * 60 * 1000;
export const P33_ASSURANCE_MAX_CEREMONY_AGE_MS = 90 * 24 * 60 * 60 * 1000;
export const P33_MAX_BACKUP_AGE_MS = 30 * 60 * 60 * 1000;
export const P33_MAX_P32_AGE_MS = 8 * 24 * 60 * 60 * 1000;
export const P33_MIN_CERT_VALIDITY_MS = 180 * 24 * 60 * 60 * 1000;

export function normalizeFingerprint(value='') {
  return String(value).replace(/:/g,'').trim().toLowerCase();
}
export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
export function certificateFingerprint(certPem) {
  return normalizeFingerprint(new X509Certificate(certPem).fingerprint256);
}
export function certificateValidUntil(certPem) {
  return Date.parse(new X509Certificate(certPem).validTo);
}
export function verifyAttestationSignature(attestationBytes, signatureBytes, certPem) {
  return cryptoVerify('sha256', attestationBytes, new X509Certificate(certPem).publicKey, signatureBytes);
}
export function parseTime(value) {
  const ms=Date.parse(value||'');
  return Number.isFinite(ms)?ms:null;
}
export function validateAttestation(attestation,{certPem,now=Date.now(),maxAgeMs=P33_CEREMONY_MAX_ACCEPT_AGE_MS}={}) {
  const errors=[];
  const hex64=/^[0-9a-f]{64}$/;
  const need=(condition,message)=>{if(!condition)errors.push(message);};
  need(attestation?.schemaVersion===1,'schemaVersion must be 1');
  need(attestation?.phase==='P33','phase must be P33');
  need(attestation?.ceremonyVersion==='offline-key-v1','ceremonyVersion mismatch');
  need(Number.isInteger(attestation?.sourceRunId)&&attestation.sourceRunId>0,'sourceRunId must be a positive integer');
  for(const field of ['ciphertextSha256','sourcePayloadSha256','sourceSchemaSha256','restoredPayloadSha256','restoredSchemaSha256','decryptedTransportSha256','privateKeyPublicSha256']){
    need(hex64.test(String(attestation?.[field]||'')),field+' must be lowercase SHA-256 hex');
  }
  need(attestation?.sourcePayloadSha256===attestation?.restoredPayloadSha256,'restored payload hash must equal source');
  need(attestation?.sourceSchemaSha256===attestation?.restoredSchemaSha256,'restored schema hash must equal source');
  need(Number.isInteger(attestation?.sourceTotalRows)&&attestation.sourceTotalRows>0,'sourceTotalRows must be positive');
  need(attestation?.restoredTotalRows===attestation?.sourceTotalRows,'restoredTotalRows must equal sourceTotalRows');
  need(attestation?.countsMatch===true,'countsMatch must be true');
  need(attestation?.relationshipsOk===true,'relationshipsOk must be true');
  need(attestation?.transientRateLimits===0,'transient rate limits must restore empty');
  need(attestation?.coldTarget===true,'coldTarget must be true');
  need(attestation?.productionMutated===false,'productionMutated must be false');
  need(attestation?.offlinePrivateKeyUsed===true,'offlinePrivateKeyUsed must be true');
  need(Number.isFinite(attestation?.decryptDurationMs)&&attestation.decryptDurationMs>=0,'decryptDurationMs invalid');
  need(Number.isFinite(attestation?.restoreDurationMs)&&attestation.restoreDurationMs>=0,'restoreDurationMs invalid');
  need(Number.isFinite(attestation?.fullCeremonyMs)&&attestation.fullCeremonyMs>=0,'fullCeremonyMs invalid');

  const captured=parseTime(attestation?.sourceCapturedAt);
  const completed=parseTime(attestation?.completedAt);
  need(captured!==null,'sourceCapturedAt invalid');
  need(completed!==null,'completedAt invalid');
  if(captured!==null&&completed!==null)need(completed>=captured,'ceremony cannot predate backup capture');
  if(completed!==null){
    need(completed<=now+5*60*1000,'ceremony timestamp is in the future');
    need(now-completed<=maxAgeMs,'ceremony attestation is too old for this validation');
  }
  if(certPem){
    need(normalizeFingerprint(attestation?.recoveryCertificateFingerprint)===certificateFingerprint(certPem),'recovery certificate fingerprint mismatch');
  }
  return {ok:errors.length===0,errors};
}
export function assessLongTermAssurance({latestP31,latestP32,latestP33,attestation,signatureValid,certPem,now=Date.now()}) {
  const age=(run)=>{const t=parseTime(run?.completed_at||run?.updated_at||run?.created_at);return t===null?null:Math.max(0,now-t);};
  const p31AgeMs=age(latestP31);
  const p32AgeMs=age(latestP32);
  const p33RunAgeMs=age(latestP33);
  const ceremonyTime=parseTime(attestation?.completedAt);
  const ceremonyAgeMs=ceremonyTime===null?null:Math.max(0,now-ceremonyTime);
  const certValidUntil=certPem?certificateValidUntil(certPem):null;
  const certRemainingMs=certValidUntil===null?null:certValidUntil-now;
  const attestationValidation=attestation?validateAttestation(attestation,{certPem,now,maxAgeMs:P33_ASSURANCE_MAX_CEREMONY_AGE_MS}):{ok:false,errors:['no signed ceremony evidence']};
  const checks={
    p31Fresh:p31AgeMs!==null&&p31AgeMs<=P33_MAX_BACKUP_AGE_MS&&latestP31?.conclusion==='success',
    p32Fresh:p32AgeMs!==null&&p32AgeMs<=P33_MAX_P32_AGE_MS&&latestP32?.conclusion==='success',
    p33WorkflowFresh:p33RunAgeMs!==null&&p33RunAgeMs<=P33_ASSURANCE_MAX_CEREMONY_AGE_MS&&latestP33?.conclusion==='success',
    ceremonyFresh:ceremonyAgeMs!==null&&ceremonyAgeMs<=P33_ASSURANCE_MAX_CEREMONY_AGE_MS,
    signatureValid:signatureValid===true,
    attestationValid:attestationValidation.ok,
    certificateHealthy:certRemainingMs!==null&&certRemainingMs>=P33_MIN_CERT_VALIDITY_MS,
  };
  return {
    ready:Object.values(checks).every(Boolean),
    status:attestation? (Object.values(checks).every(Boolean)?'READY':'DEGRADED') : 'PENDING_OFFLINE_CEREMONY',
    checks,ages:{p31AgeMs,p32AgeMs,p33RunAgeMs,ceremonyAgeMs},certValidUntil,certRemainingMs,
    attestationErrors:attestationValidation.errors,
  };
}
