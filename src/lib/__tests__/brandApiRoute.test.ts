import { describe, expect, it } from 'vitest';

import { GET as GET_KIT, POST as POST_KIT } from '@/app/api/brand/kit/route';
import { GET as GET_VALIDATE, POST as POST_VALIDATE } from '@/app/api/brand/validate/route';
import { createBrandIdentity } from '@/lib/brandIdentity';

function post(path: string, body: unknown, contentType = 'application/json'): Request {
  return new Request(`https://www.glyphfield.com${path}`, {
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': contentType },
    method: 'POST',
  });
}

const identity = JSON.parse(JSON.stringify(createBrandIdentity('Acme', 'acme')));

describe('/api/brand/validate', () => {
  it('publishes the schema, merge rules and logo slots', async () => {
    const contract = await GET_VALIDATE().json();
    expect(contract).toMatchObject({ endpoint: '/api/brand/validate', method: 'POST', schemaVersion: 1 });
    expect(contract.schema.required).toEqual(['id', 'name', 'assets', 'colors', 'typography']);
    expect(contract.logoSlots.map(({ id }: { id: string }) => id)).toContain('mark-mono');
  });

  it('normalizes a valid identity and returns its health audit', async () => {
    const response = await POST_VALIDATE(post('/api/brand/validate', { identity }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body).toMatchObject({ identity: { id: 'acme', name: 'Acme' }, ok: true, schemaVersion: 1 });
    expect(body.health.score).toBeGreaterThan(0);
  });

  it('returns precise issues for an invalid patch without failing the request', async () => {
    const response = await POST_VALIDATE(post('/api/brand/validate', {
      identity: { assets: [{ id: 'mark-dark', path: 'https://acme.test/logo.svg' }], colors: [{ hex: '#12', id: 'ink' }] },
      mode: 'patch',
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'remote_url', path: 'assets[0].path' }),
      expect.objectContaining({ code: 'format', path: 'colors[0].hex' }),
    ]));
    expect(body.identity).toBeNull();
  });

  it('rejects unknown envelope fields, wrong media types and bad JSON', async () => {
    const unknown = await POST_VALIDATE(post('/api/brand/validate', { identity, persist: true }));
    expect(unknown.status).toBe(400);
    await expect(unknown.json()).resolves.toMatchObject({ error: { code: 'unknown_field', field: 'persist' } });
    expect((await POST_VALIDATE(post('/api/brand/validate', 'x', 'text/plain'))).status).toBe(415);
    const malformed = await POST_VALIDATE(post('/api/brand/validate', '{'));
    await expect(malformed.json()).resolves.toMatchObject({ error: { code: 'invalid_json' } });
  });
});

describe('/api/brand/kit', () => {
  it('renders each text format with its media type', async () => {
    expect((await GET_KIT().json()).formats).toHaveProperty('tailwind');
    const tokens = await POST_KIT(post('/api/brand/kit', { format: 'dtcg', identity }));
    expect(tokens.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await tokens.json()).toHaveProperty('color.ink.$type', 'color');
    const theme = await POST_KIT(post('/api/brand/kit', { format: 'tailwind', identity }));
    expect(await theme.text()).toContain('@theme {');
    const markdown = await POST_KIT(post('/api/brand/kit', { format: 'markdown', identity }));
    expect(markdown.headers.get('content-disposition')).toBe('inline; filename="brand.md"');
  });

  it('rejects an invalid identity with the first precise issue', async () => {
    const response = await POST_KIT(post('/api/brand/kit', { format: 'css', identity: { ...identity, colors: [{ hex: 'red', id: 'ink', name: 'Ink', role: 'Text' }] } }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_identity', field: 'identity.colors[0].hex' } });
  });
});
