import { describe, expect, it } from 'vitest';

import { AGENT_MANIFEST, GLYPHFIELD_AGENT_SKILLS, OPENAPI_DOCUMENT } from '../agentApi';
import { AGENT_LAB_CATALOG, AGENT_SHADER_LIBRARY, AGENT_SURFACE_LIBRARY } from '../agentCatalog';
import { BACKGROUND_PRESETS, DEFAULT_BACKGROUND_SETTINGS } from '../backgroundSvg';
import { AGENT_GENERATION_REQUEST_FIELDS } from '../agentGeneration';
import { DISCOVERABLE_LIVE_MATERIAL_OPTIONS } from '../liveMaterials';
import { OPEN_SURFACE_LIBRARY, OPEN_SURFACE_PRESETS } from '../openSurfaceLibrary';
import { STICKER_FINISH_PRESETS } from '../surfaceSticker';
import { STUDIO_TOOLS } from '../studioCatalog';
import { shaderLabMaterials } from '../shaderLab';
import {
  STUDIO_AGENT_CAPABILITIES,
  STUDIO_STANDARD_ACTION_CONTRACTS,
  STUDIO_TOOL_ACTION_CONTRACTS,
} from '../studioAgentCapabilities';

describe('agent discovery catalogs', () => {
  it('derives every agent-visible shader from the shared Studio material library', () => {
    expect(AGENT_SHADER_LIBRARY.count).toBe(DISCOVERABLE_LIVE_MATERIAL_OPTIONS.length);
    expect(AGENT_SHADER_LIBRARY.materials.map(({ id }) => id)).toEqual(
      shaderLabMaterials('', 'all').map(({ id }) => id)
    );
    expect(AGENT_SHADER_LIBRARY.sharedBy).toEqual(['animation', 'material']);
  });

  it('publishes honest per-provider frame capture, seek and loop capabilities', () => {
    const fluid = AGENT_SHADER_LIBRARY.materials.find(({ id }) => id === 'pavel-fluid-energy');
    expect(fluid?.motion).toMatchObject({ motionModel: 'stateful', supportsPngSnapshot: true, supportsEditableSeek: false });
    const sphere = AGENT_SHADER_LIBRARY.materials.find(({ id }) => id === 'shadergradient-prismatic-sphere');
    expect(sphere?.motion.loop).toMatchObject({ kind: 'configured', pixelVerified: false });
    expect(AGENT_SHADER_LIBRARY.materials.every(({ motion }) => motion.supportsPngSnapshot)).toBe(true);
    expect(AGENT_SHADER_LIBRARY.framePersistence.appearance).toBe('lossless-png-snapshot');
    expect(AGENT_LAB_CATALOG.plugins.filter(({ capabilities }) => capabilities.shaderFrameCapture).map(({ id }) => id)).toEqual(['material']);
    expect(AGENT_MANIFEST.studioBrowserApi.toolActions).toBe(STUDIO_TOOL_ACTION_CONTRACTS);
    expect(Object.keys(AGENT_MANIFEST.studioBrowserApi.toolActions.material)).toEqual(
      Object.keys(STUDIO_TOOL_ACTION_CONTRACTS.material)
    );
    expect(AGENT_MANIFEST.studioBrowserApi.toolActions.material['design.export.project']).toMatchObject({
      input: 'No input',
      output: expect.stringContaining('non-empty application/json Blob, .glyphfield.json fileName, format JSON, previewKind file'),
    });
    expect(AGENT_MANIFEST.studioBrowserApi.toolActions.material['design.frame.pause']).toMatchObject({
      description: expect.stringContaining('without encoding PNGs or writing captured-frame assets'),
      input: 'No input',
      output: 'null',
    });
    expect(AGENT_MANIFEST.studioBrowserApi.toolActions.material['design.frame.capture'].output).toContain('embedded captured-frame assets');
    expect(AGENT_MANIFEST.studioBrowserApi.toolActions.material['design.frame.seek'].input).toContain('non-negative finite');
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
    expect(AGENT_LAB_CATALOG.plugins.every(({ capabilities }) => capabilities.browserApi)).toBe(true);
    expect(AGENT_LAB_CATALOG.plugins.every(({ capabilities }) => capabilities.controlAutomation)).toBe(true);
    expect(
      AGENT_LAB_CATALOG.plugins.filter(({ capabilities }) => capabilities.sourceEditing).map(({ id }) => id)
    ).toEqual(STUDIO_TOOLS.filter(({ id }) => id !== 'brand-book').map(({ id }) => id));
    expect(AGENT_LAB_CATALOG.plugins.find(({ id }) => id === 'brand-book')?.capabilities.source).toBe(false);
    expect(Object.keys(STUDIO_AGENT_CAPABILITIES)).toEqual(expect.arrayContaining(STUDIO_TOOLS.map(({ id }) => id)));
    expect(
      AGENT_LAB_CATALOG.plugins.find(({ id }) => id === 'material')?.capabilities.directHttpGeneration
    ).toContain('design-sequence');
  });

  it('publishes every deterministic Surface Lab recipe and its physical controls', () => {
    expect(AGENT_SURFACE_LIBRARY.count).toBe(BACKGROUND_PRESETS.length + OPEN_SURFACE_PRESETS.length);
    expect(AGENT_SURFACE_LIBRARY.presets.map(({ id }) => id)).toEqual([
      ...OPEN_SURFACE_PRESETS.map(({ id }) => id),
      ...BACKGROUND_PRESETS.map(({ id }) => id),
    ]);
    expect(AGENT_SURFACE_LIBRARY.openPbrAssets).toHaveLength(OPEN_SURFACE_LIBRARY.length);
    expect(AGENT_SURFACE_LIBRARY.controls.surfaceLibraryAssetId.options).toContain('polyhaven-oak-veneer');
    expect(AGENT_SURFACE_LIBRARY.controls.surfaceMaterial.options).toContain('woven-wire');
    expect(AGENT_SURFACE_LIBRARY.controls.surfaceMaterial.options).toContain('kerf-wood');
    expect(AGENT_SURFACE_LIBRARY.controls.surfaceMaterial.options).toContain('linen-weave');
    expect(AGENT_SURFACE_LIBRARY.controls.surfaceMaterial.options).toContain('pebbled-leather');
    expect(AGENT_SURFACE_LIBRARY.controls.surfaceMaterial.options).toContain('crackle-glaze');
    expect(AGENT_SURFACE_LIBRARY.controls.surfaceTextureAmount.maximum).toBe(100);
    expect(AGENT_SURFACE_LIBRARY.controls.surfaceIrregularity.default).toBe(DEFAULT_BACKGROUND_SETTINGS.surfaceIrregularity);
    expect(AGENT_SURFACE_LIBRARY.browserPreview).toMatchObject({ camera: 'fixed', userOrbit: false });
    expect(AGENT_SURFACE_LIBRARY.stickerFinishCount).toBe(STICKER_FINISH_PRESETS.length);
    expect(AGENT_SURFACE_LIBRARY.stickerFinishes.map(({ id }) => id)).toContain('precision-metal-inset');
    expect(AGENT_SURFACE_LIBRARY.stickerFinishes.find(({ id }) => id === 'holo-vinyl')?.source).toMatchObject({ license: 'MIT', name: 'HoloSticker' });
    expect(AGENT_SURFACE_LIBRARY.stickerControls.borderColor.type).toBe('hex-color');
    expect(AGENT_SURFACE_LIBRARY.stickerControls.seamWidth.maximum).toBe(12);
    expect(AGENT_SURFACE_LIBRARY.staticShaderIds).toHaveLength(8);
    expect(AGENT_SURFACE_LIBRARY.liveShaderCount).toBe(shaderLabMaterials('', 'all').length);
  });

  it('publishes the lab and material endpoints from the manifest and OpenAPI document', () => {
    expect(AGENT_MANIFEST.resources).toMatchObject({
      fullInstructions: '/llms-full.txt',
      labs: '/api/labs',
      materials: '/api/materials',
      markdownDocs: '/docs/:path.md',
      skillGuide: '/docs/skills.md',
      surfaceTextures: '/api/surface-textures/:assetId/:map',
    });
    expect(AGENT_MANIFEST.skills.packages).toEqual(GLYPHFIELD_AGENT_SKILLS);
    expect(GLYPHFIELD_AGENT_SKILLS.map(({ id }) => id)).toEqual([
      'glyphfield-create',
      'glyphfield-api',
      'glyphfield-studio',
      'glyphfield-export',
    ]);
    expect(OPENAPI_DOCUMENT.paths).toHaveProperty('/api/labs');
    expect(OPENAPI_DOCUMENT.paths).toHaveProperty('/api/materials');
    expect(OPENAPI_DOCUMENT.paths).toHaveProperty('/api/docs/{slug}');
    expect(OPENAPI_DOCUMENT.paths).toHaveProperty('/api/surface-textures/{assetId}/{map}');
    expect(OPENAPI_DOCUMENT.paths).toHaveProperty('/llms-full.txt');
    expect(AGENT_MANIFEST.studioBrowserApi.global).toBe('window.glyphfield.studio');
    expect(AGENT_MANIFEST.studioBrowserApi.operations.download).toContain('Blob');
    expect(AGENT_MANIFEST.studioBrowserApi.standardActions).toEqual(Object.keys(STUDIO_STANDARD_ACTION_CONTRACTS));
    expect(AGENT_MANIFEST.studioBrowserApi.standardActionContracts['source.apply'].input).toContain('JSON');
    expect(AGENT_MANIFEST.generation.kinds).toHaveProperty('design-sequence');
    expect(AGENT_MANIFEST.interfaces.browser.global).toBe('window.glyphfield.studio');
    expect(AGENT_MANIFEST.execution.never).toContain(
      'Do not invent catalog IDs, accessible labels, source fields, or enum values.'
    );
    expect(OPENAPI_DOCUMENT.paths).toHaveProperty('/api/search');
    expect(OPENAPI_DOCUMENT.paths).toHaveProperty('/api/github-stars');
    expect(OPENAPI_DOCUMENT.paths).toHaveProperty('/openapi.json');
    expect(OPENAPI_DOCUMENT.components.schemas.AgentGenerationRequest.oneOf).toHaveLength(4);
    expect(OPENAPI_DOCUMENT.paths['/api/generate'].post.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/AgentGenerationRequest',
    });
    for (const variant of OPENAPI_DOCUMENT.components.schemas.AgentGenerationRequest.oneOf) {
      const kind = variant.properties.kind.const as keyof typeof AGENT_GENERATION_REQUEST_FIELDS;
      expect(Object.keys(variant.properties).sort()).toEqual([...AGENT_GENERATION_REQUEST_FIELDS[kind]].sort());
      expect(variant.additionalProperties).toBe(false);
    }
  });
});
