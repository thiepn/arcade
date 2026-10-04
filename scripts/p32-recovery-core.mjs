export const P32_PROTECTED_TABLES = Object.freeze([
  'micro_arcade_players',
  'micro_arcade_play_sessions',
  'micro_arcade_score_submissions',
  'micro_arcade_best_scores',
  'micro_arcade_scoring_profiles',
  'micro_arcade_lb_policy',
  'micro_arcade_lb_sessions',
  'micro_arcade_lb_runs',
  'micro_arcade_lb_reviews',
]);

export const P32_TRANSIENT_EXCLUSIONS = Object.freeze([
  'micro_arcade_rate_limits',
  'unused micro_arcade_play_sessions',
  'unused micro_arcade_lb_sessions',
]);

export function parseTime(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : null;
}

export function durationMs(start, end) {
  const a=parseTime(start), b=parseTime(end);
  return a===null||b===null||b<a?null:b-a;
}

export function orderedTimings(timings, order) {
  let previous=null;
  for (const stage of order) {
    const item=timings?.stages?.[stage];
    if (!item || parseTime(item.startedAt)===null || parseTime(item.completedAt)===null) return false;
    if (parseTime(item.completedAt) < parseTime(item.startedAt)) return false;
    if (previous!==null && parseTime(item.startedAt) < previous) return false;
    previous=parseTime(item.completedAt);
  }
  return true;
}

export function offsiteArtifactAgeMs(manifest, atMs=Date.now()) {
  const captured=parseTime(manifest?.captured_at);
  return captured===null||captured>atMs?null:atMs-captured;
}

export function assessColdRestore({
  source,
  restore,
  browser,
  productionBefore,
  productionAfter,
  timings,
  offsite,
}) {
  const sourceVerified=Boolean(
    source?.format==='arcade-p31-offsite-v1' &&
    source?.snapshot?.verified===true &&
    source?.restore_drill?.ok===true
  );
  const restoreExact=Boolean(
    restore?.phase==='P32' &&
    restore?.coldTarget===true &&
    restore?.sourcePayloadSha256 &&
    restore?.sourcePayloadSha256===restore?.restoredPayloadSha256 &&
    restore?.sourceSchemaSha256===restore?.restoredSchemaSha256 &&
    restore?.countsMatch===true &&
    restore?.relationshipsOk===true &&
    restore?.transientRateLimits===0
  );
  const apiCertified=Boolean(browser?.api?.health && browser?.api?.overall && browser?.api?.weekly);
  const frontendCertified=Boolean(browser?.frontend?.shell && browser?.frontend?.leaderboardRequestObserved);
  const productionHealthyBefore=productionBefore?.phase==='P27' && productionBefore?.status==='healthy' && (productionBefore?.failures||[]).length===0;
  const productionHealthyAfter=productionAfter?.phase==='P27' && productionAfter?.status==='healthy' && (productionAfter?.failures||[]).length===0;
  const artifactVerified=Boolean(
    offsite?.format==='arcade-p32-offsite-reference-v1' &&
    offsite?.ciphertextHashMatches===true &&
    Number.isFinite(offsite?.ageMs) &&
    offsite.ageMs>=0
  );
  const timingOrder=['production-precheck','offsite-reference','source-export','cold-restore','cold-api','frontend-build','browser-certification','production-postcheck'];
  const timingValid=orderedTimings(timings,timingOrder);
  return {
    certified:Boolean(sourceVerified&&restoreExact&&apiCertified&&frontendCertified&&productionHealthyBefore&&productionHealthyAfter&&artifactVerified&&timingValid),
    sourceVerified,
    restoreExact,
    apiCertified,
    frontendCertified,
    productionHealthyBefore,
    productionHealthyAfter,
    artifactVerified,
    timingValid,
  };
}
