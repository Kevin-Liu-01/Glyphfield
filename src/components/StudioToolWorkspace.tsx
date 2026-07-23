'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import {
  Check,
  Copy,
  Download,
  FileImage,
  Upload,
} from 'lucide-react';

import DesignBoard from '@/components/DesignBoard';
import BrandElementsStudio from '@/components/BrandElementsStudio';
import BackgroundStudio from '@/components/BackgroundStudio';
import BrandSettingsStudio from '@/components/BrandSettingsStudio';
import CanvasViewport from '@/components/CanvasViewport';
import LogoShaderStudio from '@/components/LogoShaderStudio';
import { Button } from '@/components/ui/Button';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { brandAssetPath, type BrandIdentity } from '@/lib/brandIdentity';
import { formatOklch, normalizeHex } from '@/lib/color';
import {
  CODE_THEME,
  highlightCode,
  type CodeLanguage,
} from '@/lib/codeHighlight';
import {
  downloadSvgAsPng,
  escapeXml,
  imageUrlToDataUrl,
} from '@/lib/download';
import type { StudioTool, StudioToolId } from '@/lib/studioCatalog';
import {
  defaultTemplatePartner,
  templateBrandLogo,
  templatePartnerOptions,
  type TemplateKind,
} from '@/lib/templateAssets';
import { buildTemplateSvg, type SlideLayout, type TemplateTexture } from '@/lib/templateSvg';

const INPUT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-foreground';
const TEXTAREA_CLASS =
  'min-h-28 w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-6 text-foreground outline-none focus:border-foreground';

type LocalAsset = {
  name: string;
  url: string;
};

function useLocalAsset() {
  const [asset, setAsset] = useState<LocalAsset | null>(null);
  const assetRef = useRef<LocalAsset | null>(null);
  assetRef.current = asset;

  useMountEffect(
    () => () => {
      if (assetRef.current) URL.revokeObjectURL(assetRef.current.url);
    }
  );

  function select(file: File) {
    if (assetRef.current) URL.revokeObjectURL(assetRef.current.url);
    const nextAsset = { name: file.name, url: URL.createObjectURL(file) };
    assetRef.current = nextAsset;
    setAsset(nextAsset);
  }

  function clear() {
    if (assetRef.current) URL.revokeObjectURL(assetRef.current.url);
    assetRef.current = null;
    setAsset(null);
  }

  return { asset, clear, select };
}

type CustomFontAsset = {
  family: string;
  name: string;
  url: string;
};

function useCustomFont() {
  const [font, setFont] = useState<CustomFontAsset | null>(null);
  const fontRef = useRef(font);
  fontRef.current = font;

  useMountEffect(
    () => () => {
      if (fontRef.current) URL.revokeObjectURL(fontRef.current.url);
    }
  );

  async function select(file: File) {
    if (fontRef.current) URL.revokeObjectURL(fontRef.current.url);
    const url = URL.createObjectURL(file);
    const family = `Studio-${crypto.randomUUID()}`;
    const loadedFont = new FontFace(family, `url(${url})`);
    await loadedFont.load();
    document.fonts.add(loadedFont);
    setFont({ family, name: file.name, url });
  }

  return { font, select };
}

function ToolShell({
  actions,
  children,
  inspector,
  tool,
}: {
  actions?: ReactNode;
  children: ReactNode;
  inspector: ReactNode;
  tool: StudioTool;
}) {
  const gt = useGT();

  return (
    <div className='tool-shell h-full min-h-0'>
      <header className='tool-header flex min-h-16 items-center justify-between gap-4 border-b border-border px-5 py-3'>
        <div className='min-w-0'>
          <p className='text-lg font-semibold tracking-tight'>{gt(tool.name)}</p>
          <p className='truncate text-sm text-muted-foreground'>{gt(tool.description)}</p>
        </div>
        {actions ? <div className='flex shrink-0 items-center gap-2'>{actions}</div> : null}
      </header>
      <div className='tool-body'>
        <aside className='tool-inspector min-h-0 overflow-y-auto border-r border-border bg-background'>
          {inspector}
        </aside>
        <div className='tool-canvas min-h-0 overflow-auto'>{children}</div>
      </div>
    </div>
  );
}

function ControlSection({ children, title }: { children: ReactNode; title: ReactNode }) {
  return (
    <section className='flex flex-col gap-4 border-b border-border p-5 last:border-b-0'>
      <h2 className='text-sm font-semibold'>{title}</h2>
      {children}
    </section>
  );
}

function Field({ children, label }: { children: ReactNode; label: ReactNode }) {
  return (
    <label className='flex flex-col gap-2 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      {children}
    </label>
  );
}

function RangeField({
  label,
  max,
  min,
  onChange,
  suffix,
  value,
}: {
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix: string;
  value: number;
}) {
  return (
    <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
      <span className='flex items-center justify-between gap-3'>
        <span>{label}</span>
        <output className='font-mono text-xs tabular-nums'>{value}{suffix}</output>
      </span>
      <input className='studio-range' max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type='range' value={value} />
    </label>
  );
}

function SegmentedChoice<T extends string | number>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  value: T;
}) {
  const gt = useGT();

  return (
    <div className='grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border'>
      {options.map((option) => (
        <Button
          className='rounded-none border-0'
          key={option.value}
          onClick={() => onChange(option.value)}
          size='sm'
          type='button'
          variant={value === option.value ? 'default' : 'secondary'}
        >
          {gt(option.label)}
        </Button>
      ))}
    </div>
  );
}

function UploadField({
  accept,
  fileName,
  label,
  onFile,
}: {
  accept: string;
  fileName?: string;
  label: string;
  onFile: (file: File) => void;
}) {
  const gt = useGT();

  return (
    <label className='flex min-h-20 cursor-pointer items-center gap-3 rounded-md border border-dashed border-input p-3 hover:bg-muted'>
      <Upload className='size-4 shrink-0' aria-hidden='true' />
      <span className='min-w-0 flex-1'>
        <span className='block text-sm font-medium'>{gt(label)}</span>
        <span className='block truncate text-xs text-muted-foreground'>
          {fileName ?? gt('Choose a local file')}
        </span>
      </span>
      <input
        accept={accept}
        className='sr-only'
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
        type='file'
      />
    </label>
  );
}

function PreviewLabel({ children }: { children: ReactNode }) {
  return (
    <div className='absolute top-3 left-3 rounded-md border border-border bg-background/90 px-2 py-1 font-mono text-xs text-muted-foreground backdrop-blur'>
      {children}
    </div>
  );
}

function splitLines(value: string, limit: number, maximumLines = 3): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];

  for (const word of words) {
    const current = lines.at(-1);
    if (!current || current.length + word.length + 1 > limit) {
      if (lines.length === maximumLines) break;
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }

  return lines;
}

function textureDefinition(texture: string, background: string): string {
  if (texture === 'grid') {
    return `<defs><pattern id="texture" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#9A9A93" stroke-opacity="0.22" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="${background}"/><rect width="100%" height="100%" fill="url(#texture)"/>`;
  }

  if (texture === 'noise') {
    return `<defs><filter id="noise"><feTurbulence baseFrequency="0.75" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.08"/></feComponentTransfer></filter></defs><rect width="100%" height="100%" fill="${background}"/><rect width="100%" height="100%" filter="url(#noise)" opacity="0.45"/>`;
  }

  return `<rect width="100%" height="100%" fill="${background}"/>`;
}

function monogramDataUrl(identity: BrandIdentity, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="none"/><text x="256" y="310" text-anchor="middle" fill="${color}" font-family="Inter, Arial, sans-serif" font-size="180" font-weight="700">${escapeXml(identity.shortName)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function resolveBrandMark(identity: BrandIdentity, inverted: boolean): Promise<string> {
  const path = brandAssetPath(identity, inverted ? 'mark-light' : 'mark-dark');
  return path ? imageUrlToDataUrl(path) : monogramDataUrl(identity, inverted ? '#FFFFFF' : '#18181B');
}

function OpenGraphTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const backgroundAsset = useLocalAsset();
  const customFont = useCustomFont();
  const logoAsset = useLocalAsset();
  const [title, setTitle] = useStudioDraft(identity.id, tool.id, 'title', identity.tagline);
  const [eyebrow, setEyebrow] = useStudioDraft(
    identity.id,
    tool.id,
    'eyebrow',
    `${identity.name.toLocaleUpperCase()} / PRODUCT`
  );
  const [surface, setSurface] = useStudioDraft<'light' | 'dark'>(
    identity.id,
    tool.id,
    'surface',
    'light'
  );
  const [backgroundOpacity, setBackgroundOpacity] = useStudioDraft(identity.id, tool.id, 'background-opacity', 28);
  const [backgroundX, setBackgroundX] = useStudioDraft(identity.id, tool.id, 'background-x', 0);
  const [backgroundY, setBackgroundY] = useStudioDraft(identity.id, tool.id, 'background-y', 0);
  const [backgroundScale, setBackgroundScale] = useStudioDraft(identity.id, tool.id, 'background-scale', 100);
  const [logoX, setLogoX] = useStudioDraft(identity.id, tool.id, 'logo-x', 0);
  const [logoY, setLogoY] = useStudioDraft(identity.id, tool.id, 'logo-y', 0);
  const [logoScale, setLogoScale] = useStudioDraft(identity.id, tool.id, 'logo-scale', 100);
  const [exporting, setExporting] = useState(false);
  const ink = identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#18181B';
  const paper = identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF';
  const foreground = surface === 'dark' ? paper : ink;
  const background = surface === 'dark' ? ink : paper;

  async function exportOpenGraph() {
    setExporting(true);
    try {
      const mark = logoAsset.asset
        ? await imageUrlToDataUrl(logoAsset.asset.url)
        : await resolveBrandMark(identity, surface === 'dark');
      const backgroundImage = backgroundAsset.asset
        ? await imageUrlToDataUrl(backgroundAsset.asset.url)
        : null;
      const fontData = customFont.font
        ? await imageUrlToDataUrl(customFont.font.url)
        : null;
      const fontDefinition = fontData
        ? `<style>@font-face{font-family:'StudioCustom';src:url('${fontData}')}</style>`
        : '';
      const fontFamily = fontData ? 'StudioCustom' : 'Arial, sans-serif';
      const lines = splitLines(title, 27, 3);
      const resolvedBackgroundWidth = 1200 * (backgroundScale / 100);
      const resolvedBackgroundHeight = 630 * (backgroundScale / 100);
      const resolvedBackgroundX = (1200 - resolvedBackgroundWidth) / 2 + (backgroundX / 100) * 1200;
      const resolvedBackgroundY = (630 - resolvedBackgroundHeight) / 2 + (backgroundY / 100) * 630;
      const imageLayer = backgroundImage
        ? `<rect width="1200" height="630" fill="${background}"/><image href="${backgroundImage}" x="${resolvedBackgroundX}" y="${resolvedBackgroundY}" width="${resolvedBackgroundWidth}" height="${resolvedBackgroundHeight}" preserveAspectRatio="xMidYMid slice" opacity="${backgroundOpacity / 100}"/>`
        : `<rect width="1200" height="630" fill="${background}"/>`;
      const titleLines = lines
        .map(
          (line, index) =>
            `<text x="72" y="${260 + index * 82}" fill="${foreground}" font-family="${fontFamily}" font-size="72" font-weight="700" letter-spacing="-2">${escapeXml(line)}</text>`
        )
        .join('');
      const resolvedLogoSize = 52 * (logoScale / 100);
      const resolvedLogoX = 72 - (resolvedLogoSize - 52) / 2 + logoX;
      const resolvedLogoY = 64 - (resolvedLogoSize - 52) / 2 + logoY;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs>${fontDefinition}</defs>${imageLayer}<image href="${mark}" x="${resolvedLogoX}" y="${resolvedLogoY}" width="${resolvedLogoSize}" height="${resolvedLogoSize}"/><text x="146" y="98" fill="${foreground}" font-family="${fontFamily}" font-size="20" font-weight="700">${escapeXml(identity.shortName)}</text><text x="72" y="188" fill="${foreground}" opacity="0.62" font-family="monospace" font-size="17" letter-spacing="2">${escapeXml(eyebrow)}</text>${titleLines}<text x="72" y="574" fill="${foreground}" opacity="0.62" font-family="monospace" font-size="16">${escapeXml(identity.website)}</text><path d="M1058 72h70v70" fill="none" stroke="${foreground}" stroke-width="2"/><path d="M1128 488v70h-70" fill="none" stroke="${foreground}" stroke-width="2"/></svg>`;
      await downloadSvgAsPng(svg, 1200, 630, 'studio-opengraph.png');
    } finally {
      setExporting(false);
    }
  }

  const inspector = (
    <>
      <ControlSection title={<T>Content</T>}>
        <Field label={<T>Eyebrow</T>}>
          <input className={INPUT_CLASS} onChange={(event) => setEyebrow(event.target.value)} value={eyebrow} />
        </Field>
        <Field label={<T>Headline</T>}>
          <textarea className={TEXTAREA_CLASS} onChange={(event) => setTitle(event.target.value)} value={title} />
        </Field>
      </ControlSection>
      <ControlSection title={<T>Surface</T>}>
        <SegmentedChoice
          onChange={setSurface}
          options={[
            { label: 'Base white', value: 'light' },
            { label: 'Base dark', value: 'dark' },
          ]}
          value={surface}
        />
        <UploadField
          accept='image/*'
          fileName={backgroundAsset.asset?.name}
          label='Add background image'
          onFile={backgroundAsset.select}
        />
        {backgroundAsset.asset ? (
          <div className='flex flex-col gap-4 border-t border-border pt-4'>
            <p className='text-xs font-semibold'><T>Background image</T></p>
            <RangeField label={<T>Opacity</T>} max={100} min={0} onChange={setBackgroundOpacity} suffix='%' value={backgroundOpacity} />
            <RangeField label={<T>Horizontal</T>} max={100} min={-100} onChange={setBackgroundX} suffix='%' value={backgroundX} />
            <RangeField label={<T>Vertical</T>} max={100} min={-100} onChange={setBackgroundY} suffix='%' value={backgroundY} />
            <RangeField label={<T>Scale</T>} max={240} min={50} onChange={setBackgroundScale} suffix='%' value={backgroundScale} />
          </div>
        ) : null}
        <UploadField
          accept='image/*'
          fileName={logoAsset.asset?.name}
          label='Replace logo'
          onFile={logoAsset.select}
        />
        <UploadField
          accept='.otf,.ttf,.woff,.woff2,font/*'
          fileName={customFont.font?.name}
          label='Add font file'
          onFile={customFont.select}
        />
      </ControlSection>
      <ControlSection title={<T>Logo placement</T>}>
        <RangeField label={<T>Horizontal</T>} max={240} min={-240} onChange={setLogoX} suffix='px' value={logoX} />
        <RangeField label={<T>Vertical</T>} max={180} min={-180} onChange={setLogoY} suffix='px' value={logoY} />
        <RangeField label={<T>Scale</T>} max={220} min={40} onChange={setLogoScale} suffix='%' value={logoScale} />
      </ControlSection>
    </>
  );

  return (
    <ToolShell
      actions={
        <Button loading={exporting} onClick={exportOpenGraph} type='button'>
          <Download aria-hidden='true' />
          <T>Download PNG</T>
        </Button>
      }
      inspector={inspector}
      tool={tool}
    >
      <CanvasViewport identityId={identity.id} stageClassName='grid min-h-full place-items-center p-6 lg:p-10' toolId={tool.id}>
        <div className='artifact-preview relative aspect-[1200/630] w-full max-w-5xl overflow-hidden rounded-md border border-border shadow-sm'>
          <div className='absolute inset-0' style={{ backgroundColor: background }} />
          {backgroundAsset.asset ? (
            <img alt='' className='absolute inset-0 size-full object-cover' src={backgroundAsset.asset.url} style={{ opacity: backgroundOpacity / 100, transform: `translate(${backgroundX}%, ${backgroundY}%) scale(${backgroundScale / 100})`, transformOrigin: 'center' }} />
          ) : null}
          <div
            className='absolute inset-0 flex flex-col justify-between p-[6%]'
            style={{ color: foreground, fontFamily: customFont.font?.family }}
          >
            <div className='flex items-center gap-3'>
              <img
                alt=''
                className='size-10 object-contain'
                src={
                  logoAsset.asset?.url ??
                  brandAssetPath(identity, surface === 'dark' ? 'mark-light' : 'mark-dark') ??
                  monogramDataUrl(identity, foreground)
                }
                style={{ transform: `translate(${logoX}px, ${logoY}px) scale(${logoScale / 100})` }}
              />
              <span className='text-sm font-semibold'>{identity.shortName}</span>
            </div>
            <div className='flex max-w-[86%] flex-col gap-5'>
              <p className='font-mono text-xs tracking-widest opacity-60'>{eyebrow}</p>
              <p className='break-words text-2xl font-semibold leading-[1.04] tracking-[-0.045em] text-balance sm:text-5xl lg:text-6xl'>
                {title}
              </p>
            </div>
            <p className='font-mono text-xs opacity-60'>{identity.website}</p>
          </div>
          <PreviewLabel>1200 × 630</PreviewLabel>
        </div>
      </CanvasViewport>
    </ToolShell>
  );
}

type LogoSurface = 'white' | 'dark' | 'grid' | 'noise';

function LogoTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const markPath = brandAssetPath(identity, 'mark-dark');
  const logoColors = [
    identity.colors.find(({ id }) => id === 'ink'),
    identity.colors.find(({ id }) => id === 'paper'),
    identity.colors.find(({ id }) => id === 'emphasis'),
    identity.colors.find(({ id }) => id === 'success'),
  ].filter((color) => color !== undefined);
  const [tone, setTone] = useStudioDraft(identity.id, tool.id, 'tone', logoColors[0]?.id ?? 'ink');
  const [surface, setSurface] = useStudioDraft<LogoSurface>(identity.id, tool.id, 'surface', 'white');
  const [size, setSize] = useStudioDraft<64 | 128>(identity.id, tool.id, 'size', 128);
  const [transparent, setTransparent] = useStudioDraft(identity.id, tool.id, 'transparent', false);
  const [exporting, setExporting] = useState(false);
  const selectedColor = logoColors.find(({ id }) => id === tone) ?? logoColors[0] ?? {
    hex: '#18181B',
    id: 'ink',
    name: 'Ink',
  };
  const surfaceColor = surface === 'dark'
    ? identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#18181B'
    : identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF';

  async function exportLogo() {
    setExporting(true);
    try {
      const mark = await resolveBrandMark(identity, false);
      const backgroundLayer = transparent
        ? ''
        : textureDefinition(surface, surfaceColor);
      const inset = Math.round(size * 0.14);
      const markSize = size - inset * 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${backgroundLayer}<defs><filter id="tint"><feFlood flood-color="${selectedColor.hex}"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs><image href="${mark}" x="${inset}" y="${inset}" width="${markSize}" height="${markSize}" filter="url(#tint)"/></svg>`;
      await downloadSvgAsPng(svg, size, size, `${identity.id}-mark-${tone}-${size}.png`);
    } finally {
      setExporting(false);
    }
  }

  const inspector = (
    <>
      <ControlSection title={<T>Logo color</T>}>
        <div className='grid grid-cols-2 gap-2'>
          {logoColors.map((color) => (
            <Button
              className='justify-start'
              key={color.id}
              onClick={() => setTone(color.id)}
              type='button'
              variant={tone === color.id ? 'default' : 'outline'}
            >
              <span className='size-3 rounded-full border border-border' style={{ backgroundColor: color.hex }} />
              {color.name}
            </Button>
          ))}
        </div>
      </ControlSection>
      <ControlSection title={<T>Background</T>}>
        <SegmentedChoice
          onChange={setSurface}
          options={[
            { label: 'Base white', value: 'white' },
            { label: 'Base dark', value: 'dark' },
            { label: 'Grid', value: 'grid' },
            { label: 'Noise', value: 'noise' },
          ]}
          value={surface}
        />
        <label className='flex items-center justify-between gap-4 text-sm'>
          <T>Transparent export</T>
          <input checked={transparent} onChange={(event) => setTransparent(event.target.checked)} type='checkbox' />
        </label>
      </ControlSection>
      <ControlSection title={<T>Output size</T>}>
        <SegmentedChoice
          onChange={setSize}
          options={[
            { label: '64 px', value: 64 },
            { label: '128 px', value: 128 },
          ]}
          value={size}
        />
      </ControlSection>
    </>
  );

  return (
    <ToolShell
      actions={
        <Button loading={exporting} onClick={exportLogo} type='button'>
          <Download aria-hidden='true' />
          <T>Download logo</T>
        </Button>
      }
      inspector={inspector}
      tool={tool}
    >
      <div className='grid min-h-full place-items-center p-8'>
        <div className={`logo-surface logo-surface-${surface} grid aspect-square w-full max-w-xl place-items-center overflow-hidden rounded-md border border-border`}>
          <div
            aria-label={`${identity.name} logo preview`}
            className='gt-logo-mask'
            style={{
              backgroundColor: markPath ? selectedColor.hex : 'transparent',
              color: selectedColor.hex,
              height: `${Math.min(256, size * 2)}px`,
              maskImage: markPath ? `url('${markPath}')` : undefined,
              width: `${Math.min(256, size * 2)}px`,
            }}
          >
            {markPath ? null : (
              <span className='grid size-full place-items-center text-5xl font-semibold'>{identity.shortName}</span>
            )}
          </div>
        </div>
      </div>
    </ToolShell>
  );
}

type EditableColor = {
  hex: string;
  name: string;
  role: string;
};

function ColorTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const [colors, setColors] = useStudioDraft<EditableColor[]>(
    identity.id,
    tool.id,
    'colors',
    () => identity.colors.map(({ hex, name, role }) => ({ hex, name, role }))
  );
  const [copied, setCopied] = useState(false);

  async function copyTokens() {
    const value = colors
      .map(
        (color) =>
          `--color-${color.name.toLocaleLowerCase().replaceAll(' ', '-')}: ${normalizeHex(color.hex)}; /* ${formatOklch(color.hex)} */`
      )
      .join('\n');
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const inspector = (
    <ControlSection title={<T>Semantic palette</T>}>
      <p className='text-sm leading-5 text-muted-foreground'>
        <T>Edit any swatch. HEX and perceptual OKLCH values stay paired.</T>
      </p>
      <div className='flex flex-col gap-3'>
        {colors.map((color, index) => (
          <label className='grid grid-cols-[36px_1fr] items-center gap-3' key={color.name}>
            <input
              aria-label={gt('Change {name}', { name: color.name })}
              className='size-9 rounded-md border border-input bg-background p-1'
              onChange={(event) =>
                setColors((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, hex: event.target.value } : item
                  )
                )
              }
              type='color'
              value={color.hex}
            />
            <span className='min-w-0'>
              <span className='block text-sm font-medium'>{gt(color.name)}</span>
              <span className='block font-mono text-xs text-muted-foreground'>
                {normalizeHex(color.hex)}
              </span>
            </span>
          </label>
        ))}
      </div>
    </ControlSection>
  );

  return (
    <ToolShell
      actions={
        <Button onClick={copyTokens} type='button' variant='outline'>
          {copied ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
          {copied ? <T>Copied</T> : <T>Copy tokens</T>}
        </Button>
      }
      inspector={inspector}
      tool={tool}
    >
      <div className='grid min-h-full content-center gap-px bg-border lg:grid-cols-2'>
        {colors.map((color) => {
          const oklch = formatOklch(color.hex);
          const lightness = Number(oklch.match(/\d+(\.\d+)?/)?.[0] ?? 0);
          const isDark = lightness < 55;
          return (
            <article
              className='flex min-h-56 flex-col justify-between gap-8 p-6'
              key={color.name}
              style={{ backgroundColor: color.hex, color: isDark ? '#FFFFFF' : '#111111' }}
            >
              <div className='flex items-start justify-between gap-4'>
                <h2 className='text-xl font-semibold'>{gt(color.name)}</h2>
                <span className='rounded-md border border-current/20 px-2 py-1 font-mono text-xs'>
                  {normalizeHex(color.hex)}
                </span>
              </div>
              <div className='flex flex-col gap-2'>
                <p className='font-mono text-sm'>{oklch}</p>
                <p className='text-sm opacity-70'>{gt(color.role)}</p>
              </div>
            </article>
          );
        })}
      </div>
    </ToolShell>
  );
}

const FONT_OPTIONS = [
  { family: 'var(--font-sans)', id: 'geist', name: 'Geist' },
  { family: 'Inter, Arial, sans-serif', id: 'inter', name: 'Inter' },
  { family: 'Georgia, serif', id: 'editorial', name: 'Editorial serif' },
  { family: 'var(--font-mono)', id: 'mono', name: 'Geist Mono' },
] as const;

type FontOptionId = (typeof FONT_OPTIONS)[number]['id'] | 'custom';
type FontRole = 'primary' | 'secondary' | 'accent' | 'code';

function TypographyTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const customFont = useCustomFont();
  const [roles, setRoles] = useStudioDraft<Record<FontRole, FontOptionId>>(
    identity.id,
    tool.id,
    'font-roles',
    {
      accent: 'inter',
      code: 'mono',
      primary: 'inter',
      secondary: 'inter',
    }
  );
  const availableFonts = customFont.font
    ? [...FONT_OPTIONS, { family: customFont.font.family, id: 'custom' as const, name: customFont.font.name }]
    : [...FONT_OPTIONS];

  function familyFor(role: FontRole): string {
    const selected = availableFonts.find(({ id }) => id === roles[role]);
    return selected?.family ?? FONT_OPTIONS[0].family;
  }

  function changeRole(role: FontRole, value: FontOptionId) {
    setRoles((current) => ({ ...current, [role]: value }));
  }

  async function loadFont(file: File) {
    await customFont.select(file);
    setRoles((current) => ({ ...current, accent: 'custom', primary: 'custom' }));
  }

  const inspector = (
    <>
      <ControlSection title={<T>Font selector</T>}>
        <div className='flex flex-col gap-3'>
          {(['primary', 'secondary', 'accent', 'code'] as const).map((role) => (
            <Field key={role} label={role.toLocaleUpperCase()}>
              <select
                className={INPUT_CLASS}
                onChange={(event) => changeRole(role, event.target.value as FontOptionId)}
                style={{ fontFamily: familyFor(role) }}
                value={roles[role]}
              >
                {availableFonts.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.name}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        <UploadField
          accept='.otf,.ttf,.woff,.woff2,font/*'
          fileName={customFont.font?.name}
          label='Add font file'
          onFile={loadFont}
        />
      </ControlSection>
      <ControlSection title={<T>Roles</T>}>
        <div className='grid gap-2 font-mono text-xs text-muted-foreground'>
          {(['primary', 'secondary', 'accent', 'code'] as const).map((role) => (
            <span key={role}>
              {role.toLocaleUpperCase()} /{' '}
              {availableFonts.find(({ id }) => id === roles[role])?.name}
            </span>
          ))}
        </div>
      </ControlSection>
    </>
  );

  return (
    <ToolShell inspector={inspector} tool={tool}>
      <div className='flex min-h-full flex-col justify-center gap-10 p-8 sm:p-12 lg:p-16'>
        <section className='flex flex-col gap-3 border-b border-border pb-10'>
          <p className='text-sm uppercase tracking-widest text-muted-foreground'>PRIMARY / DISPLAY</p>
          <p
            className='max-w-5xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-balance lg:text-7xl'
            style={{ fontFamily: familyFor('primary') }}
          >
            {identity.tagline}
          </p>
          <p
            className='text-2xl text-muted-foreground'
            style={{ fontFamily: familyFor('accent') }}
          >
            {identity.greetings.join(' · ')}
          </p>
        </section>
        <div className='grid gap-8 md:grid-cols-2'>
          <section className='flex flex-col gap-3' style={{ fontFamily: familyFor('secondary') }}>
            <p className='text-sm font-semibold'>SECONDARY / BODY</p>
            <p className='max-w-xl text-lg leading-8 text-muted-foreground'>
              {identity.positioning}
            </p>
          </section>
          <section className='flex flex-col gap-3' style={{ fontFamily: familyFor('code') }}>
            <p className='text-sm font-semibold'>CODE / MONO</p>
            <p className='rounded-md bg-foreground p-5 text-sm leading-6 text-background'>
              $ npx {identity.id} translate --locales es,ja,ar
            </p>
          </section>
        </div>
      </div>
    </ToolShell>
  );
}

const CODE_SAMPLES = {
  bash: `$ gt translate --locales es,ja,ar\n✓ 42 strings translated\n✓ 3 locale files written`,
  python: `from gt import translate\n\nresult = translate(\n    "Hello, world",\n    locales=["es", "ja", "ar"],\n)`,
  typescript: `import { tx } from 'gt-next';\n\nexport function Greeting() {\n  return <h1>{tx('Hello, world')}</h1>;\n}`,
} as const;

function TerminalTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const [language, setLanguage] = useStudioDraft<CodeLanguage>(identity.id, tool.id, 'language', 'typescript');
  const [code, setCode] = useStudioDraft<string>(
    identity.id,
    tool.id,
    'code',
    CODE_SAMPLES.typescript
  );
  const [title, setTitle] = useStudioDraft(
    identity.id,
    tool.id,
    'title',
    identity.voice.phrases[0] ?? identity.tagline
  );
  const [exporting, setExporting] = useState(false);
  const highlightedLines = useMemo(() => highlightCode(code, language), [code, language]);

  function changeLanguage(nextLanguage: CodeLanguage) {
    setLanguage(nextLanguage);
    setCode(CODE_SAMPLES[nextLanguage]);
  }

  async function exportTerminal() {
    setExporting(true);
    try {
      const codeSvg = highlightedLines
        .slice(0, 12)
        .map(
          (line, index) => {
            const tokens = line.tokens.length > 0
              ? line.tokens
                  .map(
                    ({ color, content }) =>
                      `<tspan fill="${color}">${escapeXml(content)}</tspan>`
                  )
                  .join('')
              : '<tspan> </tspan>';
            return `<text x="92" y="${236 + index * 34}" fill="${CODE_THEME.foreground}" font-family="Geist Mono, monospace" font-size="21" xml:space="preserve">${tokens}</text>`;
          }
        )
        .join('');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="${CODE_THEME.background}"/><text x="72" y="90" fill="${CODE_THEME.foreground}" font-family="Inter, sans-serif" font-size="42" font-weight="700">${escapeXml(title)}</text><text x="72" y="136" fill="${CODE_THEME.gutter}" font-family="Geist Mono, monospace" font-size="17">${language.toLocaleUpperCase()}</text><rect x="72" y="174" width="1056" height="388" rx="8" fill="${CODE_THEME.background}" stroke="${CODE_THEME.border}"/>${codeSvg}</svg>`;
      await downloadSvgAsPng(svg, 1200, 630, 'studio-terminal.png');
    } finally {
      setExporting(false);
    }
  }

  const inspector = (
    <>
      <ControlSection title={<T>Content</T>}>
        <Field label={<T>Card title</T>}>
          <input className={INPUT_CLASS} onChange={(event) => setTitle(event.target.value)} value={title} />
        </Field>
        <Field label={<T>Language</T>}>
          <select className={INPUT_CLASS} onChange={(event) => changeLanguage(event.target.value as CodeLanguage)} value={language}>
            <option value='typescript'>TypeScript</option>
            <option value='python'>Python</option>
            <option value='bash'>Bash</option>
          </select>
        </Field>
      </ControlSection>
      <ControlSection title={<T>Source</T>}>
        <textarea className={`${TEXTAREA_CLASS} min-h-56 font-mono`} onChange={(event) => setCode(event.target.value)} spellCheck={false} value={code} />
      </ControlSection>
    </>
  );

  return (
    <ToolShell
      actions={
        <Button loading={exporting} onClick={exportTerminal} type='button'>
          <Download aria-hidden='true' />
          <T>Download PNG</T>
        </Button>
      }
      inspector={inspector}
      tool={tool}
    >
      <div className='grid min-h-full place-items-center p-8 lg:p-14'>
        <div className='w-full max-w-4xl overflow-hidden rounded-lg border border-white/10 bg-[#0D1117] text-[#E6EDF3] shadow-[0_18px_60px_rgba(0,0,0,0.18)]'>
          <div className='flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4'>
            <div className='flex flex-col gap-1'>
              <h2 className='text-lg font-semibold'>{title}</h2>
              <p className='font-mono text-[10px] uppercase tracking-widest text-[#8B949E]'>
                {language}
              </p>
            </div>
            <div className='flex gap-1.5' aria-hidden='true'>
              <span className='size-1.5 rounded-full bg-white/20' />
              <span className='size-1.5 rounded-full bg-white/20' />
              <span className='size-1.5 rounded-full bg-white/20' />
            </div>
          </div>
          <pre className='min-h-72 overflow-auto bg-[#0D1117] p-6 font-mono text-sm leading-7'>
            {highlightedLines.map((line, index) => (
              <span className='grid grid-cols-[28px_1fr] gap-4' key={`${index}-${line.tokens.map(({ content }) => content).join('')}`}>
                <span className='select-none text-right text-[#6E7681]'>{index + 1}</span>
                <span>
                  {line.tokens.length > 0
                    ? line.tokens.map(({ color, content }, tokenIndex) => (
                        <span key={`${tokenIndex}-${content}`} style={{ color }}>{content}</span>
                      ))
                    : ' '}
                </span>
              </span>
            ))}
          </pre>
        </div>
      </div>
    </ToolShell>
  );
}

const SLIDE_LAYOUTS: readonly { id: SlideLayout; label: string; symbol: string }[] = [
  { id: 'title', label: 'Title', symbol: 'Aa' },
  { id: 'section', label: 'Section', symbol: '01' },
  { id: 'agenda', label: 'Agenda', symbol: '≡' },
  { id: 'split', label: 'Split', symbol: '▥' },
  { id: 'metrics', label: 'Metrics', symbol: '%' },
  { id: 'quote', label: 'Quote', symbol: '“' },
  { id: 'timeline', label: 'Timeline', symbol: '→' },
  { id: 'closing', label: 'Closing', symbol: '✦' },
];

function SlideTemplatePreview({
  body,
  eyebrow,
  foreground,
  layout,
  title,
}: {
  body: string;
  eyebrow: string;
  foreground: string;
  layout: SlideLayout;
  title: string;
}) {
  const items = body.split('\n').map((item) => item.trim()).filter(Boolean);
  const resolvedItems = items.length > 0 ? items : ['Foundation', 'Expression', 'Application', 'Delivery'];
  if (layout === 'section') return <div className='relative flex flex-1 items-center'><span className='absolute -left-[1cqw] text-[30cqw] font-bold leading-none opacity-[0.08]'>01</span><h2 className='relative ml-[23cqw] max-w-[62cqw] text-[7cqw] font-semibold leading-[0.98] tracking-[-0.055em]'>{title}</h2></div>;
  if (layout === 'agenda') return <div className='grid flex-1 grid-cols-[1fr_0.8fr] items-center gap-[7cqw]'><div><p className='template-eyebrow font-mono opacity-55'>{eyebrow}</p><h2 className='mt-[2cqw] text-[5.2cqw] font-semibold leading-[1.02] tracking-[-0.05em]'>{title}</h2></div><div className='flex flex-col'>{resolvedItems.slice(0, 4).map((item, index) => <div className='grid grid-cols-[4cqw_1fr] border-b py-[1.6cqw] text-[1.6cqw]' key={item} style={{ borderColor: `color-mix(in srgb, ${foreground} 18%, transparent)` }}><span className='font-mono opacity-35'>0{index + 1}</span><span>{item}</span></div>)}</div></div>;
  if (layout === 'split') return <div className='grid flex-1 grid-cols-2 items-center gap-[7cqw]'><div><p className='template-eyebrow font-mono opacity-55'>{eyebrow}</p><h2 className='mt-[2cqw] text-[5cqw] font-semibold leading-[1] tracking-[-0.05em]'>{title}</h2></div><div className='border-l pl-[5cqw]' style={{ borderColor: `color-mix(in srgb, ${foreground} 18%, transparent)` }}>{resolvedItems.slice(0, 5).map((item, index) => <p className='mb-[2cqw] flex gap-[2cqw] text-[1.6cqw]' key={item}><span className='font-mono opacity-35'>0{index + 1}</span>{item}</p>)}</div></div>;
  if (layout === 'metrics') return <div className='flex flex-1 flex-col justify-center'><p className='template-eyebrow font-mono opacity-55'>{eyebrow}</p><h2 className='mt-[1.5cqw] text-[4.2cqw] font-semibold tracking-[-0.045em]'>{title}</h2><div className='mt-[5cqw] grid grid-cols-3 gap-[1cqw]'>{[['98.7%', 'Coverage'], ['42', 'Markets'], ['7d', 'Launch']].map(([value, label]) => <div className='border p-[3cqw]' key={label} style={{ borderColor: `color-mix(in srgb, ${foreground} 20%, transparent)` }}><p className='text-[5cqw] font-semibold tracking-[-0.05em]'>{value}</p><p className='mt-[1cqw] font-mono text-[1.1cqw] opacity-50'>{label}</p></div>)}</div></div>;
  if (layout === 'quote') return <div className='relative flex flex-1 items-center pl-[9cqw]'><span className='absolute left-0 top-[9cqw] font-serif text-[16cqw] leading-none opacity-10'>“</span><div><h2 className='max-w-[75cqw] text-[5cqw] font-semibold leading-[1.08] tracking-[-0.045em]'>{title}</h2><p className='mt-[4cqw] font-mono text-[1.2cqw] opacity-55'>{resolvedItems[0] ?? 'Alex Morgan · Customer'}</p></div></div>;
  if (layout === 'timeline') return <div className='flex flex-1 flex-col justify-center'><p className='template-eyebrow font-mono opacity-55'>{eyebrow}</p><h2 className='mt-[1.5cqw] text-[4.5cqw] font-semibold tracking-[-0.045em]'>{title}</h2><div className='relative mt-[7cqw] grid grid-cols-4'><span className='absolute left-0 right-0 top-[0.5cqw] h-px opacity-20' style={{ backgroundColor: foreground }} />{resolvedItems.slice(0, 4).map((item, index) => <div className='relative pt-[3cqw]' key={item}><span className='absolute top-0 size-[1cqw] rounded-full' style={{ backgroundColor: foreground }} /><p className='font-mono text-[1cqw] opacity-35'>0{index + 1}</p><p className='mt-[0.8cqw] text-[1.5cqw]'>{item}</p></div>)}</div></div>;
  if (layout === 'closing') return <div className='flex flex-1 flex-col items-center justify-center text-center'><p className='template-eyebrow font-mono opacity-55'>{eyebrow}</p><h2 className='mt-[2cqw] max-w-[75cqw] text-[7cqw] font-semibold leading-[0.98] tracking-[-0.055em]'>{title}</h2><p className='mt-[3cqw] max-w-[60cqw] text-[1.5cqw] opacity-55'>{body}</p></div>;
  return <div className='template-copy flex flex-1 flex-col justify-center'><p className='template-eyebrow font-mono tracking-widest opacity-60'>{eyebrow}</p><h2 className='template-title mt-[2cqw] break-words font-semibold leading-[0.98] tracking-[-0.055em] text-balance'>{title}</h2></div>;
}

function TemplateTool({ identity, kind, tool }: { identity: BrandIdentity; kind: TemplateKind; tool: StudioTool }) {
  const gt = useGT();
  const partnerAsset = useLocalAsset();
  const backgroundAsset = useLocalAsset();
  const partnerOptions = useMemo(() => templatePartnerOptions(identity), [identity]);
  const initialPartner = defaultTemplatePartner(identity);
  const [partnerId, setPartnerId] = useStudioDraft(
    identity.id,
    tool.id,
    'partner',
    initialPartner.id
  );
  const selectedPartner = partnerOptions.find(({ id }) => id === partnerId) ?? initialPartner;
  const [title, setTitle] = useStudioDraft(
    identity.id,
    tool.id,
    'title',
    kind === 'partnership'
      ? `${identity.name} × ${initialPartner.label}`
      : kind === 'blog'
        ? identity.voice.phrases[0] ?? identity.tagline
        : identity.tagline
  );
  const [eyebrow, setEyebrow] = useStudioDraft(
    identity.id,
    tool.id,
    'eyebrow',
    kind === 'blog' ? 'ENGINEERING / JULY 2026' : `${identity.name.toLocaleUpperCase()} / STUDIO`
  );
  const [body, setBody] = useStudioDraft(
    identity.id,
    tool.id,
    'body',
    kind === 'slides'
      ? 'Foundation\nExpression\nApplication\nDelivery'
      : identity.description
  );
  const [slideLayout, setSlideLayout] = useStudioDraft<SlideLayout>(
    identity.id,
    tool.id,
    'slide-layout',
    'title'
  );
  const [texture, setTexture] = useStudioDraft<TemplateTexture>(
    identity.id,
    tool.id,
    'texture',
    'white'
  );
  const [textureOpacity, setTextureOpacity] = useStudioDraft(identity.id, tool.id, 'texture-opacity', 100);
  const [backgroundOpacity, setBackgroundOpacity] = useStudioDraft(identity.id, tool.id, 'background-opacity', 28);
  const [backgroundX, setBackgroundX] = useStudioDraft(identity.id, tool.id, 'background-x', 0);
  const [backgroundY, setBackgroundY] = useStudioDraft(identity.id, tool.id, 'background-y', 0);
  const [backgroundScale, setBackgroundScale] = useStudioDraft(identity.id, tool.id, 'background-scale', 100);
  const [brandLogoX, setBrandLogoX] = useStudioDraft(identity.id, tool.id, 'brand-logo-x', 0);
  const [brandLogoY, setBrandLogoY] = useStudioDraft(identity.id, tool.id, 'brand-logo-y', 0);
  const [brandLogoScale, setBrandLogoScale] = useStudioDraft(identity.id, tool.id, 'brand-logo-scale', 100);
  const [partnerLogoX, setPartnerLogoX] = useStudioDraft(identity.id, tool.id, 'partner-logo-x', 0);
  const [partnerLogoY, setPartnerLogoY] = useStudioDraft(identity.id, tool.id, 'partner-logo-y', 0);
  const [partnerLogoScale, setPartnerLogoScale] = useStudioDraft(identity.id, tool.id, 'partner-logo-scale', 100);
  const [exporting, setExporting] = useState(false);
  const isDark = texture === 'dark';
  const foreground = isDark
    ? identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF'
    : identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#18181B';
  const background = isDark
    ? identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#18181B'
    : identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF';
  const isSlide = kind === 'slides';
  const width = isSlide ? 1600 : 1200;
  const height = isSlide ? 900 : kind === 'blog' ? 630 : 600;
  const brandLogo = templateBrandLogo(identity, kind, isDark);
  const displayFont = identity.typography.find(({ role }) => role === 'Display')?.family ?? 'Inter';
  const brandLogoSource = brandLogo?.path ?? monogramDataUrl(identity, foreground);
  const partnerLogoSource = partnerAsset.asset?.url ?? selectedPartner.path;

  async function exportTemplate() {
    setExporting(true);
    try {
      const resolvedBrandLogo = brandLogo
        ? await imageUrlToDataUrl(brandLogo.path)
        : monogramDataUrl(identity, foreground);
      const partner = kind === 'partnership'
        ? await imageUrlToDataUrl(partnerLogoSource)
        : null;
      const backgroundImage = backgroundAsset.asset
        ? await imageUrlToDataUrl(backgroundAsset.asset.url)
        : null;
      const svg = buildTemplateSvg({
        background,
        backgroundImage,
        backgroundImageOpacity: backgroundOpacity,
        backgroundImageScale: backgroundScale,
        backgroundImageX: backgroundX,
        backgroundImageY: backgroundY,
        body,
        brandLogo: resolvedBrandLogo,
        brandLogoScale,
        brandLogoX,
        brandLogoY,
        eyebrow,
        foreground,
        height,
        identityName: identity.name,
        invertPartner: isDark,
        kind,
        partnerLogo: partner,
        partnerLogoScale,
        partnerLogoX,
        partnerLogoY,
        slideLayout,
        texture,
        textureOpacity,
        title,
        website: identity.website,
        width,
      });
      await downloadSvgAsPng(svg, width, height, `studio-${kind}.png`);
    } finally {
      setExporting(false);
    }
  }

  const inspector = (
    <>
      <ControlSection title={<T>Content</T>}>
        <Field label={<T>Label</T>}>
          <input className={INPUT_CLASS} onChange={(event) => setEyebrow(event.target.value)} value={eyebrow} />
        </Field>
        <Field label={<T>Title</T>}>
          <textarea className={TEXTAREA_CLASS} onChange={(event) => setTitle(event.target.value)} value={title} />
        </Field>
        {kind === 'slides' ? <Field label={<T>Body or list · one item per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => setBody(event.target.value)} value={body} /></Field> : null}
      </ControlSection>
      {kind === 'slides' ? <ControlSection title={<T>Slide library</T>}>
        <div className='grid grid-cols-2 gap-2'>
          {SLIDE_LAYOUTS.map((layout) => <Button className='h-16 flex-col items-start gap-1 px-3' key={layout.id} onClick={() => setSlideLayout(layout.id)} type='button' variant={slideLayout === layout.id ? 'default' : 'outline'}><span className='font-mono text-lg'>{layout.symbol}</span><span className='text-xs'>{layout.label}</span></Button>)}
        </div>
      </ControlSection> : null}
      <ControlSection title={<T>Surface</T>}>
        <SegmentedChoice
          onChange={setTexture}
          options={[
            { label: 'Base white', value: 'white' },
            { label: 'Base dark', value: 'dark' },
            { label: 'Grid', value: 'grid' },
            { label: 'Noise', value: 'noise' },
          ]}
          value={texture}
        />
        <UploadField
          accept='image/*'
          fileName={backgroundAsset.asset?.name}
          label='Add background image'
          onFile={backgroundAsset.select}
        />
        {texture === 'grid' || texture === 'noise' ? <RangeField label={<T>Texture opacity</T>} max={100} min={0} onChange={setTextureOpacity} suffix='%' value={textureOpacity} /> : null}
        {backgroundAsset.asset ? (
          <div className='flex flex-col gap-4 border-t border-border pt-4'>
            <p className='text-xs font-semibold'><T>Background image</T></p>
            <RangeField label={<T>Opacity</T>} max={100} min={0} onChange={setBackgroundOpacity} suffix='%' value={backgroundOpacity} />
            <RangeField label={<T>Horizontal</T>} max={100} min={-100} onChange={setBackgroundX} suffix='%' value={backgroundX} />
            <RangeField label={<T>Vertical</T>} max={100} min={-100} onChange={setBackgroundY} suffix='%' value={backgroundY} />
            <RangeField label={<T>Scale</T>} max={240} min={50} onChange={setBackgroundScale} suffix='%' value={backgroundScale} />
          </div>
        ) : null}
        {kind === 'partnership' ? (
          <>
            <Field label={<T>Partner logo</T>}>
              <select
                className={INPUT_CLASS}
                onChange={(event) => {
                  partnerAsset.clear();
                  setPartnerId(event.target.value);
                }}
                value={partnerId}
              >
                {partnerOptions.map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.label}</option>
                ))}
              </select>
            </Field>
            <UploadField
              accept='image/*,.svg'
              fileName={partnerAsset.asset?.name}
              label='Replace partner logo'
              onFile={partnerAsset.select}
            />
          </>
        ) : null}
      </ControlSection>
      <ControlSection title={<T>Brand artwork</T>}>
        <RangeField label={<T>Horizontal</T>} max={240} min={-240} onChange={setBrandLogoX} suffix='px' value={brandLogoX} />
        <RangeField label={<T>Vertical</T>} max={180} min={-180} onChange={setBrandLogoY} suffix='px' value={brandLogoY} />
        <RangeField label={<T>Scale</T>} max={220} min={40} onChange={setBrandLogoScale} suffix='%' value={brandLogoScale} />
        {kind === 'partnership' ? (
          <div className='flex flex-col gap-4 border-t border-border pt-4'>
            <p className='text-xs font-semibold'><T>Partner artwork</T></p>
            <RangeField label={<T>Horizontal</T>} max={240} min={-240} onChange={setPartnerLogoX} suffix='px' value={partnerLogoX} />
            <RangeField label={<T>Vertical</T>} max={180} min={-180} onChange={setPartnerLogoY} suffix='px' value={partnerLogoY} />
            <RangeField label={<T>Scale</T>} max={220} min={40} onChange={setPartnerLogoScale} suffix='%' value={partnerLogoScale} />
          </div>
        ) : null}
      </ControlSection>
    </>
  );

  return (
    <ToolShell
      actions={
        <Button loading={exporting} onClick={exportTemplate} type='button'>
          <Download aria-hidden='true' />
          <T>Download PNG</T>
        </Button>
      }
      inspector={inspector}
      tool={tool}
    >
      <CanvasViewport identityId={identity.id} stageClassName='template-workspace grid min-h-full place-items-center p-5 md:p-8 xl:p-12' toolId={tool.id}>
        <div
          className={`artifact-preview template-artboard template-artboard-${kind} relative w-full max-w-5xl overflow-hidden border border-border`}
          style={{ aspectRatio: `${width} / ${height}`, backgroundColor: background, color: foreground, fontFamily: displayFont }}
        >
          {backgroundAsset.asset ? (
            <img alt='' className='absolute inset-0 size-full object-cover' src={backgroundAsset.asset.url} style={{ opacity: backgroundOpacity / 100, transform: `translate(${backgroundX}%, ${backgroundY}%) scale(${backgroundScale / 100})`, transformOrigin: 'center' }} />
          ) : null}
          {texture === 'grid' || texture === 'noise' ? <div className={`template-texture-layer template-surface-${texture} absolute inset-0`} style={{ opacity: textureOpacity / 100 }} /> : null}
          <div className='template-artboard-content absolute inset-0 flex flex-col justify-between'>
            {kind === 'partnership' ? (
              <div className='template-partnership-lockup' aria-label={gt(`${identity.name} and ${selectedPartner.label}`)}>
                <img alt={identity.name} className='template-partnership-brand object-contain' src={brandLogoSource} style={{ transform: `translate(${brandLogoX}px, ${brandLogoY}px) scale(${brandLogoScale / 100})` }} />
                <span className='template-partnership-times' aria-hidden='true'>×</span>
                <img
                  alt={partnerAsset.asset?.name ?? selectedPartner.label}
                  className='template-partner-logo object-contain'
                  src={partnerLogoSource}
                  style={{ filter: isDark ? 'brightness(0) invert(1)' : undefined, transform: `translate(${partnerLogoX}px, ${partnerLogoY}px) scale(${partnerLogoScale / 100})` }}
                />
              </div>
            ) : (
              <div className='template-brand-lockup'>
                <img alt={identity.name} className='template-brand-logo object-contain' src={brandLogoSource} style={{ transform: `translate(${brandLogoX}px, ${brandLogoY}px) scale(${brandLogoScale / 100})` }} />
                {kind === 'blog' ? <span>{identity.name}</span> : null}
              </div>
            )}
            {isSlide ? <SlideTemplatePreview body={body} eyebrow={eyebrow} foreground={foreground} layout={slideLayout} title={title} /> : <div className='template-copy flex flex-col'><p className='template-eyebrow font-mono tracking-widest opacity-60'>{eyebrow}</p><h2 className='template-title break-words font-semibold leading-[0.98] tracking-[-0.055em] text-balance'>{title}</h2></div>}
            <div className='template-footer flex items-center justify-between gap-4 font-mono opacity-60'>
              <span>{identity.website}</span>
              {isSlide ? <span>01 / 12</span> : null}
            </div>
          </div>
        </div>
      </CanvasViewport>
    </ToolShell>
  );
}

type ComponentFamily = 'actions' | 'forms' | 'navigation' | 'feedback' | 'data' | 'cards';

function ComponentLibraryTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const [family, setFamily] = useStudioDraft<ComponentFamily>(identity.id, tool.id, 'family', 'actions');
  const [label, setLabel] = useStudioDraft(identity.id, tool.id, 'label', 'Get started');
  const [disabled, setDisabled] = useStudioDraft(identity.id, tool.id, 'disabled', false);
  const [size, setSize] = useStudioDraft<'sm' | 'default' | 'lg'>(
    identity.id,
    tool.id,
    'size',
    'default'
  );

  const inspector = (
    <>
      <ControlSection title={<T>Button</T>}>
        <Field label={<T>Component family</T>}>
          <select className={INPUT_CLASS} onChange={(event) => setFamily(event.target.value as ComponentFamily)} value={family}>
            <option value='actions'>Actions</option>
            <option value='forms'>Forms</option>
            <option value='navigation'>Navigation</option>
            <option value='feedback'>Feedback</option>
            <option value='data'>Data display</option>
            <option value='cards'>Cards</option>
          </select>
        </Field>
        <Field label={<T>Label</T>}>
          <input className={INPUT_CLASS} onChange={(event) => setLabel(event.target.value)} value={label} />
        </Field>
        <Field label={<T>Size</T>}>
          <select className={INPUT_CLASS} onChange={(event) => setSize(event.target.value as typeof size)} value={size}>
            <option value='sm'>Small</option>
            <option value='default'>Default</option>
            <option value='lg'>Large</option>
          </select>
        </Field>
        <label className='flex items-center justify-between gap-4 text-sm'>
          <T>Disabled state</T>
          <input checked={disabled} onChange={(event) => setDisabled(event.target.checked)} type='checkbox' />
        </label>
      </ControlSection>
      <ControlSection title={<T>Included</T>}>
        <div className='grid grid-cols-2 gap-2 text-xs text-muted-foreground'>
          {['Buttons', 'Inputs', 'Selects', 'Toggles', 'Navigation', 'Tabs', 'Breadcrumbs', 'Alerts', 'Toasts', 'Progress', 'Tables', 'Stats', 'Pricing', 'Testimonials'].map((item) => <span className='border border-border px-2 py-1.5' key={item}>{item}</span>)}
        </div>
      </ControlSection>
    </>
  );

  return (
    <ToolShell inspector={inspector} tool={tool}>
      <div className='grid min-h-full content-center p-5 sm:p-8'>
        <div className='mx-auto w-full max-w-5xl border border-border bg-background shadow-sm' style={{ fontFamily: identity.typography.find(({ role }) => role === 'Body')?.family ?? 'Inter' }}>
          <div className='flex items-center justify-between border-b border-border px-5 py-4'><div><p className='text-sm font-semibold'>{identity.name} components</p><p className='mt-1 text-xs text-muted-foreground'>{family}</p></div><span className='font-mono text-xs text-muted-foreground'>14 patterns</span></div>
          {family === 'actions' ? <div className='grid gap-px bg-border md:grid-cols-2'><section className='flex min-h-72 flex-col justify-between gap-10 bg-background p-8'><p className='font-mono text-xs uppercase tracking-widest text-muted-foreground'>Core actions</p><div className='flex flex-wrap items-center gap-3'><Button disabled={disabled} size={size}>{label}</Button><Button disabled={disabled} size={size} variant='rainbow'>{label}</Button><Button disabled={disabled} size={size} variant='outline'>{label}</Button><Button disabled={disabled} size={size} variant='secondary'>{label}</Button><Button disabled={disabled} size={size} variant='ghost'>{label}</Button><Button disabled={disabled} size={size} variant='destructive'>{label}</Button></div></section><section className='flex min-h-72 flex-col justify-between bg-foreground p-8 text-background'><p className='font-mono text-xs uppercase tracking-widest opacity-50'>Reversed</p><div className='flex flex-wrap gap-3'><Button disabled={disabled} size={size} variant='secondary'>{label}</Button><Button className='border-background/30 text-background hover:text-foreground' disabled={disabled} size={size} variant='outline'>{label}</Button></div></section></div> : null}
          {family === 'forms' ? <div className='grid gap-8 p-8 md:grid-cols-2'><div className='flex flex-col gap-5'><Field label={<T>Workspace name</T>}><input className={INPUT_CLASS} value={identity.name} readOnly /></Field><Field label={<T>Website</T>}><input className={INPUT_CLASS} value={identity.website} readOnly /></Field><Field label={<T>Role</T>}><select className={INPUT_CLASS} defaultValue='admin'><option value='admin'>Administrator</option><option value='member'>Member</option></select></Field></div><div className='flex flex-col gap-4'><label className='flex items-center justify-between border border-border p-4 text-sm'><span><strong className='block'>Automatic updates</strong><small className='text-muted-foreground'>Keep generated assets synchronized.</small></span><input defaultChecked type='checkbox' /></label><label className='flex items-center justify-between border border-border p-4 text-sm'><span><strong className='block'>Product email</strong><small className='text-muted-foreground'>Receive important changes.</small></span><input type='checkbox' /></label><Button className='w-fit'>{label}</Button></div></div> : null}
          {family === 'navigation' ? <div className='flex flex-col gap-8 p-8'><nav className='flex items-center justify-between border border-border p-3'><span className='font-semibold'>{identity.shortName}</span><div className='hidden gap-6 text-sm text-muted-foreground sm:flex'><span>Product</span><span>Docs</span><span>Customers</span></div><Button size='sm'>{label}</Button></nav><div className='flex items-center gap-2 text-sm text-muted-foreground'><span>Settings</span><span>/</span><span>Brand</span><span>/</span><strong className='text-foreground'>Components</strong></div><div className='flex border-b border-border'><span className='border-b-2 border-foreground px-4 py-2 text-sm font-medium'>Overview</span><span className='px-4 py-2 text-sm text-muted-foreground'>Assets</span><span className='px-4 py-2 text-sm text-muted-foreground'>History</span></div></div> : null}
          {family === 'feedback' ? <div className='grid gap-4 p-8 md:grid-cols-2'><div className='border border-status-success-border bg-status-success-background p-4 text-sm text-status-success'><strong>Brand updated</strong><p className='mt-1 opacity-75'>Every template now uses the latest settings.</p></div><div className='border border-status-error-border bg-status-error-background p-4 text-sm text-status-error'><strong>Export failed</strong><p className='mt-1 opacity-75'>Check the source asset and try again.</p></div><div className='border border-border p-4'><div className='flex justify-between text-sm'><span>Generating assets</span><span>68%</span></div><div className='mt-3 h-2 bg-muted'><div className='h-full w-[68%] bg-foreground' /></div></div><div className='flex items-center justify-between border border-border p-4 text-sm'><span>4 unread notifications</span><Button size='sm' variant='outline'>View</Button></div></div> : null}
          {family === 'data' ? <div className='p-8'><div className='grid gap-px bg-border sm:grid-cols-3'>{[['42,851','Translations'],['98.7%','Coverage'],['18.4%','Growth']].map(([value,name]) => <div className='bg-background p-5' key={name}><p className='text-3xl font-semibold tracking-tight'>{value}</p><p className='mt-2 text-xs text-muted-foreground'>{name}</p></div>)}</div><div className='mt-6 overflow-hidden border border-border'><div className='grid grid-cols-3 bg-muted p-3 font-mono text-[10px] uppercase text-muted-foreground'><span>Project</span><span>Status</span><span>Updated</span></div>{['Product','Docs','Email'].map((item) => <div className='grid grid-cols-3 border-t border-border p-4 text-sm' key={item}><span>{item}</span><span>Ready</span><span className='text-muted-foreground'>Today</span></div>)}</div></div> : null}
          {family === 'cards' ? <div className='grid gap-5 p-8 md:grid-cols-3'><article className='flex min-h-80 flex-col justify-between border border-border p-6'><div><p className='font-mono text-xs text-muted-foreground'>PRO</p><h3 className='mt-6 text-4xl font-semibold'>$49</h3><p className='mt-3 text-sm text-muted-foreground'>Shared identity, unlimited projects, and high-resolution exports.</p></div><Button>{label}</Button></article><article className='flex min-h-80 flex-col justify-between bg-foreground p-6 text-background'><p className='text-2xl font-semibold leading-tight'>“Everything finally feels like one system.”</p><div><p className='font-semibold'>Alex Morgan</p><p className='text-xs opacity-55'>Design Engineer</p></div></article><article className='flex min-h-80 flex-col justify-between border border-border p-6'><span className='font-mono text-xs text-muted-foreground'>NEW</span><div><h3 className='text-2xl font-semibold'>{identity.tagline}</h3><p className='mt-3 text-sm text-muted-foreground'>{identity.description}</p></div><span className='text-sm font-semibold'>Explore →</span></article></div> : null}
        </div>
      </div>
    </ToolShell>
  );
}

function ToolPlaceholder({ tool }: { tool: StudioTool }) {
  return (
    <ToolShell inspector={<ControlSection title={<T>Asset inputs</T>}><UploadField accept='image/*' label='Add source asset' onFile={() => {}} /></ControlSection>} tool={tool}>
      <div className='grid min-h-full place-items-center p-8'>
        <div className='flex max-w-md flex-col items-center gap-4 text-center'>
          <FileImage className='size-8 text-muted-foreground' aria-hidden='true' />
          <h2 className='text-xl font-semibold'><T>Start with a source asset</T></h2>
          <p className='text-sm leading-6 text-muted-foreground'>{tool.description}</p>
        </div>
      </div>
    </ToolShell>
  );
}

export default function StudioToolWorkspace({
  identity,
  onIdentityChange,
  tool,
}: {
  identity: BrandIdentity;
  onIdentityChange: (identity: BrandIdentity) => void;
  tool: StudioTool;
}) {
  const renderers: Partial<Record<StudioToolId, ReactNode>> = {
    backgrounds: <BackgroundStudio identity={identity} tool={tool} />,
    blog: <TemplateTool identity={identity} kind='blog' tool={tool} />,
    'brand-elements': <BrandElementsStudio identity={identity} tool={tool} />,
    buttons: <ComponentLibraryTool identity={identity} tool={tool} />,
    colors: <ColorTool identity={identity} tool={tool} />,
    'design-board': <DesignBoard identity={identity} tool={tool} />,
    identity: <BrandSettingsStudio identity={identity} onChange={onIdentityChange} tool={tool} />,
    logo: <LogoTool identity={identity} tool={tool} />,
    'logo-shader': <LogoShaderStudio identity={identity} tool={tool} />,
    opengraph: <OpenGraphTool identity={identity} tool={tool} />,
    partnership: <TemplateTool identity={identity} kind='partnership' tool={tool} />,
    slides: <TemplateTool identity={identity} kind='slides' tool={tool} />,
    terminal: <TerminalTool identity={identity} tool={tool} />,
    typography: <TypographyTool identity={identity} tool={tool} />,
  };

  return renderers[tool.id] ?? <ToolPlaceholder tool={tool} />;
}
