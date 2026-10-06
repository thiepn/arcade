import { readFile } from 'node:fs/promises';

const source = JSON.parse(
  await readFile('platform/games-family.json', 'utf8'),
);
const published = JSON.parse(
  await readFile('public/.well-known/games-product.json', 'utf8'),
);

const failures = [];
const expected = ['home', 'arcade', 'gomoku', 'wordstrike'];
const modules = new Map(source.modules.map((module) => [module.id, module]));

if (JSON.stringify(source) !== JSON.stringify(published))
  failures.push('Published Games contract must match the source contract.');
if (source.schemaVersion !== 1 || source.phase !== 'P10')
  failures.push('Games family contract must be schema v1 / P10.');
if (source.product !== 'games' || source.defaultModule !== 'home')
  failures.push('Games family identity/default module drifted.');
if (source.registryState !== 'active')
  failures.push('Games family is expected to be active in P10.');
if (source.shell?.repo !== 'thiepn/arcade')
  failures.push('Arcade must remain the Games home provider.');
if (source.shell?.launchUrl !== 'https://thiepn.dev/arcade/')
  failures.push('Games home production URL changed.');
if (source.shell?.mayProxyExternalWrites !== false)
  failures.push('Games home must not proxy provider writes in P10.');
if (JSON.stringify(source.modules.map((m) => m.id)) !== JSON.stringify(expected))
  failures.push('Games module set/order drifted.');

for (const id of expected) {
  const module = modules.get(id);
  if (!module) continue;
  if (module.canonicalRef !== `games/${id}`)
    failures.push(`${id}: canonicalRef mismatch.`);
  if (module.registryState !== 'active')
    failures.push(`${id}: expected active provider-backed module.`);
  if (module.writePolicy !== 'provider-only')
    failures.push(`${id}: writes must remain provider-owned.`);
}

if (modules.get('home')?.provider?.repo !== 'thiepn/arcade')
  failures.push('Games home provider must be thiepn/arcade.');
if (modules.get('gomoku')?.provider?.repo !== 'thiepn/gomoku')
  failures.push('Gomoku provider mismatch.');
if (modules.get('wordstrike')?.provider?.repo !== 'thiepn/wordstrike')
  failures.push('WORDSTRIKE provider mismatch.');
if (source.progressionRule?.sharedAuthoritativeStore !== false)
  failures.push('P10 must not create a universal game save database.');
if (source.progressionRule?.crossGameWriteProxy !== false)
  failures.push('P10 must not proxy cross-game writes.');

if (failures.length) {
  console.error('Platform P10 Games family validation failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Platform P10 Games family valid: ${source.modules.length} active modules / provider-owned saves preserved.`,
);
