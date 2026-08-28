import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const sourcePath = 'scripts/migrate-block-drop-hold.mjs';
const tempPath = '/tmp/migrate-block-drop-hold.mjs';
let source = readFileSync(sourcePath, 'utf8');

const original = `function replaceOnce(path, search, replacement, label) {
  const source = readFileSync(path, 'utf8');
  let count = 0;
  if (typeof search === 'string') {
    count = source.split(search).length - 1;
  } else {
    const flags = search.flags.includes('g') ? search.flags : \`${'${search.flags}'}g\`;
    count = [...source.matchAll(new RegExp(search.source, flags))].length;
  }
  if (count !== 1) throw new Error(\`${'${path}'}: expected one ${'${label}'} match, found ${'${count}'}\`);
  writeFileSync(path, source.replace(search, replacement));
}`;

const enhanced = `function replaceOnce(path, search, replacement, label) {
  const source = readFileSync(path, 'utf8');
  let pattern = search;
  let count = 0;
  if (typeof search === 'string') {
    if (search.includes('[\\\\s\\\\S]*?')) {
      const parts = search.split('[\\\\s\\\\S]*?');
      if (parts.length !== 2) throw new Error('only one wildcard token is supported');
      const escapeRegex = (value) => value.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
      pattern = new RegExp(escapeRegex(parts[0]) + '[\\s\\S]*?' + escapeRegex(parts[1]));
      count = [...source.matchAll(new RegExp(pattern.source, 'g'))].length;
    } else {
      count = source.split(search).length - 1;
    }
  } else {
    const flags = search.flags.includes('g') ? search.flags : \`${'${search.flags}'}g\`;
    count = [...source.matchAll(new RegExp(search.source, flags))].length;
  }
  if (count !== 1) throw new Error(\`${'${path}'}: expected one ${'${label}'} match, found ${'${count}'}\`);
  writeFileSync(path, source.replace(pattern, replacement));
}`;

if (!source.includes(original)) {
  throw new Error('Block Drop migration helper signature changed unexpectedly.');
}
source = source.replace(original, enhanced);
writeFileSync(tempPath, source);
await import(pathToFileURL(tempPath).href + `?v=${Date.now()}`);
