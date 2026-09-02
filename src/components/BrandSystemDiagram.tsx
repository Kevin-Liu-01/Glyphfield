import type { CSSProperties } from 'react';

import {
  brandTypographyFamily,
  brandTypographyRole,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { capVisibleFontWeight } from '@/lib/typography';

const DIAGRAM_CONTENT: Readonly<
  Record<string, { core: string; inputs: readonly string[]; outputs: readonly string[] }>
> = {
  basement: {
    core: 'Project world',
    inputs: ['Strategy', 'Identity', 'Product'],
    outputs: ['Campaign', 'Launch', 'Culture'],
  },
  cloudflare: {
    core: 'Global edge',
    inputs: ['Users', 'Applications', 'Networks'],
    outputs: ['Security', 'Performance', 'Compute'],
  },
  gt: {
    core: 'Context + translation',
    inputs: ['Product copy', 'Documentation', 'Code'],
    outputs: ['Review', 'Locale build', 'Delivery'],
  },
  mintlify: {
    core: 'Documentation graph',
    inputs: ['Code', 'OpenAPI', 'MDX'],
    outputs: ['Search', 'AI assistant', 'Published docs'],
  },
  ramp: {
    core: 'Policy + automation',
    inputs: ['Corporate cards', 'Accounts payable', 'Travel'],
    outputs: ['Live ledger', 'Cash visibility', 'Savings'],
  },
  starter: {
    core: 'Focus window',
    inputs: ['Research', 'Constraints', 'Evidence'],
    outputs: ['Direction', 'System', 'Artifact'],
  },
  stripe: {
    core: 'Payment intent',
    inputs: ['Customer', 'Payment method', 'API request'],
    outputs: ['Risk decision', 'Ledger', 'Settlement'],
  },
  tailwind: {
    core: 'Variant compiler',
    inputs: ['Design tokens', 'Utilities', 'Breakpoints'],
    outputs: ['Responsive UI', 'Dark mode', 'Components'],
  },
  viteplus: {
    core: 'vp',
    inputs: ['Runtime', 'Packages', 'Source'],
    outputs: ['Dev', 'Check + test', 'Build'],
  },
};

const DIAGRAM_ROWS = [78, 160, 242] as const;

type BrandSystemDiagramProps = {
  compact?: boolean;
  identity: BrandIdentity;
};

function textColorFor(hex: string): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return '#ffffff';
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return (red * 0.299) + (green * 0.587) + (blue * 0.114) > 154 ? '#111111' : '#ffffff';
}

export default function BrandSystemDiagram({ compact = false, identity }: BrandSystemDiagramProps) {
  const content = DIAGRAM_CONTENT[identity.id] ?? {
    core: identity.graphicSystem.device,
    inputs: identity.strategy.pillars.slice(0, 3),
    outputs: identity.products.slice(0, 3),
  };
  const ink = identity.colors.find((color) => color.id === 'ink')?.hex ?? '#181818';
  const paper = identity.colors.find((color) => color.id === 'paper')?.hex ?? '#ffffff';
  const accent = identity.colors.find((color) => color.id === 'emphasis')?.hex ?? ink;
  const body = brandTypographyRole(identity, 'Body');
  const style = {
    '--diagram-accent': accent,
    '--diagram-accent-text': textColorFor(accent),
    '--diagram-font': brandTypographyFamily(identity, 'Body'),
    '--diagram-font-weight': capVisibleFontWeight(body.weight ?? 400),
    '--diagram-ink': ink,
    '--diagram-paper': paper,
  } as CSSProperties;
  return (
    <div
      className='brand-system-diagram'
      data-brand-diagram={identity.id}
      data-compact={compact ? 'true' : 'false'}
      style={style}
    >
      <svg aria-label={`${identity.name} system diagram`} role='img' viewBox='0 0 960 320'>
        <rect className='brand-system-diagram-surface' height='320' width='960' />
        {DIAGRAM_ROWS.map((y, index) => {
          const label = content.inputs[index] ?? `Input ${index + 1}`;
          return (
            <g className='brand-system-diagram-input' key={label}>
              <rect height='54' width='214' x='32' y={y - 27} />
              <text x='52' y={y + 6}>{label}</text>
              <path d={`M246 ${y}H334`} />
              <path d={`M326 ${y - 5}L336 ${y}L326 ${y + 5}`} />
            </g>
          );
        })}
        <g className='brand-system-diagram-core'>
          <rect height='220' width='270' x='345' y='50' />
          <text textAnchor='middle' x='480' y='150'>{content.core}</text>
          <text className='brand-system-diagram-core-name' textAnchor='middle' x='480' y='182'>{identity.shortName}</text>
        </g>
        {DIAGRAM_ROWS.map((y, index) => {
          const label = content.outputs[index] ?? `Output ${index + 1}`;
          return (
            <g className='brand-system-diagram-output' key={label}>
              <path d={`M615 ${y}H704`} />
              <path d={`M696 ${y - 5}L706 ${y}L696 ${y + 5}`} />
              <rect height='54' width='220' x='708' y={y - 27} />
              <text x='728' y={y + 6}>{label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
