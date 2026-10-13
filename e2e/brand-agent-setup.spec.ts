import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { waitForStudioSource } from './studio-ui-helpers';

const MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#0E1621" d="M8 44 30 12h8L22 36h20l14-20L40 52h-8l10-16H22l-6 8z"/></svg>';

test('an agent sets up a new brand through the Brand identity Browser API', async ({ page }) => {
  await page.goto('/studio?tool=identity&project=starter');
  await waitForStudioSource(page);
  await page.getByRole('button', { name: 'Add brand project', exact: true }).click();
  await page.getByRole('menu', { name: 'New project', exact: true }).getByRole('menuitem', { name: /^Brand identity / }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource()).kind)).toBe('custom');

  const prompt = await page.evaluate(async () => window.glyphfield!.studio.invoke('identity.setup.prompt') as Promise<{ mode: string; prompt: string }>);
  expect(prompt.mode).toBe('new');
  expect(prompt.prompt).toContain('identity.apply');

  const invalid = await page.evaluate(async () => window.glyphfield!.studio.invoke('identity.validate', {
    identity: { colors: [{ hex: '#12', id: 'ink' }] },
  }) as Promise<{ issues: { path: string }[]; ok: boolean }>);
  expect(invalid.ok).toBe(false);
  expect(invalid.issues[0]?.path).toBe('colors[0].hex');

  const applied = await page.evaluate(async () => window.glyphfield!.studio.invoke('identity.apply', { identity: {
    colorPairings: [{ background: 'paper', foreground: 'ink', level: 'AA', usage: 'Body text' }],
    colors: [{ hex: '#0E1621', id: 'ink' }, { hex: '#1F6FEB', id: 'emphasis', name: 'Kestrel blue', proportion: 8, role: 'Live signal' }],
    name: 'Kestrel',
    tagline: 'Weather you can build on.',
    voice: { examples: [{ avoid: 'Oops!', context: 'Error', write: 'That location has no station nearby.' }] },
  } }) as Promise<{ health: { score: number }; identity: { name: string } }>);
  expect(applied.identity.name).toBe('Kestrel');

  await page.evaluate(async (svg) => window.glyphfield!.studio.invoke('identity.asset.add', {
    file: new File([svg], 'kestrel.svg', { type: 'image/svg+xml' }),
    slot: 'mark-dark',
  }), MARK);
  const bytes = [...readFileSync('public/fonts/brands/tailwind/ibm-plex-mono-400.woff2')];
  const font = await page.evaluate(async (data) => window.glyphfield!.studio.invoke('identity.font.add', {
    file: new File([new Uint8Array(data)], 'IBMPlexMono-Regular.woff2'),
    license: 'SIL Open Font License 1.1',
    roles: ['Code'],
  }) as Promise<{ font: { family: string; format: string } }>, bytes);
  expect(font.font).toMatchObject({ family: 'IBMPlexMono', format: 'woff2' });

  const audit = await page.evaluate(async () => window.glyphfield!.studio.invoke('identity.audit') as Promise<{ findings: { fix?: { id: string }; id: string }[]; score: number }>);
  expect(audit.findings.some(({ id }) => id === 'logo-mark-dark')).toBe(false);
  const fix = audit.findings.find(({ fix }) => fix)?.fix?.id;
  if (fix) await page.evaluate(async (fixId) => window.glyphfield!.studio.invoke('identity.fix', { fixId }), fix);

  await page.evaluate(async () => window.glyphfield!.studio.invoke('identity.save'));
  const kit = await page.evaluate(async () => {
    const artifact = await window.glyphfield!.studio.invoke('identity.export.kit', { format: 'zip' }) as { blob: Blob; fileName: string };
    const head = [...new Uint8Array(await artifact.blob.slice(0, 4).arrayBuffer())];
    return { fileName: artifact.fileName, head, size: artifact.blob.size, type: artifact.blob.type };
  });
  expect(kit).toMatchObject({ fileName: 'kestrel-brand-kit.zip', head: [0x50, 0x4b, 0x03, 0x04], type: 'application/zip' });
  expect(kit.size).toBeGreaterThan(1_000);

  await page.reload();
  await waitForStudioSource(page);
  const persisted = await page.evaluate(() => JSON.parse(window.glyphfield!.studio.readSource()));
  expect(persisted).toMatchObject({ name: 'Kestrel', tagline: 'Weather you can build on.' });
  expect(persisted.assets.find(({ id }: { id: string }) => id === 'mark-dark').label).toBe('Kestrel mark for light surfaces');
});
