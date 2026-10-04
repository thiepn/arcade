import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { assessColdRestore, parseTime } from './p32-recovery-core.mjs';

const readJson=async(path)=>JSON.parse(await readFile(path,'utf8'));
const source=await readJson(process.env.P32_SOURCE||'p32-source.json');
const restore=await readJson(process.env.P32_RESTORE||'p32-report/restore.json');
const browser=await readJson(process.env.P32_BROWSER||'p32-report/browser.json');
const before=await readJson(process.env.P32_PRODUCTION_BEFORE||'p32-production-before/production-telemetry.json');
const after=await readJson(process.env.P32_PRODUCTION_AFTER||'p32-production-after/production-telemetry.json');
const timings=await readJson(process.env.P32_TIMINGS||'p32-report/timings.json');
const offsite=await readJson(process.env.P32_OFFSITE||'p32-report/offsite-reference.json');
const outputDir=process.env.P32_REPORT_DIR||'p32-report';

const assessment=assessColdRestore({source,restore,browser,productionBefore:before,productionAfter:after,timings,offsite});
const coldStart=parseTime(timings.stages?.['cold-restore']?.startedAt);
const apiReady=parseTime(timings.stages?.['cold-api']?.completedAt);
const browserReady=parseTime(timings.stages?.['browser-certification']?.completedAt);
const sourceCaptured=parseTime(source.snapshot?.captured_at);
const totalStart=parseTime(timings.startedAt);
const totalEnd=parseTime(timings.completedAt);

const report={
  schemaVersion:1,
  phase:'P32',
  generatedAt:new Date().toISOString(),
  certified:assessment.certified,
  failoverCandidateCertified:assessment.certified,
  productionTrafficSwitched:false,
  productionDurableDataMutated:false,
  coldTargetDisposedByRunner:true,
  restoreSource:'fresh-p31-verified-export',
  encryptedArtifactReferenceVerified:assessment.artifactVerified,
  encryptedArtifactDecryptedInAutomation:false,
  offlineRecoveryKeyBoundaryPreserved:true,
  checks:assessment,
  source:{
    snapshotId:source.snapshot?.id||null,
    capturedAt:source.snapshot?.captured_at||null,
    schemaSha256:source.snapshot?.schema_sha256||null,
    payloadSha256:source.snapshot?.payload_sha256||null,
    totalRows:Object.values(source.snapshot?.row_counts||{}).reduce((a,b)=>a+Number(b||0),0),
    ageAtColdRestoreMs:coldStart!==null&&sourceCaptured!==null?Math.max(0,coldStart-sourceCaptured):null,
  },
  offsite:{
    sourceRunId:offsite.sourceRunId,
    capturedAt:offsite.capturedAt,
    ageAtExerciseMs:offsite.ageMs,
    ciphertextSha256:offsite.ciphertextSha256,
    hashVerified:offsite.ciphertextHashMatches,
  },
  recoveryTime:{
    coldRestoreToApiReadyMs:coldStart!==null&&apiReady!==null?apiReady-coldStart:null,
    coldRestoreToBrowserCertifiedMs:coldStart!==null&&browserReady!==null?browserReady-coldStart:null,
    fullExerciseMs:totalStart!==null&&totalEnd!==null?totalEnd-totalStart:null,
  },
  restored:{
    schemaSha256:restore.restoredSchemaSha256,
    payloadSha256:restore.restoredPayloadSha256,
    rowCounts:restore.rowCounts,
    relationshipsOk:restore.relationshipsOk,
    transientRateLimitsAtRestore:restore.transientRateLimits,
  },
  api:browser.api,
  frontend:browser.frontend,
  productionBefore:{status:before.status,sampleCount:before.sampleCount,warnings:before.warnings||[],failures:before.failures||[]},
  productionAfter:{status:after.status,sampleCount:after.sampleCount,warnings:after.warnings||[],failures:after.failures||[]},
  timings,
};

await mkdir(outputDir,{recursive:true});
await writeFile(outputDir+'/certification.json',JSON.stringify(report,null,2)+'\n');
const summary=[
  '# P32 full-stack cold recovery certification',
  '',
  '- Certification: **'+(report.certified?'PASS':'FAIL')+'**',
  '- Production traffic switched: **no**',
  '- Production durable data mutated: **no**',
  '- Latest encrypted artifact integrity: **'+(report.offsite.hashVerified?'verified':'failed')+'**',
  '- Encrypted artifact decrypted in automation: **no — offline key boundary preserved**',
  '- Cold source rows: **'+report.source.totalRows+'**',
  '- Cold restore → API ready: **'+report.recoveryTime.coldRestoreToApiReadyMs+' ms**',
  '- Cold restore → browser certified: **'+report.recoveryTime.coldRestoreToBrowserCertifiedMs+' ms**',
  '- Full exercise: **'+report.recoveryTime.fullExerciseMs+' ms**',
  '- Production before: **'+report.productionBefore.status+'**',
  '- Production after: **'+report.productionAfter.status+'**',
  '',
  'Observed timings are evidence from this drill, not a contractual RTO guarantee.',
].join('\n')+'\n';
await writeFile(outputDir+'/summary.md',summary);
if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,'\n'+summary,{flag:'a'});
console.log('P32 FULL-STACK DISASTER RECOVERY EXERCISE — '+(report.certified?'PASS':'FAIL'));
console.log('Cold restore to browser certification: '+report.recoveryTime.coldRestoreToBrowserCertifiedMs+' ms; full exercise '+report.recoveryTime.fullExerciseMs+' ms.');
if(!report.certified)process.exit(1);
