import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function runtimeImports(path: string) {
  const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest);
  return file.statements.filter(ts.isImportDeclaration).flatMap((statement) => {
    if (!ts.isStringLiteral(statement.moduleSpecifier) || statement.importClause?.isTypeOnly) return [];
    const bindings = statement.importClause?.namedBindings;
    const names = bindings && ts.isNamedImports(bindings)
      ? bindings.elements.filter((element) => !element.isTypeOnly).map((element) => (element.propertyName ?? element.name).text)
      : [];
    if (bindings && ts.isNamedImports(bindings) && !names.length) return [];
    return [{ names, source: statement.moduleSpecifier.text }];
  });
}

function localImport(path: string, source: string): string | undefined {
  const base = source.startsWith('@/') ? resolve('src', source.slice(2)) : source.startsWith('.') ? resolve(dirname(path), source) : null;
  return base ? [base + '.ts', base + '.tsx'].find(existsSync) : undefined;
}

describe('Paper shader startup dependency boundary', () => {
  it('keeps only the two landing families in the static renderer graph', () => {
    const visited = new Set<string>();
    const paperImports = new Set<string>();
    function inspect(path: string) {
      if (visited.has(path)) return;
      visited.add(path);
      for (const { names, source } of runtimeImports(path)) {
        if (source === '@paper-design/shaders-react') names.forEach((name) => paperImports.add(name));
        const target = localImport(path, source);
        if (target) inspect(target);
      }
    }
    inspect(resolve('src/components/LiveMaterialCanvas.tsx'));
    expect([...paperImports].sort()).toEqual(['Dithering', 'GrainGradient', 'ditheringPresets', 'grainGradientPresets']);
  });
});
