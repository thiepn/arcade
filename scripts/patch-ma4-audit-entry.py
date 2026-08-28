from pathlib import Path

path = Path('scripts/audit-ma4.mjs')
source = path.read_text(encoding='utf-8')
old = """  const entry = manifest['src/main.tsx'];
  if (!entry) {
    errors.push(`${dist}: main manifest entry is missing`);
  } else {
    const initialKeys = new Set();
    const visit = (key) => {
      if (initialKeys.has(key)) return;
      initialKeys.add(key);
      for (const dependency of manifest[key]?.imports || []) visit(dependency);
    };
    visit('src/main.tsx');
    const eagerGames = [...initialKeys].filter((key) => key.startsWith('src/games/'));
    if (eagerGames.length) errors.push(`${dist}: game modules leaked into initial graph: ${eagerGames.join(', ')}`);
  }
"""
new = """  const entryKey = Object.keys(manifest).find((key) => manifest[key]?.isEntry === true);
  const entry = entryKey ? manifest[entryKey] : null;
  if (!entryKey || !entry) {
    errors.push(`${dist}: Vite entry manifest record is missing`);
  } else {
    const initialKeys = new Set();
    const visit = (key) => {
      if (initialKeys.has(key)) return;
      initialKeys.add(key);
      for (const dependency of manifest[key]?.imports || []) visit(dependency);
    };
    visit(entryKey);
    const eagerGames = [...initialKeys].filter((key) => key.startsWith('src/games/'));
    if (eagerGames.length) errors.push(`${dist}: game modules leaked into initial graph: ${eagerGames.join(', ')}`);
  }
"""
if source.count(old) != 1:
    raise RuntimeError('MA4 manifest entry audit target not found')
path.write_text(source.replace(old, new, 1), encoding='utf-8')
print('MA4 Vite manifest entry detection corrected')
