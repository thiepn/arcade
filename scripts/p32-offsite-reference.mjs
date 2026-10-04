import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { offsiteArtifactAgeMs } from './p32-recovery-core.mjs';

const dir=process.env.P32_OFFSITE_DIR||'p32-latest-offsite';
const outputDir=process.env.P32_REPORT_DIR||'p32-report';
const manifest=JSON.parse(await readFile(dir+'/manifest.json','utf8'));
if(manifest?.format!=='arcade-p31-offsite-evidence-v1'||manifest?.verification_ok!==true)throw new Error('latest P31 off-site manifest is not verified');
const cms=(await readdir(dir)).filter(x=>x.endsWith('.cms'));
if(cms.length!==1)throw new Error('expected exactly one encrypted P31 artifact');
const bytes=await readFile(dir+'/'+cms[0]);
const hash=createHash('sha256').update(bytes).digest('hex');
if(hash!==manifest.ciphertext_sha256)throw new Error('downloaded P31 ciphertext hash differs from retained manifest');
const ageMs=offsiteArtifactAgeMs(manifest);
if(ageMs===null)throw new Error('invalid latest off-site capture timestamp');
const report={
  schemaVersion:1,
  phase:'P32',
  format:'arcade-p32-offsite-reference-v1',
  sourceRunId:manifest.run_id,
  sourceCommit:manifest.commit,
  capturedAt:manifest.captured_at,
  ageMs,
  ciphertextSha256:hash,
  ciphertextHashMatches:true,
  schemaSha256:manifest.schema_sha256,
  payloadSha256:manifest.payload_sha256,
  totalRows:manifest.total_rows,
  encryptedArtifactPresent:true,
  decryptedInAutomation:false,
  offlineKeyBoundaryPreserved:true,
};
await mkdir(outputDir,{recursive:true});
await writeFile(outputDir+'/offsite-reference.json',JSON.stringify(report,null,2)+'\n');
console.log('P32 OFF-SITE BACKUP REFERENCE — PASS');
console.log('Latest encrypted P31 artifact age '+Math.round(ageMs/60000)+' minute(s); ciphertext SHA-256 verified.');
