import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const sourcePath = 'scripts/migrate-block-drop-hold.mjs';
const tempPath = '/tmp/migrate-block-drop-hold.mjs';
let source = readFileSync(sourcePath, 'utf8');

const badSearch = `  \`      {/* Mobile Controls */}\n      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto z-10 sm:hidden">[\\s\\S]*?      </div>\n    </div>\`,`;
const goodSearch = `  /      \\{\\/\\* Mobile Controls \\*\\/\\}[\\s\\S]*?\\n    <\\/div>/,`;

if (!source.includes(badSearch)) {
  throw new Error('Block Drop mobile-control migration search changed unexpectedly.');
}
source = source.replace(badSearch, goodSearch);
writeFileSync(tempPath, source);
await import(pathToFileURL(tempPath).href + `?v=${Date.now()}`);
