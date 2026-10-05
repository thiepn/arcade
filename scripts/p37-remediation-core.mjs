export function ageHours(now,value){
  if(!value)return null;
  return Number(((new Date(now).getTime()-new Date(value).getTime())/36e5).toFixed(2));
}

function includesMain(refs=[]){
  return refs.includes('~DEFAULT_BRANCH')||refs.includes('refs/heads/main')||refs.includes('main');
}

export function evaluateRuleset(ruleset,requiredStatus='build'){
  const reasons=[];
  if(!ruleset){
    return {pass:false,reasons:['No active branch ruleset targets main.'],rulesetId:null,rulesetName:null};
  }
  if(ruleset.enforcement!=='active')reasons.push('Ruleset enforcement is not active.');
  if(ruleset.target!=='branch')reasons.push('Ruleset target is not branch.');
  const ref=ruleset.conditions?.ref_name||{};
  if(!includesMain(ref.include||[]))reasons.push('Ruleset does not include main/default branch.');
  if(includesMain(ref.exclude||[]))reasons.push('Ruleset excludes main/default branch.');
  if((ruleset.bypass_actors||[]).length>0)reasons.push('Ruleset contains bypass actors.');

  const rules=Array.isArray(ruleset.rules)?ruleset.rules:[];
  const types=new Set(rules.map(rule=>rule.type));
  for(const type of ['deletion','non_fast_forward','pull_request','required_status_checks']){
    if(!types.has(type))reasons.push('Missing rule: '+type);
  }

  const pr=rules.find(rule=>rule.type==='pull_request');
  if(pr&&pr.parameters?.required_review_thread_resolution!==true){
    reasons.push('Pull-request rule does not require review-thread resolution.');
  }

  const checks=rules.find(rule=>rule.type==='required_status_checks');
  if(checks){
    const contexts=(checks.parameters?.required_status_checks||[]).map(item=>item.context||item);
    if(!contexts.includes(requiredStatus))reasons.push('Required status check "'+requiredStatus+'" is missing.');
    if(checks.parameters?.strict_required_status_checks_policy!==true){
      reasons.push('Required status checks are not configured as strict/up-to-date.');
    }
  }

  return {
    pass:reasons.length===0,
    reasons,
    rulesetId:ruleset.id||null,
    rulesetName:ruleset.name||null,
    ruleTypes:[...types].sort(),
  };
}

export function selectQualifyingRuleset(rulesets,requiredStatus='build'){
  const assessments=(rulesets||[]).map(ruleset=>({ruleset,...evaluateRuleset(ruleset,requiredStatus)}));
  const passing=assessments.find(item=>item.pass);
  return {
    pass:Boolean(passing),
    selected:passing?{id:passing.ruleset.id||null,name:passing.ruleset.name||null}:null,
    assessments:assessments.map(({ruleset,...rest})=>rest),
  };
}


export function evaluateEffectiveMainRules(rules,requiredStatus='build'){
  const reasons=[];
  const list=Array.isArray(rules)?rules:[];
  const types=new Set(list.map(rule=>rule.type));
  for(const type of ['deletion','non_fast_forward','pull_request','required_status_checks']){
    if(!types.has(type))reasons.push('Missing effective main rule: '+type);
  }
  const pr=list.find(rule=>rule.type==='pull_request');
  if(pr&&pr.parameters?.required_review_thread_resolution!==true){
    reasons.push('Effective pull-request rule does not require review-thread resolution.');
  }
  const checks=list.find(rule=>rule.type==='required_status_checks');
  if(checks){
    const contexts=(checks.parameters?.required_status_checks||[]).map(item=>item.context||item);
    if(!contexts.includes(requiredStatus))reasons.push('Effective required status check "'+requiredStatus+'" is missing.');
    if(checks.parameters?.strict_required_status_checks_policy!==true){
      reasons.push('Effective required status checks are not strict/up-to-date.');
    }
  }
  return {pass:reasons.length===0,reasons,ruleTypes:[...types].sort()};
}

export function evaluateQualification(input){
  const {
    firstEpochEverActivated,
    mainProtected,
    rulesetQualified,
    p33AttestationRecent,
    p33EvidencePresent,
    p33AssuranceRecent,
    p33IssueOpen,
    p34AssuranceRecent,
    p34IssueOpen,
    currentHeadCiReady,
    controlPlaneClean,
  }=input;

  const p33Ready=p33AttestationRecent&&p33EvidencePresent&&p33AssuranceRecent&&!p33IssueOpen;
  const p34Ready=p34AssuranceRecent&&!p34IssueOpen;
  const activationReady=mainProtected&&rulesetQualified&&p33Ready&&p34Ready&&currentHeadCiReady&&controlPlaneClean&&!firstEpochEverActivated;

  let state='ACTIVATION_READY';
  if(firstEpochEverActivated)state='FIRST_EPOCH_ACTIVATED';
  else if(!mainProtected||!rulesetQualified)state='WAITING_MAIN_PROTECTION';
  else if(!p33AttestationRecent||!p33EvidencePresent)state='WAITING_OFFLINE_CEREMONY';
  else if(!p33AssuranceRecent||p33IssueOpen)state='WAITING_P33_RECONCILIATION';
  else if(!p34AssuranceRecent||p34IssueOpen)state='WAITING_P34_RECONCILIATION';
  else if(!currentHeadCiReady)state='WAITING_CURRENT_HEAD_CI';
  else if(!controlPlaneClean)state='CONTROL_PLANE_DEFICIENT';

  return {
    state,
    p33Ready,
    p34Ready,
    activationReady,
    dispatchP33Assurance:state==='WAITING_P33_RECONCILIATION',
    dispatchP34:state==='WAITING_P34_RECONCILIATION',
    dispatchP35:state==='ACTIVATION_READY',
  };
}
