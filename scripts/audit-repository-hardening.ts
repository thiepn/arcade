import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const errors: string[] = [];
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const requiredFiles = [
  '.github/CODEOWNERS',
  '.github/pull_request_template.md',
  '.github/dependabot.yml',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'docs/RELEASE_CHECKLIST.md',
] as const;
for (const path of requiredFiles) {
  assert(existsSync(join(root, path)), `missing repository hardening file: ${path}`);
}

const codeowners = read('.github/CODEOWNERS');
const prTemplate = read('.github/pull_request_template.md');
const dependabot = read('.github/dependabot.yml');
const security = read('SECURITY.md');
const contributing = read('CONTRIBUTING.md');
const releaseChecklist = read('docs/RELEASE_CHECKLIST.md');
const ci = read('.github/workflows/ci.yml');
const pages = read('.github/workflows/pages.yml');

assert(/^\*\s+@thiepn$/m.test(codeowners), 'CODEOWNERS does not define a default owner');
assert(codeowners.includes('/.github/ @thiepn'), 'release-critical GitHub configuration lacks explicit ownership');
assert(codeowners.includes('/worker/ @thiepn'), 'Worker surface lacks explicit ownership');

for (const token of [
  'bun run quality:release32',
  'complete CI workflow is green before merge',
  'No credentials',
  'desktop and mobile',
]) {
  assert(prTemplate.includes(token), `pull request template missing release check: ${token}`);
}

assert(dependabot.includes('version: 2'), 'Dependabot configuration version is missing');
assert(dependabot.includes('package-ecosystem: npm'), 'Dependabot does not cover application dependencies');
assert(dependabot.includes('package-ecosystem: github-actions'), 'Dependabot does not cover GitHub Actions');
assert((dependabot.match(/interval: weekly/g) ?? []).length === 2, 'Dependabot updates are not weekly for both ecosystems');

assert(security.includes('Do not open a public issue'), 'security policy does not direct private disclosure');
assert(security.includes('private security-advisory'), 'security policy does not identify the private advisory flow');
assert(security.includes('production secrets'), 'security policy does not prohibit secret disclosure');

assert(contributing.includes('Do not use `main` as a development branch'), 'contribution guide does not prohibit direct development on main');
assert(contributing.includes('quality:release32'), 'contribution guide does not require the release gate');
assert(contributing.includes('complete GitHub Actions CI workflow is the merge authority'), 'contribution guide does not establish CI as merge authority');

for (const token of [
  'Confirm the exact merge commit is the new `main` head',
  'Confirm `main` CI passes on that exact merge commit',
  'Confirm GitHub Pages deployment passes on that exact merge commit',
  'force pushes are blocked',
  'branch deletion is blocked',
]) {
  assert(releaseChecklist.includes(token), `release checklist missing control: ${token}`);
}

assert(ci.includes('permissions:\n  contents: read'), 'CI does not use read-only repository contents permission');
assert(!ci.includes('contents: write'), 'CI unexpectedly grants contents: write');
assert(!ci.includes('pull_request_target'), 'CI uses unsafe pull_request_target execution');
assert(ci.includes('cancel-in-progress: true'), 'CI does not cancel stale in-progress runs');
assert(ci.includes('timeout-minutes:'), 'CI job has no execution timeout');

assert(pages.includes('contents: read'), 'Pages workflow does not restrict repository contents to read');
assert(pages.includes('pages: write'), 'Pages deployment lacks explicit pages permission');
assert(pages.includes('id-token: write'), 'Pages deployment lacks explicit OIDC permission');
assert(!pages.includes('pull_request_target'), 'Pages workflow uses unsafe pull_request_target execution');

const workflowSources = [
  ['ci.yml', ci],
  ['pages.yml', pages],
] as const;
for (const [name, source] of workflowSources) {
  const actionRefs = [...source.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)].map((match) => match[1]);
  assert(actionRefs.length > 0, `${name} contains no actions to audit`);
  for (const ref of actionRefs) {
    assert(/^[^@\s]+@[0-9a-f]{40}$/i.test(ref), `${name} action is not pinned to a full commit SHA: ${ref}`);
  }
}

if (errors.length) {
  console.error('REPOSITORY HARDENING AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('REPOSITORY HARDENING AUDIT — PASS');
console.log('Ownership, PR/release policy, dependency maintenance, disclosure policy, least-privilege workflows, stale-run cancellation, and SHA-pinned Actions are certified.');
