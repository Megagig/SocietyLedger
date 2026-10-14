/**
 * Regex-based `enum Name { VALUE ... }` block extractor for `schema.prisma`.
 * Prisma's schema isn't TypeScript, so `parse-ts-const.ts`'s AST approach
 * doesn't apply — enum blocks are simple enough that a block-level regex is
 * sufficient and avoids pulling in a full Prisma schema parser for one use.
 */
import { readFileSync } from 'node:fs';

export interface PrismaEnum {
  name: string;
  values: string[];
}

export function parsePrismaEnums(schemaPath: string): PrismaEnum[] {
  const source = readFileSync(schemaPath, 'utf8');
  const enums: PrismaEnum[] = [];
  const enumBlock = /enum\s+(\w+)\s*\{([^}]*)\}/g;

  let match: RegExpExecArray | null;
  while ((match = enumBlock.exec(source))) {
    const [, name, body] = match;
    const values = body
      .split('\n')
      .map((line) => line.split('//')[0].trim()) // drop trailing `// comment`
      .filter((line) => line.length > 0)
      .map((line) => line.split(/\s+/)[0]); // drop a trailing `@map(...)` attribute, if any
    enums.push({ name, values });
  }
  return enums;
}
