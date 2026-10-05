import { strict as assert } from 'node:assert';
import { evaluateRuleset, selectQualifyingRuleset, evaluateEffectiveMainRules, evaluateQualification } from './p37-remediation-core.mjs';

const good={
  id:1,name:'main protection',target:'branch',enforcement:'active',bypass_actors:[],
  conditions:{ref_name:{include:['~DEFAULT_BRANCH'],exclude:[]}},
  rules:[
    {type:'deletion'},
    {type:'non_fast_forward'},
    {type:'pull_request',parameters:{required_review_thread_resolution:true}},
    {type:'required_status_checks',parameters:{strict_required_status_checks_policy:true,required_status_checks:[{context:'build'}]}},
  ],
};
assert.equal(evaluateRuleset(good).pass,true);
assert.equal(selectQualifyingRuleset([good]).pass,true);
assert.equal(evaluateEffectiveMainRules(good.rules).pass,true);

const bypass={...good,bypass_actors:[{actor_id:5,actor_type:'RepositoryRole'}]};
assert.equal(evaluateRuleset(bypass).pass,false);

const weak={...good,rules:good.rules.map(rule=>rule.type==='required_status_checks'?{...rule,parameters:{...rule.parameters,strict_required_status_checks_policy:false}}:rule)};
assert.equal(evaluateRuleset(weak).pass,false);
assert.equal(evaluateEffectiveMainRules(weak.rules).pass,false);

const base={
  firstEpochEverActivated:false,mainProtected:true,rulesetQualified:true,
  p33AttestationRecent:true,p33EvidencePresent:true,p33AssuranceRecent:true,p33IssueOpen:false,
  p34AssuranceRecent:true,p34IssueOpen:false,currentHeadCiReady:true,controlPlaneClean:true,
};
assert.equal(evaluateQualification(base).state,'ACTIVATION_READY');
assert.equal(evaluateQualification(base).activationReady,true);

assert.equal(evaluateQualification({...base,mainProtected:false}).state,'WAITING_MAIN_PROTECTION');
assert.equal(evaluateQualification({...base,p33AttestationRecent:false}).state,'WAITING_OFFLINE_CEREMONY');
assert.equal(evaluateQualification({...base,p33IssueOpen:true}).state,'WAITING_P33_RECONCILIATION');
assert.equal(evaluateQualification({...base,p34IssueOpen:true}).state,'WAITING_P34_RECONCILIATION');
assert.equal(evaluateQualification({...base,currentHeadCiReady:false}).state,'WAITING_CURRENT_HEAD_CI');
assert.equal(evaluateQualification({...base,controlPlaneClean:false}).state,'CONTROL_PLANE_DEFICIENT');
assert.equal(evaluateQualification({...base,firstEpochEverActivated:true}).state,'FIRST_EPOCH_ACTIVATED');

console.log('P37 REMEDIATION / ACTIVATION CORE TEST — PASS');
