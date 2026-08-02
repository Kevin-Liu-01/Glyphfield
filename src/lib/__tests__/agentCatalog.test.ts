import { describe, expect, it } from 'vitest';

import { AGENT_MANIFEST, OPENAPI_DOCUMENT } from '../agentApi';
import { AGENT_LAB_CATALOG, AGENT_SHADER_LIBRARY, AGENT_SURFACE_LIBRARY } from '../agentCatalog';
import { BACKGROUND_PRESETS } from '../backgroundSvg';
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

  it('publishes every deterministic Surface Lab recipe and its physical controls', () => {
    expect(AGENT_SURFACE_LIBRARY.count).toBe(BACKGROUND_PRESETS.length);
    expect(AGENT_SURFACE_LIBRARY.presets.map(({ id }) => id)).toEqual(BACKGROUND_PRESETS.map(({ id }) => id));
    expect(AGENT_SURFACE_LIBRARY.controls.surfaceMaterial.options).toContain('woven-wire');
    expect(AGENT_SURFACE_LIBRARY.controls.surfaceMaterial.options).toContain('kerf-wood');
    expect(AGENT_SURFACE_LIBRARY.staticShaderIds).toHaveLength(8);
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
