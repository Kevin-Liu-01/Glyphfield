import { describe, expect, it } from 'vitest';

import { AGENT_MANIFEST, OPENAPI_DOCUMENT } from '../agentApi';
import { AGENT_LAB_CATALOG, AGENT_SHADER_LIBRARY } from '../agentCatalog';
import { LIVE_MATERIAL_OPTIONS } from '../liveMaterials';
import { STUDIO_TOOLS } from '../studioCatalog';

describe('agent discovery catalogs', () => {
  it('derives every agent-visible shader from the shared Studio material library', () => {
    expect(AGENT_SHADER_LIBRARY.count).toBe(LIVE_MATERIAL_OPTIONS.length);
    expect(AGENT_SHADER_LIBRARY.materials.map(({ id }) => id)).toEqual(
      LIVE_MATERIAL_OPTIONS.map(({ id }) => id)
    );
    expect(AGENT_SHADER_LIBRARY.sharedBy).toEqual(['animation', 'material']);
  });

  it('derives every lab plugin from the navigable Studio catalog', () => {
    expect(AGENT_LAB_CATALOG.count).toBe(STUDIO_TOOLS.length);
    expect(AGENT_LAB_CATALOG.plugins.map(({ id }) => id)).toEqual(
      STUDIO_TOOLS.map(({ id }) => id)
    );
    expect(
      AGENT_LAB_CATALOG.plugins
        .filter(({ capabilities }) => capabilities.sharedShaderLibrary)
        .map(({ id }) => id)
    ).toEqual(['animation', 'material']);
  });

  it('publishes the lab and material endpoints from the manifest and OpenAPI document', () => {
    expect(AGENT_MANIFEST.resources).toMatchObject({
      labs: '/api/labs',
      materials: '/api/materials',
    });
    expect(OPENAPI_DOCUMENT.paths).toHaveProperty('/api/labs');
    expect(OPENAPI_DOCUMENT.paths).toHaveProperty('/api/materials');
  });
});
