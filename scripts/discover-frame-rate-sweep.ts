import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const gamesDir = join(process.cwd(), 'src', 'games');
const files = readdirSync(gamesDir).filter((name) => name.endsWith('Game.tsx')).sort();

const suspiciousMutation = /(\+\+|--|\+=\s*(?![^;]*(?:dt|delta|Sec|STEP|step))|-=\s*(?![^;]*(?:dt|delta|Sec|STEP|step))|\*=\s*(?:0\.\d+|1\.\d+))/;
const suspiciousRandom = /Math\.random\(\)\s*[<>]\s*0?\.\d+/;

for (const file of files) {
  const path = join(gamesDir, file);
  const source = readFileSync(path, 'utf8');
  if (!source.includes('useGameLoop')) continue;

  const lines = source.split('\n');
  const start = lines.findIndex((line) => line.includes('onUpdate:'));
  if (start < 0) {
    console.log(`\n${file}: useGameLoop without onUpdate`);
    continue;
  }

  let depth = 0;
  let opened = false;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') { depth++; opened = true; }
      else if (ch === '}') depth--;
    }
    if (opened && depth <= 0 && i > start) { end = i + 1; break; }
  }

  const body = lines.slice(start, end);
  const fixed = /get\w+(?:Physics)?StepBatch|FIXED_STEP_SEC|fixedStep/i.test(source);
  const elapsed = /onUpdate:\s*\([^)]*(?:dt|deltaSec|delta|elapsed)/.test(source);
  const unsafeWallClock = /\b(?:setTimeout|setInterval)\s*\(/.test(source);
  const safeWallClock = /useSafeTimeout|setSafeTimeout/.test(source);
  const findings: string[] = [];

  body.forEach((line, idx) => {
    const t = line.trim();
    if (!t || t.startsWith('//')) return;
    if (suspiciousMutation.test(t) || suspiciousRandom.test(t)) {
      if (/for\s*\(|\.forEach\(|idx\+\+|i\+\+|j\+\+|k\+\+/.test(t)) return;
      findings.push(`${start + idx + 1}: ${t}`);
    }
  });

  console.log(`\n=== ${file} ===`);
  console.log(`fixedStep=${fixed} elapsedArg=${elapsed} setTimeout=${unsafeWallClock} safeTimeout=${safeWallClock} findings=${findings.length}`);
  for (const finding of findings.slice(0, 80)) console.log(finding);
}
