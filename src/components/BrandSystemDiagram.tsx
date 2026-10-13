import { useId, type CSSProperties } from 'react';

import {
  brandTypographyFamily,
  brandTypographyRole,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { brandDeviceMarkup, brandPalette, contrastRatio, readableOn } from '@/lib/brandOutputKit';
import { mixHexColors } from '@/lib/color';
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

const ROWS = [96, 160, 224] as const;
const WIDTH = 960;
const HEIGHT = 320;

type BrandSystemDiagramProps = {
  compact?: boolean;
  identity: BrandIdentity;
};

/** Identities whose rules forbid connecting content with boxes or lines get a typographic diagram. */
function allowsConnectors(identity: BrandIdentity): boolean {
  const rules = [...(identity.graphicSystem?.rules ?? []), ...(identity.dossier?.prohibited ?? [])].join(' ');
  return !/(?:connected workflow boxes|diagram boxes or lines|flowcharts)/i.test(`${rules} ${identity.graphicSystem?.imageDirection ?? ''}`);
}

export default function BrandSystemDiagram({ compact = false, identity }: BrandSystemDiagramProps) {
  const scope = `sd${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const content = DIAGRAM_CONTENT[identity.id] ?? {
    core: identity.graphicSystem.device,
    inputs: identity.strategy.pillars.slice(0, 3),
    outputs: identity.products.slice(0, 3),
  };
  const palette = brandPalette(identity);
  const ink = palette.ink;
  const paper = palette.paper;
  const quiet = mixHexColors(ink, paper, 0.42);
  const rule = mixHexColors(ink, paper, 0.84);
  const accent = palette.accent;
  // A pale accent (a highlighter, a silver) draws connectors in the quiet ink instead.
  const connectorColor = contrastRatio(accent, paper) >= 2 ? accent : quiet;
  const connectors = allowsConnectors(identity);
  const body = brandTypographyRole(identity, 'Body');
  const display = brandTypographyRole(identity, 'Display');
  const coreX = 372;
  const coreWidth = 216;
  const coreY = 56;
  const coreHeight = 208;
  const device = brandDeviceMarkup(identity, { height: coreHeight, prefix: scope, tone: 'dark', width: coreWidth });
  const coreText = readableOn(palette.deep, palette);
  const style = {
    '--diagram-accent': accent,
    '--diagram-accent-text': readableOn(accent, palette),
    '--diagram-font': brandTypographyFamily(identity, 'Body'),
    '--diagram-font-weight': capVisibleFontWeight(body.weight ?? 400),
    '--diagram-ink': ink,
    '--diagram-paper': paper,
  } as CSSProperties;
  const bodyFont = `'${brandTypographyFamily(identity, 'Body')}', sans-serif`;
  const displayFont = `'${brandTypographyFamily(identity, 'Display')}', sans-serif`;
  const codeFont = `'${brandTypographyFamily(identity, 'Code')}', monospace`;

  return (
    <div
      className='brand-system-diagram'
      data-brand-diagram={identity.id}
      data-compact={compact ? 'true' : 'false'}
      data-connectors={connectors ? 'true' : 'false'}
      style={style}
    >
      <svg aria-label={`${identity.name} system diagram: ${content.inputs.join(', ')} become ${content.outputs.join(', ')} through ${content.core}`} role='img' viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <rect fill={paper} height={HEIGHT} width={WIDTH} />
        <text fill={quiet} fontFamily={codeFont} fontSize='11' letterSpacing='1.2' x='40' y='48'>INPUTS</text>
        <text fill={quiet} fontFamily={codeFont} fontSize='11' letterSpacing='1.2' textAnchor='end' x={WIDTH - 40} y='48'>OUTCOMES</text>
        {ROWS.map((y, index) => {
          const input = content.inputs[index] ?? '';
          const output = content.outputs[index] ?? '';
          return (
            <g key={y}>
              <rect fill={rule} height='1' width='240' x='40' y={y + 18} />
              <text fill={quiet} fontFamily={codeFont} fontSize='11' x='40' y={y + 4}>{String(index + 1).padStart(2, '0')}</text>
              <text fill={ink} fontFamily={bodyFont} fontSize='20' x='72' y={y + 6}>{input}</text>
              <rect fill={rule} height='1' width='240' x={WIDTH - 280} y={y + 18} />
              <text fill={ink} fontFamily={bodyFont} fontSize='20' textAnchor='end' x={WIDTH - 72} y={y + 6}>{output}</text>
              <text fill={quiet} fontFamily={codeFont} fontSize='11' textAnchor='end' x={WIDTH - 40} y={y + 4}>{String(index + 1).padStart(2, '0')}</text>
              {connectors ? (
                <>
                  <path d={`M284 ${y}C330 ${y} 330 ${HEIGHT / 2} ${coreX} ${HEIGHT / 2}`} fill='none' stroke={connectorColor} strokeOpacity='0.75' strokeWidth='1.5' />
                  <path d={`M${coreX + coreWidth} ${HEIGHT / 2}C630 ${HEIGHT / 2} 630 ${y} ${WIDTH - 284} ${y}`} fill='none' stroke={connectorColor} strokeOpacity='0.75' strokeWidth='1.5' />
                </>
              ) : null}
            </g>
          );
        })}
        <svg height={coreHeight} overflow='hidden' viewBox={`0 0 ${coreWidth} ${coreHeight}`} width={coreWidth} x={coreX} y={coreY}>
          <g dangerouslySetInnerHTML={{ __html: device }} />
          <rect fill={palette.deep} height='68' width={coreWidth} y={coreHeight - 68} />
          <text fill={coreText} fontFamily={displayFont} fontSize={content.core.length > 18 ? 17 : 21} fontWeight={capVisibleFontWeight(display.weight ?? 500)} x='16' y={coreHeight - 38}>{content.core}</text>
          <text fill={coreText} fillOpacity='0.66' fontFamily={codeFont} fontSize='11' letterSpacing='1' x='16' y={coreHeight - 18}>{identity.shortName.toLocaleUpperCase()} · CORE</text>
        </svg>
      </svg>
    </div>
  );
}
