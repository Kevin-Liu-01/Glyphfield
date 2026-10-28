import { describe, expect, it } from 'vitest';

import { BUILT_IN_BRAND_IDENTITIES, hydrateBrandIdentities } from '../brandIdentity';
import { validateBrandIdentitySource } from '../brandSource';

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
    // Logos, the partner mark, and the brand font files the SVG embeds.
    expect(agentAssetPaths(plan)).toEqual(expect.arrayContaining([
      '/brands/gt/logos/mark-black.svg',
      '/brands/gt/proof/ramp.svg',
      '/fonts/inter-variable.ttf',
    ]));
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

  it('validates and preserves native Shaders.com props in generated recipes', () => {
    const plan = planAgentGeneration({ kind: 'design-sequence', shader: {
      materialId: 'shader-effects-aurora', settings: { effectProps: { intensity: 42, colorA: '#123456' } },
    } });
    expect(plan).toMatchObject({ shader: { materialId: 'shader-effects-aurora', settings: { effectProps: { intensity: 42, colorA: '#123456' } } } });
    expect(() => planAgentGeneration({ kind: 'design-sequence', shader: { materialId: 'shader-effects-aurora', settings: { effectProps: { intensity: -500 } } } })).toThrow();
    expect(() => planAgentGeneration({ kind: 'design-sequence', shader: { materialId: 'paper-gem-smoke', settings: { effectProps: { intensity: 42 } } } })).toThrow();
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

describe('brand-true deterministic generation', () => {
  const gtIdentity = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'gt')!;

  it('reads identity ids and full identity objects, and rejects stray preset fields', () => {
    const byObject = planAgentGeneration({ identity: JSON.parse(JSON.stringify(gtIdentity)), kind: 'template', template: 'blog' });
    expect(byObject.identity).toMatchObject({ id: 'gt', name: 'General Translation' });
    expect(agentAssetPaths(byObject)).toContain('/brands/gt/logos/mark-black.svg');
    expect(planAgentGeneration({ identity: { id: 'stripe' }, kind: 'template' }).identity.name).toBe('Stripe');
    expect(() => planAgentGeneration({ identity: { colors: [], preset: 'gt' }, kind: 'template' })).toThrow('{ preset: "gt" }');
    expect(() => planAgentGeneration({ identity: { id: 'nope' }, kind: 'template' })).toThrow('/api/identities');
    expect(planAgentGeneration({ identity: { preset: 'basement' }, kind: 'template' }).identity.name).toBe('Basement');
  });

  it('renders every template from the Studio brand templates with real identity content', () => {
    const ramp = planAgentGeneration({ identity: { preset: 'ramp' }, kind: 'template', slideLayout: 'metrics', template: 'slides' });
    const rampSvg = renderAgentGeneration(ramp, {}).content;
    expect(rampSvg).toContain('70,000+');
    expect(rampSvg).not.toContain('98.7%');
    const stripePartnership = renderAgentGeneration(planAgentGeneration({ identity: { preset: 'stripe' }, kind: 'template', template: 'partnership' }), {}).content;
    expect(stripePartnership).toContain('Stripe × Partner');
    expect(stripePartnership).not.toContain('Northstar');
    for (const template of ['opengraph', 'terminal'] as const) {
      const plan = planAgentGeneration({ format: 'square', identity: { preset: 'tailwind' }, kind: 'template', template });
      const artifact = renderAgentGeneration(plan, {});
      expect(artifact).toMatchObject({ height: 1080, width: 1080 });
      expect(artifact.content).toContain('Inter, &quot;Helvetica Neue&quot;, Arial, sans-serif');
    }
    expect(() => planAgentGeneration({ identity: { preset: 'gt' }, kind: 'template', layout: 'nope', template: 'blog' })).toThrow('layout');
    expect(() => planAgentGeneration({ identity: { preset: 'gt' }, kind: 'template', language: 'bash', template: 'blog' })).toThrow('language');
  });

  it('embeds the brand font files it is given', () => {
    const plan = planAgentGeneration({ identity: { preset: 'gt' }, kind: 'template', template: 'blog', title: 'Embedded' });
    const fontPath = agentAssetPaths(plan).find((path) => path.startsWith('/fonts/'))!;
    const artifact = renderAgentGeneration(plan, { [fontPath]: 'data:font/ttf;base64,AAEAAA==' });
    expect(artifact.content).toContain('@font-face{font-family:"x');
    expect(artifact.content).toContain('data:font/ttf;base64,AAEAAA==');
  });

  it('keeps backgrounds on the identity palette and never returns a blank pattern', () => {
    const stripe = planAgentGeneration({ identity: { preset: 'stripe' }, kind: 'background', settings: { style: 'gradient' } });
    expect(stripe).toMatchObject({ settings: { colorA: '#0A2540', colorB: '#533AFD', colorC: '#00D4FF' } });
    const gt = planAgentGeneration({ identity: { preset: 'gt' }, kind: 'background', settings: { style: 'gradient' } });
    expect(gt).not.toMatchObject({ settings: { colorA: (stripe as { settings: { colorA: string } }).settings.colorA } });
    const pattern = renderAgentGeneration(planAgentGeneration({ identity: { preset: 'ramp' }, kind: 'background', settings: { style: 'pattern' } }), {});
    expect(pattern.content).toMatch(/fill="url\(#pattern-[a-z]+\)"/);
    const explicit = planAgentGeneration({ identity: { preset: 'stripe' }, kind: 'background', settings: { colorA: '#112233' } });
    expect(explicit).toMatchObject({ settings: { colorA: '#112233' } });
  });
});

describe('full identity validation', () => {
  it('keeps every built-in and served identity valid under full source validation', () => {
    for (const identity of [...BUILT_IN_BRAND_IDENTITIES, ...hydrateBrandIdentities(null)]) {
      const { issues, ok } = validateBrandIdentitySource(JSON.parse(JSON.stringify(identity)), 'full');
      expect(ok, `${identity.id}: ${issues.filter(({ severity }) => severity === 'error').map(({ message }) => message).join(' ')}`).toBe(true);
    }
  });

  it('rejects a complete identity that fails the BrandIdentity schema', () => {
    const gt = JSON.parse(JSON.stringify(BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'gt')!)) as Record<string, unknown>;
    gt.samples = { code: { label: 'demo', snippet: 'x'.repeat(5_000) } };
    let error: { code?: string; field?: string } | undefined;
    try {
      planAgentGeneration({ identity: gt, kind: 'template', template: 'blog' });
    } catch (caught) {
      error = caught as { code?: string; field?: string };
    }
    expect(error).toMatchObject({ code: 'invalid_identity', field: 'identity.samples.code.snippet' });
  });
});
