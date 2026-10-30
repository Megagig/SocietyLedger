/**
 * Statically reads a single top-level `const` literal out of an `apps/api`
 * source file, without importing or executing that file — `apps/docs` has
 * no workspace dependency on `apps/api`, and several of these files
 * instantiate a `PrismaClient` at module scope, so importing them would
 * require a DB connection and `.env` this script must not depend on.
 *
 * Supports only the literal shapes the reference generator actually needs:
 * strings, numbers, booleans, arrays and object literals (optionally behind
 * `as const` / parentheses), plus a plain reference to another top-level `const` in the same file, which
 * is also how a spread (`[...BASE, 'extra']`) is read. Anything else throws, by design — a source
 * file changing shape should fail generation loudly, not produce silently
 * wrong docs.
 */
import { readFileSync } from 'node:fs';
import * as ts from 'typescript';

export function parseTsConst(filePath: string, constName: string): unknown {
  const source = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

  // Every top-level const of the file, by name, so a reference or a spread can be followed.
  const scope = new Map<string, ts.Expression>();
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.initializer) scope.set(decl.name.text, decl.initializer);
    }
  });

  const initializer = scope.get(constName);
  if (!initializer) {
    throw new Error(`parseTsConst: no top-level const "${constName}" found in ${filePath}`);
  }
  return evaluate(initializer, filePath, constName, scope, [constName]);
}

function evaluate(node: ts.Expression, filePath: string, constName: string, scope: Map<string, ts.Expression>, trail: string[]): unknown {
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node)) {
    return evaluate(node.expression, filePath, constName, scope, trail);
  }
  if (ts.isIdentifier(node)) {
    // A name is followed to its own const in the same file. A name that loops back on itself would never end, so it fails instead.
    const target = scope.get(node.text);
    if (!target || trail.includes(node.text)) {
      throw new Error(`parseTsConst: cannot resolve "${node.text}" in "${constName}" (${filePath}); it must be a top-level const in the same file`);
    }
    return evaluate(target, filePath, constName, scope, [...trail, node.text]);
  }
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.flatMap((element) => {
      if (ts.isSpreadElement(element)) {
        const spread = evaluate(element.expression, filePath, constName, scope, trail);
        if (!Array.isArray(spread)) throw new Error(`parseTsConst: a spread in "${constName}" (${filePath}) is not an array`);
        return spread;
      }
      return [evaluate(element, filePath, constName, scope, trail)];
    });
  }
  if (ts.isObjectLiteralExpression(node)) {
    const result: Record<string, unknown> = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) {
        throw new Error(
          `parseTsConst: unsupported property kind (${ts.SyntaxKind[prop.kind]}) in "${constName}" (${filePath})`,
        );
      }
      result[propertyName(prop.name)] = evaluate(prop.initializer, filePath, constName, scope, trail);
    }
    return result;
  }
  throw new Error(
    `parseTsConst: unsupported expression kind ${ts.SyntaxKind[node.kind]} in "${constName}" (${filePath}) — the source shape changed, update the parser or the generator`,
  );
}

function propertyName(name: ts.PropertyName): string {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteralLike(name)) return name.text;
  if (ts.isNumericLiteral(name)) return name.text;
  throw new Error(`parseTsConst: unsupported property name kind ${ts.SyntaxKind[name.kind]}`);
}
