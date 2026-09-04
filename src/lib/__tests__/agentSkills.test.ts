import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { AGENT_MANIFEST, GLYPHFIELD_AGENT_SKILLS } from '../agentApi';

const root = process.cwd();
const docs = [
  'content/docs/skills/index.mdx',
  'content/docs/skills/create.mdx',
  'content/docs/skills/api.mdx',
  'content/docs/skills/studio.mdx',
  'content/docs/skills/export.mdx',
].map((file) => readFileSync(path.join(root, file), 'utf8')).join('\n');
const llms = readFileSync(path.join(root, 'public/llms.txt'), 'utf8');
const agentIndex = readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
const rootNavigation = JSON.parse(
  readFileSync(path.join(root, 'content/docs/meta.json'), 'utf8')
) as { pages: string[] };
const skillsNavigation = JSON.parse(
  readFileSync(path.join(root, 'content/docs/skills/meta.json'), 'utf8')
) as { pages: string[]; title: string };

describe('Glyphfield Agent Skills', () => {
  it('publishes Skills as a first-class documentation section', () => {
    expect(rootNavigation.pages).toContain('skills');
    expect(skillsNavigation.title).toBe('Skills');
    expect(skillsNavigation.pages).toEqual(['index', 'create', 'api', 'studio', 'export']);
  });

  it('ships every discoverable package with valid entry metadata', () => {
    for (const skill of GLYPHFIELD_AGENT_SKILLS) {
      const directory = path.join(root, skill.repositoryPath);
      const entry = readFileSync(path.join(directory, 'SKILL.md'), 'utf8');
      const metadata = readFileSync(path.join(directory, 'agents/openai.yaml'), 'utf8');

      expect(entry).toContain(`name: ${skill.id}`);
      expect(entry).toMatch(/description: .{40,}/);
      expect(entry).not.toContain('TODO');
      expect(metadata).toContain(`$${skill.id}`);
      expect(metadata).not.toContain('TODO');
    }
  });

  it('keeps every linked skill reference inside its package', () => {
    for (const skill of GLYPHFIELD_AGENT_SKILLS) {
      const directory = path.join(root, skill.repositoryPath);
      const entry = readFileSync(path.join(directory, 'SKILL.md'), 'utf8');
      const references = [...entry.matchAll(/\]\((references\/[^)]+)\)/g)]
        .map((match) => match[1]);

      expect(references.length).toBeGreaterThan(0);
      for (const reference of references) {
        expect(existsSync(path.join(directory, reference))).toBe(true);
      }
    }
  });

  it('publishes the same suite to agents and human documentation', () => {
    expect(AGENT_MANIFEST.skills.packages).toEqual(GLYPHFIELD_AGENT_SKILLS);
    expect(AGENT_MANIFEST.resources.skillGuide).toBe('/docs/skills.md');
    expect(AGENT_MANIFEST.skills.guide).toBe('/docs/skills.md');

    for (const skill of GLYPHFIELD_AGENT_SKILLS) {
      expect(docs).toContain(`$${skill.id}`);
      expect(llms).toContain(skill.repositoryPath);
      expect(agentIndex).toContain(`${skill.repositoryPath}/SKILL.md`);
    }
  });
});
