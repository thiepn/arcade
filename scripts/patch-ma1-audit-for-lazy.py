from pathlib import Path

path = Path('scripts/audit-games.ts')
source = path.read_text(encoding='utf-8')

old_registry = """const importedComponents = new Map<string, string>();
for (const match of registrySource.matchAll(/import\\s+\\{\\s*(\\w+Game)\\s*\\}\\s+from\\s+'\\.\\.\\/games\\/(\\w+Game)'/g)) {
  importedComponents.set(match[1], `${match[2]}.tsx`);
}

const registeredComponents = new Set<string>();
for (const match of registrySource.matchAll(/component:\\s*(\\w+Game)\\s*,/g)) {
  registeredComponents.add(match[1]);
}
"""

new_registry = """const importedComponents = new Map<string, string>();
const registeredComponents = new Set<string>();

// Support both the original direct imports and MA4's React.lazy dynamic registrations.
for (const match of registrySource.matchAll(/import\\s+\\{\\s*(\\w+Game)\\s*\\}\\s+from\\s+'\\.\\.\\/games\\/(\\w+Game)'/g)) {
  importedComponents.set(match[1], `${match[2]}.tsx`);
}
for (const match of registrySource.matchAll(/component:\\s*(\\w+Game)\\s*,/g)) {
  registeredComponents.add(match[1]);
}
for (const match of registrySource.matchAll(/component:\\s*lazyGame\\(\\(\\) => import\\('\\.\\.\\/games\\/(\\w+Game)'\\)\\.then\\(\\(\\{\\s*(\\w+Game)\\s*\\}\\)/g)) {
  const [, fileStem, component] = match;
  importedComponents.set(component, `${fileStem}.tsx`);
  registeredComponents.add(component);
}
"""

old_hints = """const controlHints = new Map<string, string>();
for (const component of registeredComponents) {
  const escaped = component.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
  const match = new RegExp(`controlsHint:\\\\s*'([^']+)'[\\\\s\\\\S]{0,240}?component:\\\\s*${escaped}\\\\s*,`).exec(registrySource);
  if (match) controlHints.set(component, match[1]);
}
"""

new_hints = """const controlHints = new Map<string, string>();
for (const component of registeredComponents) {
  const escaped = component.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
  const importedFile = importedComponents.get(component)?.replace(/\\.tsx$/, '') ?? '';
  const escapedFile = importedFile.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
  const direct = new RegExp(`controlsHint:\\\\s*'([^']+)'[\\\\s\\\\S]{0,240}?component:\\\\s*${escaped}\\\\s*,`).exec(registrySource);
  const lazy = escapedFile
    ? new RegExp(`controlsHint:\\\\s*'([^']+)'[\\\\s\\\\S]{0,420}?component:\\\\s*lazyGame\\\\(\\\\(\\\\) => import\\\\('\\\\.\\\\.\\\\/games\\\\/${escapedFile}'\\\\)`).exec(registrySource)
    : null;
  const match = direct ?? lazy;
  if (match) controlHints.set(component, match[1]);
}
"""

if old_registry not in source:
    raise RuntimeError('Registry parser target not found')
if old_hints not in source:
    raise RuntimeError('Control-hint parser target not found')
source = source.replace(old_registry, new_registry, 1).replace(old_hints, new_hints, 1)
path.write_text(source, encoding='utf-8')
print('MA1 game audit updated for lazy game registrations')
