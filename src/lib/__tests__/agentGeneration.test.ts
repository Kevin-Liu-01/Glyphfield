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
      '/brands/gt/logos/wordmark-black.svg',
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
        style: 'grain-gradient',
        width: 1200,
      },
    });

    expect(plan.identity).toMatchObject({
      id: 'stripe',
      name: 'Stripe',
    });
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
  });

  it('rejects element briefs for IDs outside the public catalog', () => {
    expect(() =>
      planAgentGeneration({ elementId: 'not-real', kind: 'element-brief' })
    ).toThrow('elementId');
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
});
