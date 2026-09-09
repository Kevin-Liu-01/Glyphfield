import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const page = ts.createSourceFile('page.tsx', readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const logoRail = page.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'LogoRail');

function railLinks() {
  const links: ts.JsxOpeningElement[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(page) === 'Link') links.push(node);
    ts.forEachChild(node, visit);
  }
  if (logoRail) visit(logoRail);
  return links;
}

describe('landing brand navigation prefetch budget', () => {
  it('disables speculative prefetch for both example-folder and mapped project links', () => {
    const links = railLinks();
    expect(links).toHaveLength(2);
    for (const link of links) {
      const prefetch = link.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute)
        && attribute.name.getText(page) === 'prefetch');
      expect(prefetch?.getText(page)).toBe('prefetch={false}');
    }
  });

  it('preserves the folder, project URLs and accessible brand labels', () => {
    const source = logoRail?.getText(page);
    expect(source).toContain("href='/studio?folder=examples'");
    expect(source).toContain('href={`/studio?project=${id}`}');
    expect(source).toContain('aria-label={gt(`Open ${name} in the Studio`)}');
  });
});
