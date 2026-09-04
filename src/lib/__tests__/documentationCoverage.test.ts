import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { STUDIO_TOOLS } from '../studioCatalog';

const documentationFiles = globSync('content/docs/**/*.mdx');
const documentation = documentationFiles
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');
const endpointReference = readFileSync('content/docs/reference/endpoints.mdx', 'utf8');
const llms = readFileSync('public/llms.txt', 'utf8');
const readme = readFileSync('README.md', 'utf8');
const rootMeta = JSON.parse(readFileSync('content/docs/meta.json', 'utf8')) as { pages: string[] };
const artifactMeta = JSON.parse(readFileSync('content/docs/artifacts/meta.json', 'utf8')) as { pages: string[] };
const referenceMeta = JSON.parse(readFileSync('content/docs/reference/meta.json', 'utf8')) as { pages: string[] };
const agentIndex = readFileSync('AGENTS.md', 'utf8');
const directorySkills = [
  'SKILL.md',
  'scripts/SKILL.md',
  'src/app/SKILL.md',
  'src/components/SKILL.md',
  'src/hooks/SKILL.md',
  'src/lib/SKILL.md',
].map((file) => readFileSync(file, 'utf8')).join('\n');

describe('documentation and agent coverage', () => {
  it('names every navigable Studio tool in the documentation corpus', () => {
    for (const tool of STUDIO_TOOLS) expect(documentation).toContain(tool.name);
  });

  it('documents every public machine and supporting endpoint', () => {
    for (const route of [
      '/api/agent',
      '/api/catalog',
      '/api/docs/{slug}',
      '/api/elements',
      '/api/generate',
      '/api/github-stars',
      '/api/identities',
      '/api/labs',
      '/api/materials',
      '/api/search',
      '/api/surface-textures/{assetId}/{map}',
      '/llms-full.txt',
      '/llms.txt',
      '/openapi.json',
    ]) expect(endpointReference).toContain(route);
  });

  it('keeps formats, current source versions, and visual examples discoverable', () => {
    for (const format of ['SVG', 'PNG', 'JPG', 'GIF', 'MP4', 'PDF', 'JSON', '.lottie']) {
      expect(documentation).toContain(format);
    }
    expect(documentation).toContain('CanvasDocument schema 2');
    expect(documentation).toContain('source version 4');
    expect(documentation).toContain('version-3 compatibility');
    expect(llms).toContain('response-schema-1');
    expect(llms).toContain('re-read the normalized CanvasDocument');
    expect(documentation.match(/<DocsMedia\b/g)?.length ?? 0).toBeGreaterThanOrEqual(25);
  });

  it('ships operational guidance in the public navigation', () => {
    for (const file of [
      'content/docs/artifacts/backup-and-restore.mdx',
      'content/docs/reference/accessibility.mdx',
      'content/docs/reference/api-security.mdx',
      'content/docs/reference/browser-support.mdx',
      'content/docs/reference/self-hosting.mdx',
      'content/docs/reference/troubleshooting.mdx',
      'content/docs/reference/version-compatibility.mdx',
      'content/docs/contributing.mdx',
    ]) expect(documentationFiles).toContain(file);

    expect(rootMeta.pages).toContain('contributing');
    expect(artifactMeta.pages).toContain('backup-and-restore');
    expect(referenceMeta.pages).toEqual(expect.arrayContaining([
      'accessibility',
      'api-security',
      'browser-support',
      'self-hosting',
      'troubleshooting',
      'version-compatibility',
    ]));
  });

  it('routes changing catalogs to discovery instead of stale prose', () => {
    expect(documentation).not.toMatch(/\b141 materials?\b/i);
    expect(readme).not.toMatch(/\b141 materials?\b/i);
    expect(readme).not.toContain('Playground surfaces');
    expect(documentation).toContain('/api/materials');
    expect(documentation).toContain('/api/labs');
  });

  it('gives agents actionable discovery, mutation, export, and verification rules', () => {
    for (const operation of ['describe()', 'readSource()', 'applySource', 'design.export']) {
      expect(llms).toContain(operation);
    }
    expect(llms).toContain('Preserve every unknown field');
    expect(llms).toContain('inspect multiple frames');
    expect(agentIndex).toContain('update the complete parity chain');
    expect(agentIndex).toContain('version-3 compatibility');
    expect(directorySkills).toContain('version-3 compatibility');
    expect(directorySkills).not.toContain('agent-docs:fill');
    expect(directorySkills).not.toContain('_purpose_');
  });
});
