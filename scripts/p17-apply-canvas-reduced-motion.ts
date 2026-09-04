import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const gamesDir = join(root, 'src', 'games');
const importLine = "import { isArcadeReducedMotion } from '../lib/motionPreferences';";

const getIndent = (source: string, pos: number) => {
  const lineStart = source.lastIndexOf('\n', pos - 1) + 1;
  return source.slice(lineStart, pos).match(/^\s*/)?.[0] ?? '';
};

const isCtxTranslate = (node: ts.Node): node is ts.CallExpression => {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  return node.expression.expression.getText() === 'ctx' && node.expression.name.text === 'translate';
};

const hasShakeAncestor = (node: ts.Node, sourceFile: ts.SourceFile) => {
  let current: ts.Node | undefined = node.parent;
  while (current && !ts.isFunctionLike(current) && current !== sourceFile) {
    if (ts.isIfStatement(current) && /shake/i.test(current.expression.getText(sourceFile))) return true;
    current = current.parent;
  }
  return false;
};

const isAlreadyGuarded = (node: ts.Node, sourceFile: ts.SourceFile) => {
  let current: ts.Node | undefined = node.parent;
  while (current && !ts.isFunctionLike(current) && current !== sourceFile) {
    if (ts.isIfStatement(current) && current.expression.getText(sourceFile).includes('isArcadeReducedMotion')) return true;
    current = current.parent;
  }
  return false;
};

const immediateCommentMentionsShake = (source: string, statementStart: number) => {
  const before = source.slice(Math.max(0, statementStart - 220), statementStart);
  const lines = before.split('\n').slice(-4).map((line) => line.trim()).filter(Boolean);
  return lines.some((line) => /^(\/\/|\/\*|\*)/.test(line) && /shake/i.test(line));
};

const findShakeStatements = (source: string, sourceFile: ts.SourceFile) => {
  const statements = new Map<number, ts.ExpressionStatement>();
  const visit = (node: ts.Node) => {
    if (isCtxTranslate(node) && ts.isExpressionStatement(node.parent)) {
      const statement = node.parent;
      const callMentionsShake = /shake/i.test(node.getText(sourceFile));
      const shakeContext = callMentionsShake || hasShakeAncestor(node, sourceFile) || immediateCommentMentionsShake(source, statement.getStart(sourceFile));
      if (shakeContext && !isAlreadyGuarded(node, sourceFile)) statements.set(statement.getStart(sourceFile), statement);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...statements.values()];
};

const patchFile = (path: string) => {
  let source = readFileSync(path, 'utf8');
  let sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const statements = findShakeStatements(source, sourceFile);
  if (!statements.length) return { changed: false, count: 0 };

  const edits = statements.map((statement) => {
    const start = statement.getStart(sourceFile);
    const end = statement.getEnd();
    const indent = getIndent(source, start);
    const original = source.slice(start, end);
    const inner = original.split('\n').map((line) => `${indent}  ${line.trimStart()}`).join('\n');
    return {
      start,
      end,
      replacement: `${indent}if (!isArcadeReducedMotion()) {\n${inner}\n${indent}}`,
    };
  }).sort((a, b) => b.start - a.start);

  for (const edit of edits) source = source.slice(0, edit.start) + edit.replacement + source.slice(edit.end);

  if (!source.includes(importLine)) {
    sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const imports = sourceFile.statements.filter(ts.isImportDeclaration);
    const insertion = imports.length ? imports[imports.length - 1].getEnd() : 0;
    source = source.slice(0, insertion) + `\n${importLine}` + source.slice(insertion);
  }

  writeFileSync(path, source);

  const verified = readFileSync(path, 'utf8');
  const verifiedFile = ts.createSourceFile(path, verified, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const remaining = findShakeStatements(verified, verifiedFile);
  if (remaining.length) throw new Error(`${path}: ${remaining.length} camera-shake translate calls remain unguarded`);

  return { changed: true, count: statements.length };
};

const files = readdirSync(gamesDir).filter((name) => name.endsWith('Game.tsx')).sort();
let changedFiles = 0;
let guardedCalls = 0;
for (const file of files) {
  const result = patchFile(join(gamesDir, file));
  if (!result.changed) continue;
  changedFiles++;
  guardedCalls += result.count;
  console.log(`P17 reduced-motion guard: ${file} (${result.count} camera translate${result.count === 1 ? '' : 's'})`);
}

if (!changedFiles) throw new Error('P17 reduced-motion patch found no unguarded canvas camera-shake translations');
console.log(`P17 canvas reduced-motion patch complete: ${guardedCalls} camera-shake translations guarded across ${changedFiles} games.`);
