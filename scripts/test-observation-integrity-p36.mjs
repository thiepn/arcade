import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildControlPlaneManifest, diffControlPlaneManifests, checkpointChain, sha256 } from './p36-control-plane-core.mjs';

const root=mkdtempSync(join(tmpdir(),'arcade-p36-'));
mkdirSync(join(root,'ops'));
writeFileSync(join(root,'ops','a.json'),'{"a":1}\n');
writeFileSync(join(root,'ops','b.json'),'{"b":2}\n');

const first=buildControlPlaneManifest(root,['ops/b.json','ops/a.json']);
const reordered=buildControlPlaneManifest(root,['ops/a.json','ops/b.json']);
assert.equal(first.fingerprint,reordered.fingerprint);
assert.equal(first.missing.length,0);
assert.equal(first.algorithm,'sha256');

writeFileSync(join(root,'ops','b.json'),'{"b":3}\n');
const second=buildControlPlaneManifest(root,['ops/a.json','ops/b.json']);
assert.notEqual(first.fingerprint,second.fingerprint);
const diff=diffControlPlaneManifests(first,second);
assert.equal(diff.length,1);
assert.equal(diff[0].path,'ops/b.json');

const missing=buildControlPlaneManifest(root,['ops/a.json','ops/missing.json']);
assert.deepEqual(missing.missing,['ops/missing.json']);

const checkpoints=[
  {epochId:'abc',day:'2026-01-02',createdAt:'2026-01-02T07:00:00Z',controlPlaneFingerprint:first.fingerprint,p33RunId:2,p34RunId:3},
  {epochId:'abc',day:'2026-01-01',createdAt:'2026-01-01T07:00:00Z',controlPlaneFingerprint:first.fingerprint,p33RunId:1,p34RunId:2},
];
const chain=checkpointChain(checkpoints,first.fingerprint);
assert.equal(chain.count,2);
assert.equal(chain.valid,true);
assert.equal(chain.links[0].day,'2026-01-01');
assert.equal(chain.links[0].previousHash,'GENESIS');
assert.equal(chain.head,chain.links[1].hash);
assert.equal(chain.links[0].hash,sha256(['GENESIS','abc','2026-01-01','2026-01-01T07:00:00Z',first.fingerprint,'1','2'].join('|')));

const bad=checkpointChain([{...checkpoints[0],controlPlaneFingerprint:'bad'}],first.fingerprint);
assert.equal(bad.valid,false);

console.log('P36 OBSERVATION-INTEGRITY CORE TEST — PASS');
