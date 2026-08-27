import { describe, expect, it } from 'vitest';

import { POST } from '@/app/api/generate/route';

function generationRequest(body: unknown): Request {
  return new Request('https://www.glyphfield.com/api/generate', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

describe('POST /api/generate', () => {
  it('rejects undocumented dimension envelopes instead of silently generating defaults', async () => {
    const response = await POST(generationRequest({
      dimensions: { height: -1_000, width: -1_000 },
      kind: 'background',
      output: 'raw',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'unknown_field',
        field: 'request.dimensions',
      },
      schemaVersion: 1,
    });
  });

  it.each([-1_000, 0, 4_097, 10_000])(
    'rejects unsafe background widths before rendering: %s',
    async (width) => {
      const response = await POST(generationRequest({
        kind: 'background',
        settings: { height: 750, width },
      }));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: 'invalid_dimensions',
          field: 'settings.width',
        },
        schemaVersion: 1,
      });
    }
  );
});
