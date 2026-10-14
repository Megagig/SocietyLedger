/**
 * Statically reads a single top-level `const` literal out of an `apps/api`
 * source file, without importing or executing that file — `apps/docs` has
 * no workspace dependency on `apps/api`, and several of these files
 * instantiate a `PrismaClient` at module scope, so importing them would
 * require a DB connection and `.env` this script must not depend on.
 *
 * Supports only the literal shapes the reference generator actually needs:
 * strings, numbers, booleans, arrays and object literals (optionally behind
 * `as const` / parentheses). Anything else throws, by design — a source
 * file changing shape should fail generation loudly, not produce silently
 * wrong docs.
 */
import { readFileSync } from 'node:fs';
import * as ts from 'typescript';

export function parseTsConst(filePath: string, constName: string): unknown {
  const source = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

  let initializer: ts.Expression | undefined;
  sourceFile.forEachChild((node) => {
    if (initializer || !ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === constName && decl.initializer) {
        initializer = decl.initializer;
      }
    }
  });

  if (!initializer) {
    throw new Error(`parseTsConst: no top-level const "${constName}" found in ${filePath}`);
  }
  return evaluate(initializer, filePath, constName);
}

function evaluate(node: ts.Expression, filePath: string, constName: string): unknown {
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node)) {
    return evaluate(node.expression, filePath, constName);
  }
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => evaluate(element, filePath, constName));
  }
  if (ts.isObjectLiteralExpression(node)) {
    const result: Record<string, unknown> = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) {
        throw new Error(
          `parseTsConst: unsupported property kind (${ts.SyntaxKind[prop.kind]}) in "${constName}" (${filePath})`,
        );
      }
      result[propertyName(prop.name)] = evaluate(prop.initializer, filePath, constName);
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
