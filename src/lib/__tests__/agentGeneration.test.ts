import { describe, expect, it } from 'vitest';

import {
  agentAssetPaths,
  planAgentGeneration,
  renderAgentGeneration,
} from '../agentGeneration';

describe('planAgentGeneration', () => {
  it('plans a standalone GT partnership with real bundled logo assets', () => {
    const plan = planAgentGeneration({
      identity: { preset: 'gt' },
      kind: 'template',
      template: 'partnership',
      title: 'General Translation × Ramp',
    });

    expect(plan).toMatchObject({
      kind: 'template',
      template: 'partnership',
    });
    expect(agentAssetPaths(plan)).toEqual([
      '/brands/gt/logos/mark-black.svg',
      '/brands/gt/proof/ramp.svg',
    ]);
  });

  it('resolves audited reference presets through the public agent contract', () => {
    const plan = planAgentGeneration({
      identity: { preset: 'stripe' },
      kind: 'background',
      settings: {
        colorA: '#0A2540',
        colorB: '#635BFF',
        height: 630,
        lightingEnabled: false,
        style: 'grain-gradient',
        width: 1200,
      },
    });

    expect(plan.identity).toMatchObject({
      id: 'stripe',
      name: 'Stripe',
    });
    expect(plan).toMatchObject({ settings: { lightingEnabled: false } });
    expect(agentAssetPaths(plan)).toEqual([
      '/brands/stripe/logos/wordmark-white.svg',
    ]);
  });

  it('rejects unknown generators and unsafe background dimensions', () => {
    expect(() => planAgentGeneration({ kind: 'video' })).toThrow('kind');
    expect(() =>
      planAgentGeneration({
        kind: 'background',
        settings: { height: 4096, width: 4096 },
      })
    ).toThrow('pixel');
    expect(() =>
      planAgentGeneration({
        kind: 'background',
        settings: { ditherMatrix: 3 },
      })
    ).toThrow('ditherMatrix');
    expect(() =>
      planAgentGeneration({
        kind: 'background',
        settings: { lightingEnabled: 'no' },
      })
    ).toThrow('lightingEnabled');
  });

  it('rejects element briefs for IDs outside the public catalog', () => {
    expect(() =>
      planAgentGeneration({ elementId: 'not-real', kind: 'element-brief' })
    ).toThrow('elementId');
  });

  it('plans the exact Design Lab shader-sequence contract for browser execution', () => {
    const plan = planAgentGeneration({
      effect: { kind: 'bayer', opacity: 0.76 },
      export: { fps: 30, quality: 'best', width: 1920 },
      identity: { preset: 'gt' },
      kind: 'design-sequence',
      sequence: { cutCount: 10, finalHoldMs: 5000, pace: 'accelerating' },
      shader: { materialId: 'paper-gem-smoke', shaderSize: 1.4 },
      texts: [{ value: 'Open Source', y: 180 }],
    });

    expect(plan).toMatchObject({
      exportSettings: { fps: 30, quality: 'best', width: 1920 },
      kind: 'design-sequence',
      sequence: { cutCount: 10, finalHoldMs: 5000, pace: 'accelerating' },
      shader: { materialId: 'paper-gem-smoke', shaderSize: 1.4 },
    });
    expect(agentAssetPaths(plan)).toEqual(['/brands/gt/logos/mark-white.svg']);
  });

  it('rejects undocumented Design Lab materials and sequence bounds', () => {
    expect(() => planAgentGeneration({
      kind: 'design-sequence',
      shader: { materialId: 'made-up-shader' },
    })).toThrow('/api/materials');
    expect(() => planAgentGeneration({
      kind: 'design-sequence',
      sequence: { cutCount: 20 },
    })).toThrow('sequence.cutCount');
    expect(() => planAgentGeneration({
      kind: 'design-sequence',
      shader: { settings: { frequency: 99 } },
    })).toThrow('shader.settings.frequency');
  });
});

describe('renderAgentGeneration', () => {
  it('renders a self-contained SVG with supplied asset data', () => {
    const plan = planAgentGeneration({
      identity: { preset: 'gt' },
      kind: 'template',
      template: 'slides',
      title: 'A&B <launch>',
    });
    const [brandPath] = agentAssetPaths(plan);
    const artifact = renderAgentGeneration(plan, {
      [brandPath!]: 'data:image/svg+xml;base64,BRAND',
    });

    expect(artifact).toMatchObject({
      height: 900,
      mimeType: 'image/svg+xml',
      width: 1600,
    });
    expect(artifact.content).toContain('data:image/svg+xml;base64,BRAND');
    expect(artifact.content).toContain('A&amp;B &lt;launch&gt;');
    expect(artifact.content).not.toContain('/brands/gt/');
  });

  it('renders agent-selected slide layouts and body content', () => {
    const plan = planAgentGeneration({
      body: 'Discover\nDesign\nBuild\nShip',
      identity: { preset: 'starter' },
      kind: 'template',
      slideLayout: 'timeline',
      template: 'slides',
      title: 'From idea to launch',
    });
    const artifact = renderAgentGeneration(plan, {});

    expect(artifact.content).toContain('Discover');
    expect(artifact.content).toContain('Ship');
    expect(artifact.content).toContain('From idea to launch');
  });

  it('renders an identity-aware catalog brief as JSON', () => {
    const plan = planAgentGeneration({
      elementId: 'email-signature',
      identity: { name: 'Acme', preset: 'custom', website: 'acme.test' },
      kind: 'element-brief',
    });
    const artifact = renderAgentGeneration(plan, {});
    const brief = JSON.parse(artifact.content) as {
      element: { symbol: string };
      identity: { name: string; website: string };
    };

    expect(artifact.mimeType).toBe('application/json');
    expect(brief.element.symbol).toBe('@');
    expect(brief.identity).toMatchObject({ name: 'Acme', website: 'acme.test' });
  });

  it('renders an API-generated composition that round-trips through the Design Lab browser API', () => {
    const plan = planAgentGeneration({
      effect: { kind: 'ascii' },
      identity: { preset: 'gt' },
      kind: 'design-sequence',
      shader: { materialId: 'paper-gem-smoke' },
      texts: [{ value: 'Open Source' }, { value: 'Built together', y: 160 }],
    });
    const [logoPath] = agentAssetPaths(plan);
    const artifact = renderAgentGeneration(plan, {
      [logoPath!]: 'data:image/svg+xml;base64,MARK',
    });
    const result = JSON.parse(artifact.content) as {
      automation: {
        export: string;
        exports: Record<'gif' | 'jpg' | 'mp4' | 'png' | 'shaderSequenceGif' | 'shaderSequenceMp4', string>;
        global: string;
      };
      document: {
        composition: { effectLayers: unknown[]; layerOrder: string[]; logos: Array<{ url: string }>; textLayers: unknown[] };
        exportSettings: { width: number };
        shaderSequence: { cutCount: number; targetLayerId: string };
        version: number;
      };
      sequence: { durationMs: number; timeline: Array<{ durationMs: number }> };
    };

    expect(artifact.mimeType).toBe('application/json');
    expect(result.document.version).toBe(3);
    expect(result.document.composition.textLayers).toHaveLength(2);
    expect(result.document.composition.effectLayers).toHaveLength(1);
    expect(result.document.composition.logos[0]?.url).toBe('data:image/svg+xml;base64,MARK');
    expect(result.document.composition.layerOrder).toEqual([
      'shader-canvas-1',
      'effect-sequence-1',
      'logo-brand',
      'text-agent-1',
      'text-agent-2',
    ]);
    expect(result.document.shaderSequence).toMatchObject({ cutCount: 10, targetLayerId: 'shader-canvas-1' });
    expect(result.document.exportSettings.width).toBe(1920);
    expect(result.sequence.timeline).toHaveLength(10);
    expect(result.sequence.timeline.at(-1)?.durationMs).toBe(5000);
    expect(result.automation.global).toBe('window.glyphfield.studio');
    expect(result.automation.export).toContain("format: 'mp4'");
    expect(result.automation.export).toContain("mode: 'shader-sequence'");
    expect(result.automation.export).toContain('download: true');
    expect(Object.keys(result.automation.exports)).toEqual([
      'gif',
      'jpg',
      'mp4',
      'png',
      'shaderSequenceGif',
      'shaderSequenceMp4',
    ]);
    expect(result.automation.exports.png).toContain("format: 'png'");
    expect(result.automation.exports.gif).toContain("format: 'gif'");
    expect(result.automation.exports.mp4).toContain("format: 'mp4'");
  });
});
