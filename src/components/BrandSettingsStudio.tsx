'use client';

import { useState, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import {
  BookOpenText,
  Check,
  Download,
  Files,
  Layers3,
  MessageSquareText,
  Palette,
  SlidersHorizontal,
  Save,
  ScanSearch,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import BrandIdentityPreview from '@/components/BrandIdentityPreview';
import BrandSystemDiagram from '@/components/BrandSystemDiagram';
import BrandVisualAudit from '@/components/BrandVisualAudit';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import {
  brandAssetPath,
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandAsset,
  type BrandDossier,
  type BrandFontAsset,
  type BrandIdentity,
  type BrandReference,
  type BrandTypography,
} from '@/lib/brandIdentity';
import { formatOklch, hexToOklch } from '@/lib/color';
import type { StudioTool } from '@/lib/studioCatalog';
import { capVisibleFontWeight, MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';

const INPUT_CLASS =
  'h-10 w-full border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-foreground';
const TEXTAREA_CLASS =
  'min-h-24 w-full resize-y border border-input bg-background p-3 text-sm leading-6 text-foreground outline-none focus:border-foreground';

type IdentitySection = 'overview' | 'audit' | 'direction' | 'assets' | 'typography' | 'colors' | 'voice' | 'system';

const SECTIONS: readonly {
  icon: typeof Layers3;
  id: IdentitySection;
  label: string;
}[] = [
  { icon: Layers3, id: 'overview', label: 'Overview' },
  { icon: ScanSearch, id: 'audit', label: 'Visual audit' },
  { icon: BookOpenText, id: 'direction', label: 'Direction & references' },
  { icon: Files, id: 'assets', label: 'Asset library' },
  { icon: Type, id: 'typography', label: 'Typography' },
  { icon: Palette, id: 'colors', label: 'Color system' },
  { icon: MessageSquareText, id: 'voice', label: 'Voice & strategy' },
  { icon: SlidersHorizontal, id: 'system', label: 'System defaults' },
];

const ASSET_TYPES: readonly BrandAsset['type'][] = [
  'logo',
  'background',
  'texture',
  'image',
  'icon',
  'product',
  'proof',
  'motion',
  'reference',
];

type BrandDossierTextField = Exclude<keyof BrandDossier, 'applications' | 'prohibited' | 'renderingRecipe'>;

const DOSSIER_FIELDS: readonly { id: BrandDossierTextField; label: string }[] = [
  { id: 'premise', label: 'Brand premise' },
  { id: 'personality', label: 'Personality' },
  { id: 'logo', label: 'Logo system' },
  { id: 'typography', label: 'Typography direction' },
  { id: 'color', label: 'Color direction' },
  { id: 'imagery', label: 'Image selection and treatment' },
  { id: 'layout', label: 'Layout and composition' },
  { id: 'graphicDevice', label: 'Graphic device' },
  { id: 'motion', label: 'Motion principles' },
  { id: 'provenance', label: 'Provenance and licensing' },
];

const TYPOGRAPHY_ROLES: readonly BrandTypography['role'][] = [
  'Display',
  'Body',
  'Accent',
  'Code',
];

function Field({ children, label }: { children: ReactNode; label: ReactNode }) {
  return (
    <label className='brand-identity-field'>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Panel({ children, description, title }: { children: ReactNode; description?: ReactNode; title: ReactNode }) {
  return (
    <section className='brand-identity-panel'>
      <header>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className='brand-identity-panel-content'>{children}</div>
    </section>
  );
}

function RangeField({
  label,
  max,
  min,
  onChange,
  step = 1,
  suffix = '',
  value,
}: {
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  value: number;
}) {
  const resolvedValue = Math.min(value, max);
  return (
    <label className='brand-identity-range'>
      <span><span>{label}</span><output>{resolvedValue}{suffix}</output></span>
      <input className='studio-range' max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} type='range' value={resolvedValue} />
    </label>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new DOMException('The selected file could not be read.'));
    });
    reader.addEventListener('error', () => reject(reader.error ?? new DOMException('The selected file could not be read.')));
    reader.readAsDataURL(file);
  });
}

function listValue(values: string[]): string {
  return values.join('\n');
}

function parseList(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function fontFormat(file: File): BrandFontAsset['format'] | null {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase();
  if (extension === 'ttf') return 'truetype';
  if (extension === 'otf') return 'opentype';
  if (extension === 'woff') return 'woff';
  if (extension === 'woff2') return 'woff2';
  return null;
}

function familyFromFileName(fileName: string): string {
  return fileName
    .replace(/\.(otf|ttf|woff2?)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b(variable|regular|medium|semibold|bold|italic)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Uploaded font';
}

function downloadIdentity(identity: BrandIdentity) {
  const blob = new Blob([JSON.stringify(identity, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${identity.id}-brand-identity.json`;
  link.href = url;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function BrandSettingsStudio({
  hasPendingChanges,
  identity,
  onChange,
  tool,
}: {
  hasPendingChanges: boolean;
  identity: BrandIdentity;
  onChange: (identity: BrandIdentity) => void;
  tool: StudioTool;
}) {
  const gt = useGT();
  const [activeSection, setActiveSection] = useState<IdentitySection>('overview');
  const [assetType, setAssetType] = useState<BrandAsset['type']>('image');
  const [feedback, setFeedback] = useState<string | null>(null);
  const fonts = brandFontAssets(identity);
  const allAssets = [...identity.assets, ...identity.proofAssets];
  const primaryReference = identity.references
    .map((reference) => reference.assetId ? allAssets.find((asset) => asset.id === reference.assetId) : undefined)
    .find((asset): asset is BrandAsset => Boolean(asset));
  const darkMark = brandAssetPath(identity, 'mark-dark');
  const lightMark = brandAssetPath(identity, 'mark-light');
  const displayTypography = brandTypographyRole(identity, 'Display');
  const colorPreviews = identity.colors.map((color) => {
    try {
      return { ...color, dark: hexToOklch(color.hex).lightness < 0.58, oklch: formatOklch(color.hex) };
    } catch {
      return { ...color, dark: false, oklch: gt('Invalid HEX') };
    }
  });

  function update(patch: Partial<BrandIdentity>) {
    onChange({ ...identity, ...patch });
  }

  function updateTypography(role: BrandTypography['role'], patch: Partial<BrandTypography>) {
    const hasRole = identity.typography.some((font) => font.role === role);
    const nextTypography = hasRole
      ? identity.typography.map((font) => font.role === role ? { ...font, ...patch } : font)
      : [...identity.typography, { ...brandTypographyRole(identity, role), ...patch }];
    update({ typography: nextTypography });
  }

  function updateDossier(patch: Partial<BrandDossier>) {
    update({ dossier: { ...identity.dossier, ...patch } });
  }

  function updateReference(referenceId: string, patch: Partial<BrandReference>) {
    update({
      references: identity.references.map((reference) => (
        reference.id === referenceId ? { ...reference, ...patch } : reference
      )),
    });
  }

  async function addAsset(file: File) {
    if (file.size > 4_000_000) {
      setFeedback(gt('Keep image assets under 4 MB so this local identity remains portable.'));
      return;
    }
    try {
      const nextAsset: BrandAsset = {
        alt: file.name.replace(/\.[^.]+$/, ''),
        focalPoint: { x: 0.5, y: 0.5 },
        id: `asset-${crypto.randomUUID()}`,
        label: file.name.replace(/\.[^.]+$/, ''),
        redistribution: 'original',
        path: await readFileAsDataUrl(file),
        surface: 'any',
        tags: [assetType],
        type: assetType,
        usage: assetType === 'background' ? 'Backgrounds, headers, banners, and cards' : 'Reusable brand artwork',
      };
      if (assetType === 'proof') update({ proofAssets: [...identity.proofAssets, nextAsset] });
      else update({ assets: [...identity.assets, nextAsset] });
      setFeedback(gt('Asset added to the shared library.'));
    } catch {
      setFeedback(gt('That asset could not be loaded.'));
    }
  }

  async function addFont(file: File) {
    const format = fontFormat(file);
    if (!format) {
      setFeedback(gt('Choose a TTF, OTF, WOFF, or WOFF2 font file.'));
      return;
    }
    if (file.size > 2_500_000) {
      setFeedback(gt('Keep font files under 2.5 MB so this local identity remains portable.'));
      return;
    }
    try {
      const family = familyFromFileName(file.name);
      const nextFont: BrandFontAsset = {
        family,
        fileName: file.name,
        format,
        id: `font-${crypto.randomUUID()}`,
        label: family,
        path: await readFileAsDataUrl(file),
        style: file.name.toLocaleLowerCase().includes('italic') ? 'italic' : 'normal',
        weight: file.name.toLocaleLowerCase().includes('bold') ? MAX_VISIBLE_FONT_WEIGHT : 400,
      };
      update({ fonts: [...fonts, nextFont] });
      setFeedback(gt('Font added. Assign it to any typography role below.'));
    } catch {
      setFeedback(gt('That font file could not be loaded.'));
    }
  }

  function updateAsset(asset: BrandAsset, patch: Partial<BrandAsset>) {
    const key = asset.type === 'proof' ? 'proofAssets' : 'assets';
    update({ [key]: identity[key].map((candidate) => candidate.id === asset.id ? { ...candidate, ...patch } : candidate) });
  }

  function removeAsset(asset: BrandAsset) {
    const key = asset.type === 'proof' ? 'proofAssets' : 'assets';
    update({ [key]: identity[key].filter((candidate) => candidate.id !== asset.id) });
  }

  function removeFont(fontId: string) {
    const nextFonts = fonts.filter((font) => font.id !== fontId);
    update({
      fonts: nextFonts,
      typography: identity.typography.map((font) => font.fontId === fontId
        ? { ...font, fontId: nextFonts[0]?.id, family: nextFonts[0]?.family ?? font.family }
        : font),
    });
  }

  return (
    <div className='tool-shell brand-identity-shell h-full min-h-0'>
      <header className='app-navbar tool-header brand-identity-header'>
        <div className='brand-identity-header-title'>
          <SlidersHorizontal aria-hidden='true' />
          <p>{gt(tool.name)}</p>
          <span>/</span>
          <small>{identity.name}</small>
        </div>
        <div className='brand-identity-header-actions'>
          <span data-pending={hasPendingChanges ? 'true' : 'false'}>
            {hasPendingChanges ? <Save aria-hidden='true' /> : <Check aria-hidden='true' />}
            {hasPendingChanges ? <T>Changes pending</T> : <T>Saved locally</T>}
          </span>
          <Button onClick={() => downloadIdentity(identity)} size='sm' type='button' variant='outline'><Download aria-hidden='true' /><T>Identity JSON</T></Button>
        </div>
      </header>

      <div className='brand-identity-body'>
        <nav aria-label={gt('Brand identity sections')} className='app-navbar brand-identity-nav'>
          <div className='brand-identity-nav-title'><T>Identity settings</T></div>
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button aria-current={activeSection === section.id ? 'page' : undefined} key={section.id} onClick={() => setActiveSection(section.id)} type='button'>
                <Icon aria-hidden='true' />
                <span>{gt(section.label)}</span>
              </button>
            );
          })}
        </nav>

        <div className='brand-identity-content' data-identity={identity.id} role='main'>
          <section className='brand-identity-masthead'>
            <div className='brand-identity-masthead-mark'>
              {darkMark ? <img alt='' src={darkMark} /> : <span>{identity.shortName}</span>}
            </div>
            <div className='min-w-0'>
              <h1 style={{ fontFamily: brandTypographyFamily(identity, 'Display'), fontWeight: displayTypography.weight, letterSpacing: `${displayTypography.letterSpacing}px`, lineHeight: displayTypography.lineHeight }}>{identity.name}</h1>
              <span>{identity.tagline}</span>
            </div>
            <div className='brand-identity-masthead-counts'>
              <span><strong>{allAssets.length}</strong><T>Assets</T></span>
              <span><strong>{fonts.length}</strong><T>Font files</T></span>
              <span><strong>{identity.colors.length}</strong><T>Colors</T></span>
            </div>
          </section>

          {feedback ? <div className='brand-identity-feedback' role='status'>{feedback}<button aria-label={gt('Dismiss message')} onClick={() => setFeedback(null)} type='button'>×</button></div> : null}

          {activeSection === 'overview' ? (
            <div className='brand-identity-section-grid'>
              <Panel description={<T>The durable facts used by every generated design.</T>} title={<T>Identity</T>}>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <Field label={<T>Brand name</T>}><input className={INPUT_CLASS} onChange={(event) => update({ name: event.target.value })} value={identity.name} /></Field>
                  <Field label={<T>Short name</T>}><input className={INPUT_CLASS} maxLength={4} onChange={(event) => update({ shortName: event.target.value.toLocaleUpperCase() })} value={identity.shortName} /></Field>
                  <Field label={<T>Website</T>}><input className={INPUT_CLASS} onChange={(event) => update({ website: event.target.value })} value={identity.website} /></Field>
                  <Field label={<T>Contact email</T>}><input className={INPUT_CLASS} onChange={(event) => update({ contactEmail: event.target.value })} type='email' value={identity.contactEmail} /></Field>
                </div>
                <Field label={<T>Tagline</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ tagline: event.target.value })} value={identity.tagline} /></Field>
                <Field label={<T>Positioning</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ positioning: event.target.value })} value={identity.positioning} /></Field>
                <Field label={<T>Mission</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ mission: event.target.value })} value={identity.mission} /></Field>
              </Panel>
              <Panel description={<T>A live summary of the source every canvas reads.</T>} title={<T>Identity preview</T>}>
                <BrandIdentityPreview darkMark={darkMark} identity={identity} lightMark={lightMark} />
              </Panel>
            </div>
          ) : null}

          {activeSection === 'audit' ? <BrandVisualAudit identity={identity} /> : null}

          {activeSection === 'direction' ? (
            <div className='brand-identity-section-stack'>
              <section className='brand-direction-editorial'>
                <div className='brand-direction-editorial-copy'>
                  <span><T>Identity direction</T></span>
                  <h2 style={{ fontFamily: brandTypographyFamily(identity, 'Display'), fontWeight: displayTypography.weight }}>{identity.tagline}</h2>
                  <div><p>{identity.dossier.premise}</p><small>{identity.dossier.personality}</small></div>
                </div>
                <div className='brand-direction-editorial-image' data-empty={primaryReference ? 'false' : 'true'}>
                  {primaryReference ? <img alt={primaryReference.alt ?? primaryReference.label} src={primaryReference.path} /> : <span>{identity.shortName}</span>}
                </div>
                <dl>
                  <div><dt><T>Image world</T></dt><dd>{identity.dossier.imagery}</dd></div>
                  <div><dt><T>Composition</T></dt><dd>{identity.dossier.layout}</dd></div>
                  <div><dt><T>Signature device</T></dt><dd>{identity.dossier.graphicDevice}</dd></div>
                </dl>
              </section>
              <Panel description={<T>A reusable, brand-native model of how the product or practice turns inputs into outcomes. This diagram is the basis for slides, explainers, and product stories.</T>} title={<T>System diagram</T>}>
                <BrandSystemDiagram identity={identity} />
              </Panel>
              <Panel description={<T>The strategic and visual guidance used to art-direct this identity instead of swapping tokens into a universal template.</T>} title={<T>Brand dossier</T>}>
                <div className='brand-dossier-grid'>
                  {DOSSIER_FIELDS.map((field) => (
                    <Field key={field.id} label={gt(field.label)}>
                      <textarea className={TEXTAREA_CLASS} onChange={(event) => updateDossier({ [field.id]: event.target.value })} value={identity.dossier[field.id]} />
                    </Field>
                  ))}
                  <Field label={<T>Application recipes · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => updateDossier({ applications: parseList(event.target.value) })} value={listValue(identity.dossier.applications)} /></Field>
                  <Field label={<T>Rendering recipe · one step per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => updateDossier({ renderingRecipe: parseList(event.target.value) })} value={listValue(identity.dossier.renderingRecipe)} /></Field>
                  <Field label={<T>Do not rules · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => updateDossier({ prohibited: parseList(event.target.value) })} value={listValue(identity.dossier.prohibited)} /></Field>
                </div>
              </Panel>
              <Panel description={<T>Twenty categorized research records define the visual world. Captures remain research-only unless their redistribution status explicitly permits bundling.</T>} title={<T>Reference contact sheet</T>}>
                <div className='brand-reference-summary'>
                  {(['official', 'campaign', 'concept', 'material', 'motion'] as const).map((category) => <span key={category}><strong>{identity.references.filter((reference) => reference.category === category).length}</strong>{gt(category)}</span>)}
                </div>
                <div className='brand-reference-grid'>
                  {identity.references.map((reference, index) => {
                    const asset = reference.assetId ? allAssets.find((candidate) => candidate.id === reference.assetId) : undefined;
                    return (
                      <article data-category={reference.category} key={reference.id}>
                        <div className='brand-reference-visual'>
                          {asset ? <img alt={asset.alt ?? asset.label} src={asset.path} /> : <span>{String(index + 1).padStart(2, '0')}</span>}
                        </div>
                        <div>
                          <small>{reference.category} · {reference.status}</small>
                          <strong>{reference.title}</strong>
                          <p>{reference.intendedUse}</p>
                          <details className='brand-reference-metadata'>
                            <summary><T>Source record</T></summary>
                            <div>
                              <input aria-label={gt('Reference source URL')} className={INPUT_CLASS} onChange={(event) => updateReference(reference.id, { sourceUrl: event.target.value })} placeholder={gt('Source URL')} value={reference.sourceUrl} />
                              <input aria-label={gt('Reference owner')} className={INPUT_CLASS} onChange={(event) => updateReference(reference.id, { owner: event.target.value })} placeholder={gt('Owner')} value={reference.owner} />
                              <StudioSelect ariaLabel={gt('Reference status')} onValueChange={(status) => updateReference(reference.id, { status: status as BrandReference['status'] })} options={[
                                { label: gt('Planned'), value: 'planned' },
                                { label: gt('Captured'), value: 'captured' },
                                { label: gt('Reviewed'), value: 'reviewed' },
                              ]} value={reference.status} />
                            </div>
                          </details>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </Panel>
            </div>
          ) : null}

          {activeSection === 'assets' ? (
            <div className='brand-identity-section-stack'>
              <Panel description={<T>Upload once, then use the same file in email, cards, headers, banners, backgrounds, slides, social, and exports.</T>} title={<T>Asset library</T>}>
                <div className='brand-asset-upload-row'>
                  <StudioSelect ariaLabel={gt('Asset type')} onValueChange={(value) => setAssetType(value as BrandAsset['type'])} options={ASSET_TYPES.map((type) => ({ label: gt(type), value: type }))} value={assetType} />
                  <label className='brand-asset-upload'>
                    <Upload aria-hidden='true' />
                    <span><strong><T>Add asset</T></strong><small><T>SVG, PNG, JPG, WebP, or GIF</T></small></span>
                    <input accept='image/*,.svg' className='sr-only' onChange={(event) => { const file = event.target.files?.[0]; if (file) void addAsset(file); event.target.value = ''; }} type='file' />
                  </label>
                </div>
                <div className='brand-asset-grid'>
                  {allAssets.map((asset) => (
                    <article className='brand-asset-card' key={asset.id}>
                      <div className='brand-asset-preview' data-surface={asset.surface}>
                        <img alt='' src={asset.path} />
                        <span>{asset.type}</span>
                      </div>
                      <div className='brand-asset-card-fields'>
                        <input aria-label={gt('Asset label')} className={INPUT_CLASS} onChange={(event) => updateAsset(asset, { label: event.target.value })} value={asset.label} />
                        <input aria-label={gt('Asset usage')} className={INPUT_CLASS} onChange={(event) => updateAsset(asset, { usage: event.target.value })} placeholder={gt('Where should this asset be used?')} value={asset.usage ?? ''} />
                        <details className='brand-asset-metadata'>
                          <summary><T>Provenance and treatment</T></summary>
                          <div>
                            <input aria-label={gt('Asset alt text')} className={INPUT_CLASS} onChange={(event) => updateAsset(asset, { alt: event.target.value })} placeholder={gt('Alt text')} value={asset.alt ?? ''} />
                            <StudioSelect ariaLabel={gt('Redistribution status')} onValueChange={(redistribution) => updateAsset(asset, { redistribution: redistribution as NonNullable<BrandAsset['redistribution']> })} options={[
                              { label: gt('Bundled'), value: 'bundled' },
                              { label: gt('Original'), value: 'original' },
                              { label: gt('Research only'), value: 'research-only' },
                              { label: gt('URL only'), value: 'url-only' },
                            ]} value={asset.redistribution ?? 'original'} />
                            <input aria-label={gt('Source URL')} className={INPUT_CLASS} onChange={(event) => updateAsset(asset, { sourceUrl: event.target.value })} placeholder={gt('Source URL')} value={asset.sourceUrl ?? ''} />
                            <input aria-label={gt('Source owner')} className={INPUT_CLASS} onChange={(event) => updateAsset(asset, { sourceOwner: event.target.value })} placeholder={gt('Source owner')} value={asset.sourceOwner ?? ''} />
                            <input aria-label={gt('Asset license')} className={INPUT_CLASS} onChange={(event) => updateAsset(asset, { license: event.target.value })} placeholder={gt('License or usage terms')} value={asset.license ?? ''} />
                            <input aria-label={gt('Asset tags')} className={INPUT_CLASS} onChange={(event) => updateAsset(asset, { tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} placeholder={gt('Tags, comma separated')} value={(asset.tags ?? []).join(', ')} />
                          </div>
                        </details>
                        <div>
                          <code>{asset.path.startsWith('data:') ? 'LOCAL / EMBEDDED' : asset.path}</code>
                          <Button aria-label={gt('Remove {name}', { name: asset.label })} onClick={() => removeAsset(asset)} size='icon-xs' title={gt('Remove asset')} type='button' variant='ghost'><Trash2 aria-hidden='true' /></Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}

          {activeSection === 'typography' ? (
            <div className='brand-identity-section-stack'>
              <Panel description={<T>Every face is a real file record. Upload a TTF or other web font, then assign it to one or more roles.</T>} title={<T>Font files</T>}>
                <label className='brand-font-upload'>
                  <Type aria-hidden='true' />
                  <span><strong><T>Upload font file</T></strong><small><T>TTF, OTF, WOFF, or WOFF2 · stored with this identity</T></small></span>
                  <input accept='.ttf,.otf,.woff,.woff2,font/*' className='sr-only' onChange={(event) => { const file = event.target.files?.[0]; if (file) void addFont(file); event.target.value = ''; }} type='file' />
                </label>
                <div className='brand-font-file-list'>
                  {fonts.map((font) => (
                    <div key={font.id}>
                      <span
                        className='brand-font-file-glyph'
                        style={{
                          fontFamily: font.family,
                          fontStyle: font.style,
                          fontWeight: capVisibleFontWeight(font.weight),
                        }}
                      >
                        Aa
                      </span>
                      <span><strong>{font.label}</strong><small>{font.fileName} · {font.format.toLocaleUpperCase()}</small></span>
                      <code>{font.weightMin ?? font.weight}{font.weightMax ? `–${font.weightMax}` : ''}</code>
                      <Button aria-label={gt('Remove {name}', { name: font.label })} disabled={fonts.length <= 1} onClick={() => removeFont(font.id)} size='icon-xs' type='button' variant='ghost'><Trash2 aria-hidden='true' /></Button>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel description={<T>These role controls flow into brand elements, slides, templates, previews, and exported graphics.</T>} title={<T>Typography roles</T>}>
                <div className='brand-type-role-grid'>
                  {TYPOGRAPHY_ROLES.map((role) => {
                    const typography = brandTypographyRole(identity, role);
                    const selectedFont = fonts.find((font) => font.id === typography.fontId) ?? fonts[0];
                    return (
                      <article key={role}>
                        <header><span>{role}</span><code>{capVisibleFontWeight(typography.weight ?? 400)}</code></header>
                        <p style={{ fontFamily: selectedFont?.family ?? typography.family, fontWeight: capVisibleFontWeight(typography.weight ?? 400), letterSpacing: `${typography.letterSpacing}px`, lineHeight: typography.lineHeight }}>{role === 'Code' ? `$ ${identity.id} build --brand` : role === 'Accent' ? identity.greetings.join(' · ') : identity.tagline}</p>
                        <div className='brand-type-role-controls'>
                          <Field label={<T>Font file</T>}>
                            <StudioSelect ariaLabel={gt('{role} font file', { role })} onValueChange={(fontId) => { const font = fonts.find((candidate) => candidate.id === fontId); if (font) updateTypography(role, { family: font.family, fontId }); }} options={fonts.map((font) => ({ label: `${font.label} · ${font.fileName}`, value: font.id }))} value={typography.fontId ?? selectedFont?.id ?? ''} />
                          </Field>
                          <Field label={<T>Usage</T>}><input className={INPUT_CLASS} onChange={(event) => updateTypography(role, { usage: event.target.value })} value={typography.usage} /></Field>
                          <RangeField label={<T>Weight</T>} max={Math.min(selectedFont?.weightMax ?? MAX_VISIBLE_FONT_WEIGHT, MAX_VISIBLE_FONT_WEIGHT)} min={selectedFont?.weightMin ?? 100} onChange={(weight) => updateTypography(role, { weight })} step={50} value={typography.weight ?? 400} />
                          <RangeField label={<T>Line height</T>} max={2} min={0.7} onChange={(lineHeight) => updateTypography(role, { lineHeight })} step={0.05} value={typography.lineHeight ?? 1.5} />
                          <RangeField label={<T>Tracking</T>} max={12} min={-8} onChange={(letterSpacing) => updateTypography(role, { letterSpacing })} step={0.25} suffix='px' value={typography.letterSpacing ?? 0} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </Panel>
            </div>
          ) : null}

          {activeSection === 'colors' ? (
            <Panel description={<T>Semantic colors stay editable in HEX and visible in OKLCH.</T>} title={<T>Color system</T>}>
              <div className='brand-color-grid'>
                {colorPreviews.map((color, index) => (
                  <article key={color.id}>
                    <div className='brand-color-swatch' style={{ backgroundColor: color.hex, color: color.dark ? '#FFFFFF' : '#181818' }}><strong>{color.name}</strong><code>{color.hex}<br />{color.oklch}</code></div>
                    <div className='brand-color-fields'>
                      <input aria-label={gt('Color name')} className={INPUT_CLASS} onChange={(event) => update({ colors: identity.colors.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} value={color.name} />
                      <input aria-label={gt('{name} usage', { name: color.name })} className={INPUT_CLASS} onChange={(event) => update({ colors: identity.colors.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item) })} value={color.role} />
                      <ColorControl ariaLabel={gt('{name} color', { name: color.name })} label={color.role} onChange={(hex) => update({ colors: identity.colors.map((item, itemIndex) => itemIndex === index ? { ...item, hex } : item) })} value={color.hex} />
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          ) : null}

          {activeSection === 'voice' ? (
            <div className='brand-identity-section-grid'>
              <Panel description={<T>The idea and promise beneath the visual system.</T>} title={<T>Strategy</T>}>
                <Field label={<T>Challenge</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ strategy: { ...identity.strategy, challenge: event.target.value } })} value={identity.strategy.challenge} /></Field>
                <Field label={<T>Central concept</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ strategy: { ...identity.strategy, concept: event.target.value } })} value={identity.strategy.concept} /></Field>
                <Field label={<T>Brand promise</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ strategy: { ...identity.strategy, promise: event.target.value } })} value={identity.strategy.promise} /></Field>
                <Field label={<T>Desired outcome</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ strategy: { ...identity.strategy, outcome: event.target.value } })} value={identity.strategy.outcome} /></Field>
                <Field label={<T>Strategic pillars · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ strategy: { ...identity.strategy, pillars: parseList(event.target.value) } })} value={listValue(identity.strategy.pillars)} /></Field>
              </Panel>
              <Panel description={<T>Words, principles, and language available to every template.</T>} title={<T>Voice</T>}>
                <Field label={<T>Voice principles · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ voice: { ...identity.voice, principles: parseList(event.target.value) } })} value={listValue(identity.voice.principles)} /></Field>
                <Field label={<T>Approved phrases · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ voice: { ...identity.voice, phrases: parseList(event.target.value) } })} value={listValue(identity.voice.phrases)} /></Field>
                <Field label={<T>Avoid · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ voice: { ...identity.voice, avoid: parseList(event.target.value) } })} value={listValue(identity.voice.avoid)} /></Field>
                <Field label={<T>Greetings · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ greetings: parseList(event.target.value) })} value={listValue(identity.greetings)} /></Field>
                <Field label={<T>Audiences · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ audiences: parseList(event.target.value) })} value={listValue(identity.audiences)} /></Field>
                <Field label={<T>Brand values · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ values: parseList(event.target.value) })} value={listValue(identity.values)} /></Field>
              </Panel>
            </div>
          ) : null}

          {activeSection === 'system' ? (
            <div className='brand-identity-section-grid'>
              <Panel description={<T>Shared layout and image behavior for every artifact.</T>} title={<T>Visual defaults</T>}>
                <Field label={<T>Interface density</T>}><StudioSelect ariaLabel={gt('Interface density')} onValueChange={(density) => update({ style: { ...identity.style, density: density as typeof identity.style.density } })} options={[{ label: gt('Compact'), value: 'compact' }, { label: gt('Comfortable'), value: 'comfortable' }, { label: gt('Spacious'), value: 'spacious' }]} value={identity.style.density} /></Field>
                <Field label={<T>Image treatment</T>}><StudioSelect ariaLabel={gt('Image treatment')} onValueChange={(imageTreatment) => update({ style: { ...identity.style, imageTreatment: imageTreatment as typeof identity.style.imageTreatment } })} options={[{ label: gt('Natural'), value: 'natural' }, { label: gt('Monochrome'), value: 'monochrome' }, { label: gt('Duotone'), value: 'duotone' }]} value={identity.style.imageTreatment} /></Field>
                <Field label={<T>Construction field</T>}><StudioSelect ariaLabel={gt('Construction field')} onValueChange={(grid) => update({ style: { ...identity.style, grid: grid as typeof identity.style.grid } })} options={[{ label: gt('None'), value: 'none' }, { label: gt('Dots'), value: 'dots' }, { label: gt('Lines'), value: 'lines' }]} value={identity.style.grid} /></Field>
                <RangeField label={<T>Corner radius</T>} max={32} min={0} onChange={(borderRadius) => update({ style: { ...identity.style, borderRadius } })} suffix='px' value={identity.style.borderRadius} />
                <RangeField label={<T>Default logo scale</T>} max={160} min={40} onChange={(logoScale) => update({ style: { ...identity.style, logoScale } })} suffix='%' value={identity.style.logoScale} />
              </Panel>
              <Panel description={<T>The recognizable device and rules that keep applications related.</T>} title={<T>Graphic system</T>}>
                <Field label={<T>Recognizable device</T>}><input className={INPUT_CLASS} onChange={(event) => update({ graphicSystem: { ...identity.graphicSystem, device: event.target.value } })} value={identity.graphicSystem.device} /></Field>
                <Field label={<T>Device rationale</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ graphicSystem: { ...identity.graphicSystem, description: event.target.value } })} value={identity.graphicSystem.description} /></Field>
                <Field label={<T>Composition behavior</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ graphicSystem: { ...identity.graphicSystem, composition: event.target.value } })} value={identity.graphicSystem.composition} /></Field>
                <Field label={<T>Image direction</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ graphicSystem: { ...identity.graphicSystem, imageDirection: event.target.value } })} value={identity.graphicSystem.imageDirection} /></Field>
                <Field label={<T>System rules · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ graphicSystem: { ...identity.graphicSystem, rules: parseList(event.target.value) } })} value={listValue(identity.graphicSystem.rules)} /></Field>
              </Panel>
            </div>
          ) : null}

          <section className='brand-identity-logo-strip'>
            <div>{darkMark ? <img alt='' src={darkMark} /> : <span>{identity.shortName}</span>}</div>
            <div>{lightMark ? <img alt='' src={lightMark} /> : <span>{identity.shortName}</span>}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
