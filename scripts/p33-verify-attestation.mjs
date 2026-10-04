import { readFile, writeFile } from 'node:fs/promises';
import { validateAttestation, verifyAttestationSignature } from './p33-recovery-core.mjs';

const [,,attestationPath='p33-attestation.json',signaturePath='p33-attestation.sig.b64',certPath=process.env.P33_RECOVERY_CERT||'ops/p31-backup-recovery-cert.pem']=process.argv;
const [attestationBytes,signatureText,certPem]=await Promise.all([
  readFile(attestationPath),readFile(signaturePath,'utf8'),readFile(certPath,'utf8')
]);
let attestation;
try{attestation=JSON.parse(attestationBytes.toString('utf8'));}catch{throw new Error('P33 attestation is not valid JSON');}
const validation=validateAttestation(attestation,{certPem,maxAgeMs:Number(process.env.P33_MAX_ATTESTATION_AGE_MS||24*60*60*1000)});
if(!validation.ok)throw new Error('P33 attestation contract failed: '+validation.errors.join('; '));
const signature=Buffer.from(signatureText.trim(),'base64');
if(!signature.length||!verifyAttestationSignature(attestationBytes,signature,certPem))throw new Error('P33 offline-key signature verification failed');
if(process.env.GITHUB_OUTPUT){
  await writeFile(process.env.GITHUB_OUTPUT,[
    'source_run_id='+attestation.sourceRunId,
    'ciphertext_sha256='+attestation.ciphertextSha256,
    'payload_sha256='+attestation.sourcePayloadSha256,
    'schema_sha256='+attestation.sourceSchemaSha256,
  ].join('\n')+'\n',{flag:'a'});
}
console.log('P33 OFFLINE-KEY ATTESTATION — VERIFIED');
console.log('Source P31 run '+attestation.sourceRunId+'; '+attestation.sourceTotalRows+' rows; offline private-key signature valid.');
