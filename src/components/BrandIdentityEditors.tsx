'use client';

import type { ReactNode } from 'react';
import { T, useGT } from 'gt-next';

import AssetConversionLibrary from '@/components/AssetConversionLibrary';
import {
  Field,
  INPUT_CLASS,
  ListField,
  Panel,
  RangeField,
  TEXTAREA_CLASS,
  TextAreaField,
  TextField,
} from '@/components/BrandIdentityFields';
import BrandSystemDiagram from '@/components/BrandSystemDiagram';
import ColorControl from '@/components/ui/ColorControl';
import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
import { Plus, Trash2, Type, Upload } from '@/components/ui/SolidIcons';
import { useConvertedAssets } from '@/hooks/useConvertedAssets';
import {
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandApplication,
  type BrandAsset,
  type BrandColor,
  type BrandDossier,
  type BrandFontAsset,
  type BrandIdentity,
  type BrandReference,
  type BrandTypography,
  type BrandVoiceExample,
} from '@/lib/brandIdentity';
import { brandContrastResults } from '@/lib/brandHealth';
import { BRAND_LOGO_SLOTS, type BrandLogoSlot } from '@/lib/brandSource';
import { brandTypeScale } from '@/lib/brandTokens';
import { formatOklch, hexToOklch } from '@/lib/color';
import { capVisibleFontWeight, MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';

import styles from './BrandIdentityStudio.module.css';

export type BrandIdentityUpdate = (patch: Partial<BrandIdentity>) => void;

const ASSET_TYPES: readonly BrandAsset['type'][] = ['logo', 'background', 'texture', 'image', 'icon', 'product', 'proof', 'motion', 'reference'];
const TYPOGRAPHY_ROLES: readonly BrandTypography['role'][] = ['Display', 'Body', 'Accent', 'Code'];
const CORE_COLOR_IDS = new Set(['ink', 'paper', 'muted', 'emphasis']);
const SCALE_RATIOS: readonly { label: string; value: number }[] = [
  { label: 'Minor third · 1.2', value: 1.2 },
  { label: 'Major third · 1.25', value: 1.25 },
  { label: 'Perfect fourth · 1.333', value: 1.333 },
  { label: 'Augmented fourth · 1.414', value: 1.414 },
  { label: 'Perfect fifth · 1.5', value: 1.5 },
  { label: 'Golden ratio · 1.618', value: 1.618 },
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

function FileButton({ accept, children, label, onFile }: { accept: string; children: ReactNode; label: string; onFile: (file: File) => void }) {
  return (
    <label className={styles.fileButton}>
      {children}
      <input
        accept={accept}
        aria-label={label}
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

/* Voice & strategy ------------------------------------------------------- */

function VoiceExamples({ identity, update }: { identity: BrandIdentity; update: BrandIdentityUpdate }) {
  const gt = useGT();
  const examples = identity.voice.examples ?? [];
  const setExamples = (next: BrandVoiceExample[]) => update({ voice: { ...identity.voice, examples: next } });
  const change = (index: number, patch: Partial<BrandVoiceExample>) => setExamples(examples.map((example, itemIndex) => (itemIndex === index ? { ...example, ...patch } : example)));
  return (
    <Panel
      actions={<Button onClick={() => setExamples([...examples, { avoid: '', context: '', write: '' }])} size='sm' type='button' variant='outline'><Plus aria-hidden='true' /><T>Add example</T></Button>}
      description={<T>Real places the brand writes, each with the on-brand line and the version to avoid.</T>}
      title={<T>Voice examples</T>}
    >
      {examples.length === 0 ? <p className={styles.emptyState}><T>No examples yet. Add three from the homepage, an error message and a release note.</T></p> : null}
      <ol className={styles.exampleList}>
        {examples.map((example, index) => (
          <li key={index}>
            <input aria-label={gt('Example {number} context', { number: index + 1 })} className={INPUT_CLASS} onChange={(event) => change(index, { context: event.target.value })} placeholder={gt('Context, such as Error message')} value={example.context} />
            <textarea aria-label={gt('Example {number} write', { number: index + 1 })} className={TEXTAREA_CLASS} onChange={(event) => change(index, { write: event.target.value })} placeholder={gt('Write')} value={example.write} />
            <textarea aria-label={gt('Example {number} avoid', { number: index + 1 })} className={TEXTAREA_CLASS} onChange={(event) => change(index, { avoid: event.target.value })} placeholder={gt('Avoid')} value={example.avoid} />
            <Button aria-label={gt('Remove example {number}', { number: index + 1 })} onClick={() => setExamples(examples.filter((_, itemIndex) => itemIndex !== index))} size='icon-xs' type='button' variant='ghost'><Trash2 aria-hidden='true' /></Button>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function StrategyVoiceSection({ identity, update }: { identity: BrandIdentity; update: BrandIdentityUpdate }) {
  const strategy = (patch: Partial<BrandIdentity['strategy']>) => update({ strategy: { ...identity.strategy, ...patch } });
  const voice = (patch: Partial<BrandIdentity['voice']>) => update({ voice: { ...identity.voice, ...patch } });
  return (
    <div className={styles.sectionStack}>
      <div className={styles.twoColumn}>
        <Panel description={<T>The idea and promise beneath the visual system.</T>} title={<T>Strategy</T>}>
          <TextAreaField label={<T>Challenge</T>} onChange={(challenge) => strategy({ challenge })} value={identity.strategy.challenge} />
          <TextAreaField label={<T>Central concept</T>} onChange={(concept) => strategy({ concept })} value={identity.strategy.concept} />
          <TextAreaField label={<T>Brand promise</T>} onChange={(promise) => strategy({ promise })} value={identity.strategy.promise} />
          <TextAreaField label={<T>Desired outcome</T>} onChange={(outcome) => strategy({ outcome })} value={identity.strategy.outcome} />
          <ListField label={<T>Strategic pillars · one per line</T>} onChange={(pillars) => strategy({ pillars })} values={identity.strategy.pillars} />
          <ListField label={<T>Personality traits · one per line</T>} onChange={(personality) => strategy({ personality })} values={identity.strategy.personality} />
        </Panel>
        <Panel description={<T>Words, principles, and language available to every template.</T>} title={<T>Voice</T>}>
          <ListField label={<T>Voice principles · one per line</T>} onChange={(principles) => voice({ principles })} values={identity.voice.principles} />
          <ListField label={<T>Approved phrases · one per line</T>} onChange={(phrases) => voice({ phrases })} values={identity.voice.phrases} />
          <ListField label={<T>Avoid · one per line</T>} onChange={(avoid) => voice({ avoid })} values={identity.voice.avoid} />
          <ListField label={<T>Greetings · one per line</T>} onChange={(greetings) => update({ greetings })} values={identity.greetings} />
        </Panel>
      </div>
      <VoiceExamples identity={identity} update={update} />
      <Panel description={<T>Who the brand serves, what it sells, and the proof it can cite.</T>} title={<T>Audience, products and proof</T>}>
        <div className={styles.formGrid}>
          <ListField label={<T>Audiences · one per line</T>} onChange={(audiences) => update({ audiences })} values={identity.audiences} />
          <ListField label={<T>Brand values · one per line</T>} onChange={(values) => update({ values })} values={identity.values} />
          <ListField label={<T>Products · one per line</T>} onChange={(products) => update({ products })} values={identity.products} />
          <ListField label={<T>Product one-liners · Name: what it does</T>} onChange={(lines) => update({ productDetails: parseProductDetails(lines) })} values={(identity.productDetails ?? []).map(({ name, summary }) => `${name}: ${summary}`)} />
          <ListField label={<T>Proof statements · one per line</T>} onChange={(proof) => update({ proof })} values={identity.proof} />
          <ListField label={<T>Customers · one per line</T>} onChange={(customers) => update({ customers })} values={identity.customers ?? []} />
        </div>
        <ListField label={<T>Sources · one per line</T>} onChange={(sourceNotes) => update({ sourceNotes })} values={identity.sourceNotes} />
      </Panel>
      <TemplateSamples identity={identity} update={update} />
    </div>
  );
}

/** "Name: summary" lines into product records; lines without a colon keep an empty summary out. */
function parseProductDetails(lines: readonly string[]): NonNullable<BrandIdentity['productDetails']> {
  return lines.flatMap((line) => {
    const index = line.indexOf(':');
    if (index <= 0) return [];
    const name = line.slice(0, index).trim();
    const summary = line.slice(index + 1).trim();
    return name && summary ? [{ name, summary }] : [];
  });
}

/** The sample person, event and product content templates print instead of placeholders. */
function TemplateSamples({ identity, update }: { identity: BrandIdentity; update: BrandIdentityUpdate }) {
  const samples = identity.samples ?? {};
  const person = samples.person ?? { name: '', role: '' };
  const event = samples.event ?? { date: '', location: '', name: '' };
  const code = samples.code ?? { label: '', snippet: '' };
  const release = samples.release ?? { items: [], title: '' };
  const set = (patch: Partial<NonNullable<BrandIdentity['samples']>>) => update({ samples: { ...samples, ...patch } });
  return (
    <Panel description={<T>Sample content for brand elements, boards and the book: a person, an event and real product actions. Plans are edited in the source.</T>} title={<T>Template samples</T>}>
      <div className={styles.formGrid}>
        <TextField label={<T>Sample person</T>} onChange={(name) => set({ person: { ...person, name } })} value={person.name} />
        <TextField label={<T>Role</T>} onChange={(role) => set({ person: { ...person, role } })} value={person.role} />
        <TextField label={<T>Event name</T>} onChange={(name) => set({ event: { ...event, name } })} value={event.name} />
        <TextField label={<T>Event location</T>} onChange={(location) => set({ event: { ...event, location } })} value={event.location} />
        <TextField label={<T>Event date</T>} onChange={(date) => set({ event: { ...event, date } })} value={event.date} />
        <TextField label={<T>Event time</T>} onChange={(time) => set({ event: { ...event, time } })} value={event.time ?? ''} />
        <TextField label={<T>Install command</T>} onChange={(install) => set({ install })} value={samples.install ?? ''} />
        <TextField label={<T>Code sample title</T>} onChange={(label) => set({ code: { ...code, label } })} value={code.label} />
      </div>
      <TextAreaField label={<T>Code sample</T>} onChange={(snippet) => set({ code: { ...code, snippet } })} value={code.snippet} />
      <div className={styles.formGrid}>
        <ListField label={<T>Product actions · one per line</T>} onChange={(actions) => set({ actions })} values={samples.actions ?? []} />
        <ListField label={<T>Latest update · title, then one change per line</T>} onChange={([title = '', ...items]) => set({ release: { items, title } })} values={release.title ? [release.title, ...release.items] : []} />
      </div>
    </Panel>
  );
}

/* Logos & assets ---------------------------------------------------------- */

function LogoSlots({ identity, onAddLogo }: { identity: BrandIdentity; onAddLogo: (file: File, slot: BrandLogoSlot) => void }) {
  const gt = useGT();
  return (
    <Panel description={<T>One file per slot. Glyphfield picks the right variant for every surface, export and agent brief.</T>} title={<T>Logo family</T>}>
      <ul className={styles.logoSlots}>
        {BRAND_LOGO_SLOTS.map((slot) => {
          const asset = identity.assets.find(({ id }) => id === slot.id);
          const generated = Boolean(asset?.label.startsWith('Generated pixel mark'));
          return (
            <li data-state={!asset ? 'empty' : generated ? 'placeholder' : 'set'} key={slot.id}>
              <div className={styles.logoSlotPreview} data-surface={slot.surface}>
                {asset ? <img alt={asset.alt ?? asset.label} src={asset.path} /> : <span>{slot.required ? gt('Required') : gt('Optional')}</span>}
              </div>
              <div>
                <strong>{gt(slot.label)}</strong>
                <small>{!asset ? gt('Not set') : generated ? gt('Generated placeholder') : asset.label}</small>
                <code>{slot.id}</code>
              </div>
              <FileButton accept='image/*,.svg' label={gt('Upload {slot}', { slot: slot.label.toLocaleLowerCase() })} onFile={(file) => onAddLogo(file, slot.id)}>
                <Upload aria-hidden='true' /><span>{asset ? <T>Replace</T> : <T>Upload</T>}</span>
              </FileButton>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function AssetCard({ asset, onRemove, onUpdate }: { asset: BrandAsset; onRemove: () => void; onUpdate: (patch: Partial<BrandAsset>) => void }) {
  const gt = useGT();
  return (
    <article className='brand-asset-card'>
      <div className='brand-asset-preview' data-surface={asset.surface}>
        <img alt='' src={asset.path} />
        <span>{asset.type}</span>
      </div>
      <div className='brand-asset-card-fields'>
        <input aria-label={gt('Asset label')} className={INPUT_CLASS} onChange={(event) => onUpdate({ label: event.target.value })} value={asset.label} />
        <input aria-label={gt('Asset usage')} className={INPUT_CLASS} onChange={(event) => onUpdate({ usage: event.target.value })} placeholder={gt('Where should this asset be used?')} value={asset.usage ?? ''} />
        <details className='brand-asset-metadata'>
          <summary><T>Provenance and treatment</T></summary>
          <div>
            <input aria-label={gt('Asset alt text')} className={INPUT_CLASS} onChange={(event) => onUpdate({ alt: event.target.value })} placeholder={gt('Alt text')} value={asset.alt ?? ''} />
            <StudioSelect ariaLabel={gt('Redistribution status')} onValueChange={(redistribution) => onUpdate({ redistribution: redistribution as NonNullable<BrandAsset['redistribution']> })} options={[
              { label: gt('Bundled'), value: 'bundled' },
              { label: gt('Original'), value: 'original' },
              { label: gt('Research only'), value: 'research-only' },
              { label: gt('URL only'), value: 'url-only' },
            ]} value={asset.redistribution ?? 'original'} />
            <input aria-label={gt('Source URL')} className={INPUT_CLASS} onChange={(event) => onUpdate({ sourceUrl: event.target.value })} placeholder={gt('Source URL')} value={asset.sourceUrl ?? ''} />
            <input aria-label={gt('Source owner')} className={INPUT_CLASS} onChange={(event) => onUpdate({ sourceOwner: event.target.value })} placeholder={gt('Source owner')} value={asset.sourceOwner ?? ''} />
            <input aria-label={gt('Asset license')} className={INPUT_CLASS} onChange={(event) => onUpdate({ license: event.target.value })} placeholder={gt('License or usage terms')} value={asset.license ?? ''} />
            <input aria-label={gt('Asset tags')} className={INPUT_CLASS} onChange={(event) => onUpdate({ tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} placeholder={gt('Tags, comma separated')} value={(asset.tags ?? []).join(', ')} />
          </div>
        </details>
        <div>
          <code>{asset.path.startsWith('data:') ? 'LOCAL / EMBEDDED' : asset.path}</code>
          <Button aria-label={gt('Remove {name}', { name: asset.label })} onClick={onRemove} size='icon-xs' title={gt('Remove asset')} type='button' variant='ghost'><Trash2 aria-hidden='true' /></Button>
        </div>
      </div>
    </article>
  );
}

export function AssetsSection({
  assetType,
  identity,
  onAddAsset,
  onAddLogo,
  setAssetType,
  update,
}: {
  assetType: BrandAsset['type'];
  identity: BrandIdentity;
  onAddAsset: (file: File) => void;
  onAddLogo: (file: File, slot: BrandLogoSlot) => void;
  setAssetType: (type: BrandAsset['type']) => void;
  update: BrandIdentityUpdate;
}) {
  const gt = useGT();
  const convertedAssetLibrary = useConvertedAssets();
  const allAssets = [...identity.assets, ...identity.proofAssets];
  const keyFor = (asset: BrandAsset) => (identity.proofAssets.includes(asset) ? 'proofAssets' : 'assets') as 'assets' | 'proofAssets';
  return (
    <div className={styles.sectionStack}>
      <LogoSlots identity={identity} onAddLogo={onAddLogo} />
      <Panel description={<T>Upload once, then use the same file in email, cards, headers, banners, backgrounds, slides, social, and exports.</T>} title={<T>Asset library</T>}>
        <div className='brand-asset-upload-row'>
          <StudioSelect ariaLabel={gt('Asset type')} onValueChange={(value) => setAssetType(value as BrandAsset['type'])} options={ASSET_TYPES.map((type) => ({ label: gt(type), value: type }))} value={assetType} />
          <label className='brand-asset-upload'>
            <Upload aria-hidden='true' />
            <span><strong><T>Add asset</T></strong><small><T>SVG, PNG, JPG, WebP, or GIF</T></small></span>
            <input accept='image/*,.svg' className='sr-only' onChange={(event) => { const file = event.target.files?.[0]; if (file) onAddAsset(file); event.target.value = ''; }} type='file' />
          </label>
        </div>
        <div className='brand-asset-grid'>
          {allAssets.map((asset) => {
            const key = keyFor(asset);
            return (
              <AssetCard
                asset={asset}
                key={`${key}-${asset.id}`}
                onRemove={() => update({ [key]: identity[key].filter((candidate) => candidate.id !== asset.id) })}
                onUpdate={(patch) => update({ [key]: identity[key].map((candidate) => (candidate.id === asset.id ? { ...candidate, ...patch } : candidate)) })}
              />
            );
          })}
        </div>
      </Panel>
      <Panel description={<T>Sanitize SVGs and normalize PNG, JPG, WebP, GIF, AVIF, or BMP files into transparent, shader-safe PNG working copies. Originals remain available locally.</T>} title={<T>Conversion library</T>}>
        <AssetConversionLibrary library={convertedAssetLibrary} />
      </Panel>
    </div>
  );
}

/* Color ----------------------------------------------------------------- */

function colorPreview(color: BrandColor) {
  try {
    return { dark: hexToOklch(color.hex).lightness < 0.58, oklch: formatOklch(color.hex) };
  } catch {
    return { dark: false, oklch: 'Invalid HEX' };
  }
}

function tokenId(name: string, taken: ReadonlySet<string>): string {
  const base = name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').replace(/^[^a-z]+/, '') || 'color';
  let candidate = base;
  for (let index = 2; taken.has(candidate); index += 1) candidate = `${base}-${index}`;
  return candidate;
}

function ColorPairs({ identity, update }: { identity: BrandIdentity; update: BrandIdentityUpdate }) {
  const gt = useGT();
  const results = brandContrastResults(identity);
  const declared = identity.colorPairings ?? [];
  const options = identity.colors.map((color) => ({ label: color.name, value: color.id }));
  const setPairs = (next: NonNullable<BrandIdentity['colorPairings']>) => update({ colorPairings: next });
  return (
    <Panel
      actions={<Button onClick={() => setPairs([...(declared.length ? declared : results.map(({ background, foreground, level, usage }) => ({ background, foreground, level, usage }))), { background: 'paper', foreground: 'ink', level: 'AA', usage: gt('Text') }])} size='sm' type='button' variant='outline'><Plus aria-hidden='true' /><T>Add pair</T></Button>}
      description={declared.length ? <T>Text pairs the brand allows. Each is checked against WCAG AA.</T> : <T>No pairs declared, so the audit checks ink on paper, ink on muted and text on the accent.</T>}
      title={<T>Text pairs</T>}
    >
      <ul className={styles.pairList}>
        {results.map((pair, index) => (
          <li data-passes={pair.passes ? 'true' : 'false'} key={`${pair.foreground}-${pair.background}-${index}`}>
            <span className={styles.contrastSample} style={{ background: pair.backgroundHex, color: pair.foregroundHex }}>Aa</span>
            {declared.length ? (
              <>
                <StudioSelect ariaLabel={gt('Pair {number} text color', { number: index + 1 })} onValueChange={(foreground) => setPairs(declared.map((item, itemIndex) => (itemIndex === index ? { ...item, foreground } : item)))} options={options} value={pair.foreground} />
                <StudioSelect ariaLabel={gt('Pair {number} background', { number: index + 1 })} onValueChange={(background) => setPairs(declared.map((item, itemIndex) => (itemIndex === index ? { ...item, background } : item)))} options={options} value={pair.background} />
                <StudioSelect ariaLabel={gt('Pair {number} level', { number: index + 1 })} onValueChange={(level) => setPairs(declared.map((item, itemIndex) => (itemIndex === index ? { ...item, level: level as 'AA' | 'AA-large' } : item)))} options={[{ label: gt('AA text'), value: 'AA' }, { label: gt('AA large'), value: 'AA-large' }]} value={pair.level} />
                <input aria-label={gt('Pair {number} use', { number: index + 1 })} className={INPUT_CLASS} onChange={(event) => setPairs(declared.map((item, itemIndex) => (itemIndex === index ? { ...item, usage: event.target.value } : item)))} value={pair.usage} />
              </>
            ) : <span className={styles.pairUsage}>{pair.foreground} / {pair.background} · {pair.usage}</span>}
            <span className={styles.contrastRatio}>{pair.ratio.toFixed(2)}:1</span>
            <span className={styles.contrastVerdict}>{pair.passes ? 'Pass' : 'Fail'}</span>
            {declared.length ? <Button aria-label={gt('Remove pair {number}', { number: index + 1 })} onClick={() => setPairs(declared.filter((_, itemIndex) => itemIndex !== index))} size='icon-xs' type='button' variant='ghost'><Trash2 aria-hidden='true' /></Button> : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function ColorSection({ identity, update }: { identity: BrandIdentity; update: BrandIdentityUpdate }) {
  const gt = useGT();
  const setColor = (index: number, patch: Partial<BrandColor>) => update({ colors: identity.colors.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) });
  const total = identity.colors.reduce((sum, color) => sum + (color.proportion ?? 0), 0);
  return (
    <div className={styles.sectionStack}>
      <Panel
        actions={<Button onClick={() => update({ colors: [...identity.colors, { hex: '#808080', id: tokenId('New color', new Set(identity.colors.map(({ id }) => id))), name: gt('New color'), proportion: 0, role: gt('Describe what this color is for') }] })} size='sm' type='button' variant='outline'><Plus aria-hidden='true' /><T>Add color</T></Button>}
        description={gt('Semantic colors stay editable in HEX and visible in OKLCH. Shares add up to {total}%; aim for about 60 / 30 / 10.', { total })}
        title={<T>Palette</T>}
      >
        <div className='brand-color-grid'>
          {identity.colors.map((color, index) => {
            const preview = colorPreview(color);
            return (
              <article key={color.id}>
                <div className='brand-color-swatch' style={{ backgroundColor: color.hex, color: preview.dark ? '#FFFFFF' : '#181818' }}><strong>{color.name}</strong><code>{color.hex}<br />{preview.oklch}<br />--{color.id}</code></div>
                <div className='brand-color-fields'>
                  <input aria-label={gt('Color name')} className={INPUT_CLASS} onChange={(event) => setColor(index, { name: event.target.value })} value={color.name} />
                  <input aria-label={gt('{name} usage', { name: color.name })} className={INPUT_CLASS} onChange={(event) => setColor(index, { role: event.target.value })} value={color.role} />
                  <ColorControl ariaLabel={gt('{name} color', { name: color.name })} label={color.role} onChange={(hex) => setColor(index, { hex })} value={color.hex} />
                  <div className={styles.inlineFields}>
                    <span className={styles.inlineLabel}><T>Share</T></span>
                    <input aria-label={gt('{name} share of the palette', { name: color.name })} className={INPUT_CLASS} max={100} min={0} onChange={(event) => setColor(index, { proportion: event.target.value === '' ? undefined : Math.min(100, Math.max(0, Number(event.target.value))) })} placeholder='0' type='number' value={color.proportion ?? ''} />
                    <span className={styles.inlineLabel}>%</span>
                    {CORE_COLOR_IDS.has(color.id) ? null : <Button aria-label={gt('Remove {name}', { name: color.name })} onClick={() => update({ colorPairings: identity.colorPairings?.filter((pair) => pair.foreground !== color.id && pair.background !== color.id), colors: identity.colors.filter((_, itemIndex) => itemIndex !== index) })} size='icon-sm' type='button' variant='ghost'><Trash2 aria-hidden='true' /></Button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
      <ColorPairs identity={identity} update={update} />
    </div>
  );
}

/* Typography ------------------------------------------------------------ */

function FontFiles({ fonts, identity, onAddFont, update }: { fonts: BrandFontAsset[]; identity: BrandIdentity; onAddFont: (file: File) => void; update: BrandIdentityUpdate }) {
  const gt = useGT();
  const removeFont = (fontId: string) => {
    const nextFonts = fonts.filter((font) => font.id !== fontId);
    update({
      fonts: nextFonts,
      typography: identity.typography.map((font) => (font.fontId === fontId
        ? { ...font, family: nextFonts[0]?.family ?? font.family, fontId: nextFonts[0]?.id }
        : font)),
    });
  };
  return (
    <Panel description={<T>Every face is a real file record. Upload a TTF or other web font, then assign it to one or more roles.</T>} title={<T>Font files</T>}>
      <label className='brand-font-upload'>
        <Type aria-hidden='true' />
        <span><strong><T>Upload font file</T></strong><small><T>TTF, OTF, WOFF, or WOFF2 · stored with this identity</T></small></span>
        <input accept='.ttf,.otf,.woff,.woff2,font/*' className='sr-only' onChange={(event) => { const file = event.target.files?.[0]; if (file) onAddFont(file); event.target.value = ''; }} type='file' />
      </label>
      <div className='brand-font-file-list'>
        {fonts.map((font) => (
          <div key={font.id}>
            <span className='brand-font-file-glyph' style={{ fontFamily: font.family, fontStyle: font.style, fontWeight: capVisibleFontWeight(font.weight) }}>Aa</span>
            <span>
              <strong>{font.label}</strong>
              <small>{font.family} · {font.format.toLocaleUpperCase()}</small>
              <input aria-label={gt('{name} license', { name: font.label })} className={`${INPUT_CLASS} ${styles.compactInput}`} onChange={(event) => update({ fonts: fonts.map((candidate) => (candidate.id === font.id ? { ...candidate, license: event.target.value } : candidate)) })} placeholder={gt('License, such as OFL-1.1')} value={font.license ?? ''} />
            </span>
            <code>{font.weightMin ?? font.weight}{font.weightMax ? `–${font.weightMax}` : ''}</code>
            <Button aria-label={gt('Remove {name}', { name: font.label })} disabled={fonts.length <= 1} onClick={() => removeFont(font.id)} size='icon-xs' type='button' variant='ghost'><Trash2 aria-hidden='true' /></Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TypeScale({ identity, update }: { identity: BrandIdentity; update: BrandIdentityUpdate }) {
  const gt = useGT();
  const scale = identity.typeScale ?? { basePx: 16, ratio: 1.25 };
  const steps = brandTypeScale({ typeScale: scale });
  const display = brandTypographyRole(identity, 'Display');
  return (
    <Panel description={<T>Every size comes from one base and one ratio, so hierarchy stays consistent across layouts and exported tokens.</T>} title={<T>Type scale</T>}>
      <div className={styles.formGrid}>
        <RangeField label={<T>Base size</T>} max={24} min={12} onChange={(basePx) => update({ typeScale: { ...scale, basePx } })} suffix='px' value={scale.basePx} />
        <Field label={<T>Scale ratio</T>}>
          <StudioSelect ariaLabel={gt('Scale ratio')} onValueChange={(ratio) => update({ typeScale: { ...scale, ratio: Number(ratio) } })} options={SCALE_RATIOS.some(({ value }) => value === scale.ratio) ? SCALE_RATIOS.map(({ label, value }) => ({ label, value: String(value) })) : [...SCALE_RATIOS, { label: `Custom · ${scale.ratio}`, value: scale.ratio }].map(({ label, value }) => ({ label, value: String(value) }))} value={String(scale.ratio)} />
        </Field>
      </div>
      <ol className={styles.scaleList}>
        {[...steps].reverse().map((step) => (
          <li key={step.name}>
            <code>{step.name}</code>
            <span style={{ fontFamily: brandTypographyFamily(identity, step.step >= 3 ? 'Display' : 'Body'), fontSize: `${Math.min(step.px, 72)}px`, fontWeight: step.step >= 3 ? display.weight : undefined, lineHeight: step.step >= 3 ? 1 : 1.3 }}>{identity.name}</span>
            <small>{step.px}px</small>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function sampleText(identity: BrandIdentity, role: BrandTypography['role']): string {
  if (role === 'Code') return `$ ${identity.id} build --brand`;
  if (role === 'Accent') return identity.greetings.join(' · ');
  return identity.tagline;
}

function TypeRoles({ fonts, identity, update }: { fonts: BrandFontAsset[]; identity: BrandIdentity; update: BrandIdentityUpdate }) {
  const gt = useGT();
  const updateTypography = (role: BrandTypography['role'], patch: Partial<BrandTypography>) => {
    const hasRole = identity.typography.some((font) => font.role === role);
    update({
      typography: hasRole
        ? identity.typography.map((font) => (font.role === role ? { ...font, ...patch } : font))
        : [...identity.typography, { ...brandTypographyRole(identity, role), ...patch }],
    });
  };
  return (
    <Panel description={<T>These role controls flow into brand elements, slides, templates, previews, and exported graphics.</T>} title={<T>Typography roles</T>}>
      <div className='brand-type-role-grid'>
        {TYPOGRAPHY_ROLES.map((role) => {
          const typography = brandTypographyRole(identity, role);
          const selectedFont = fonts.find((font) => font.id === typography.fontId) ?? fonts[0];
          return (
            <article key={role}>
              <header><span>{role}</span><code>{capVisibleFontWeight(typography.weight ?? 400)}</code></header>
              <p style={{ fontFamily: selectedFont?.family ?? typography.family, fontWeight: capVisibleFontWeight(typography.weight ?? 400), letterSpacing: `${typography.letterSpacing}px`, lineHeight: typography.lineHeight }}>{sampleText(identity, role)}</p>
              <div className='brand-type-role-controls'>
                <Field label={<T>Font family</T>}>
                  <StudioSelect ariaLabel={gt('{role} font family', { role })} onValueChange={(fontId) => { const font = fonts.find((candidate) => candidate.id === fontId); if (font) updateTypography(role, { family: font.family, fontId }); }} options={fonts.map((font) => ({ label: font.label, value: font.id }))} value={typography.fontId ?? selectedFont?.id ?? ''} />
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
  );
}

export function TypographySection({ identity, onAddFont, update }: { identity: BrandIdentity; onAddFont: (file: File) => void; update: BrandIdentityUpdate }) {
  const fonts = brandFontAssets(identity);
  return (
    <div className={styles.sectionStack}>
      <FontFiles fonts={fonts} identity={identity} onAddFont={onAddFont} update={update} />
      <TypeRoles fonts={fonts} identity={identity} update={update} />
      <TypeScale identity={identity} update={update} />
    </div>
  );
}

/* System defaults ------------------------------------------------------- */

export function SystemSection({ identity, update }: { identity: BrandIdentity; update: BrandIdentityUpdate }) {
  const gt = useGT();
  const style = (patch: Partial<BrandIdentity['style']>) => update({ style: { ...identity.style, ...patch } });
  const graphic = (patch: Partial<BrandIdentity['graphicSystem']>) => update({ graphicSystem: { ...identity.graphicSystem, ...patch } });
  return (
    <div className={styles.twoColumn}>
      <Panel description={<T>Shared layout and image behavior for every artifact.</T>} title={<T>Visual defaults</T>}>
        <Field label={<T>Interface density</T>}><StudioSelect ariaLabel={gt('Interface density')} onValueChange={(density) => style({ density: density as BrandIdentity['style']['density'] })} options={[{ label: gt('Compact'), value: 'compact' }, { label: gt('Comfortable'), value: 'comfortable' }, { label: gt('Spacious'), value: 'spacious' }]} value={identity.style.density} /></Field>
        <Field label={<T>Image treatment</T>}><StudioSelect ariaLabel={gt('Image treatment')} onValueChange={(imageTreatment) => style({ imageTreatment: imageTreatment as BrandIdentity['style']['imageTreatment'] })} options={[{ label: gt('Natural'), value: 'natural' }, { label: gt('Monochrome'), value: 'monochrome' }, { label: gt('Duotone'), value: 'duotone' }]} value={identity.style.imageTreatment} /></Field>
        <Field label={<T>Construction field</T>}><StudioSelect ariaLabel={gt('Construction field')} onValueChange={(grid) => style({ grid: grid as BrandIdentity['style']['grid'] })} options={[{ label: gt('None'), value: 'none' }, { label: gt('Dots'), value: 'dots' }, { label: gt('Lines'), value: 'lines' }]} value={identity.style.grid} /></Field>
        <RangeField label={<T>Corner radius</T>} max={32} min={0} onChange={(borderRadius) => style({ borderRadius })} suffix='px' value={identity.style.borderRadius} />
        <RangeField label={<T>Default logo scale</T>} max={160} min={40} onChange={(logoScale) => style({ logoScale })} suffix='%' value={identity.style.logoScale} />
      </Panel>
      <Panel description={<T>The recognizable device and rules that keep applications related.</T>} title={<T>Graphic system</T>}>
        <Field label={<T>Recognizable device</T>}><input className={INPUT_CLASS} onChange={(event) => graphic({ device: event.target.value })} value={identity.graphicSystem.device} /></Field>
        <Field label={<T>Pattern grammar</T>}><StudioSelect ariaLabel={gt('Pattern grammar')} onValueChange={(pattern) => graphic({ pattern: pattern as BrandIdentity['graphicSystem']['pattern'] })} options={['none', 'blocks', 'brackets', 'burst', 'circuit', 'flow', 'grid', 'orbit', 'rays', 'steps', 'wave'].map((value) => ({ label: gt(value), value }))} value={identity.graphicSystem.pattern} /></Field>
        <TextAreaField label={<T>Device rationale</T>} onChange={(description) => graphic({ description })} value={identity.graphicSystem.description} />
        <TextAreaField label={<T>Composition behavior</T>} onChange={(composition) => graphic({ composition })} value={identity.graphicSystem.composition} />
        <TextAreaField label={<T>Image direction</T>} onChange={(imageDirection) => graphic({ imageDirection })} value={identity.graphicSystem.imageDirection} />
        <ListField label={<T>System rules · one per line</T>} onChange={(rules) => graphic({ rules })} values={identity.graphicSystem.rules} />
      </Panel>
    </div>
  );
}

/* Direction & references -------------------------------------------------- */

function ApplicationsEditor({ identity, update }: { identity: BrandIdentity; update: BrandIdentityUpdate }) {
  const gt = useGT();
  const setApplication = (index: number, patch: Partial<BrandApplication>) => update({ applications: identity.applications.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) });
  const categories: BrandApplication['category'][] = ['foundation', 'product', 'marketing', 'editorial', 'social', 'developer', 'event', 'physical'];
  return (
    <Panel
      actions={<Button onClick={() => update({ applications: [...identity.applications, { category: 'marketing', description: '', format: '1:1', id: `application-${Date.now().toString(36)}`, name: gt('New application') }] })} size='sm' type='button' variant='outline'><Plus aria-hidden='true' /><T>Add application</T></Button>}
      description={<T>The real places the identity must work. Moodboards and brand books build their application pages from this list.</T>}
      title={<T>Applications</T>}
    >
      <ol className={styles.applicationList}>
        {identity.applications.map((application, index) => (
          <li key={application.id}>
            <input aria-label={gt('Application {number} name', { number: index + 1 })} className={INPUT_CLASS} onChange={(event) => setApplication(index, { name: event.target.value })} value={application.name} />
            <StudioSelect ariaLabel={gt('Application {number} category', { number: index + 1 })} onValueChange={(category) => setApplication(index, { category: category as BrandApplication['category'] })} options={categories.map((value) => ({ label: gt(value), value }))} value={application.category} />
            <input aria-label={gt('Application {number} format', { number: index + 1 })} className={INPUT_CLASS} onChange={(event) => setApplication(index, { format: event.target.value })} value={application.format} />
            <textarea aria-label={gt('Application {number} intent', { number: index + 1 })} className={TEXTAREA_CLASS} onChange={(event) => setApplication(index, { description: event.target.value })} value={application.description} />
            <Button aria-label={gt('Remove {name}', { name: application.name })} onClick={() => update({ applications: identity.applications.filter((_, itemIndex) => itemIndex !== index) })} size='icon-xs' type='button' variant='ghost'><Trash2 aria-hidden='true' /></Button>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function ReferenceSheet({ identity, update }: { identity: BrandIdentity; update: BrandIdentityUpdate }) {
  const gt = useGT();
  const allAssets = [...identity.assets, ...identity.proofAssets];
  const updateReference = (referenceId: string, patch: Partial<BrandReference>) => update({
    references: identity.references.map((reference) => (reference.id === referenceId ? { ...reference, ...patch } : reference)),
  });
  return (
    <Panel description={<T>Categorized research records define the visual world. Captures remain research-only unless their redistribution status explicitly permits bundling.</T>} title={<T>Reference contact sheet</T>}>
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
  );
}

export function DirectionSection({ identity, update }: { identity: BrandIdentity; update: BrandIdentityUpdate }) {
  const gt = useGT();
  const dossier = (patch: Partial<BrandDossier>) => update({ dossier: { ...identity.dossier, ...patch } });
  const allAssets = [...identity.assets, ...identity.proofAssets];
  const primaryReference = identity.references
    .map((reference) => (reference.assetId ? allAssets.find((asset) => asset.id === reference.assetId) : undefined))
    .find((asset): asset is BrandAsset => Boolean(asset));
  const display = brandTypographyRole(identity, 'Display');
  return (
    <div className={styles.sectionStack}>
      <section className='brand-direction-editorial'>
        <div className='brand-direction-editorial-copy'>
          <span><T>Identity direction</T></span>
          <h2 style={{ fontFamily: brandTypographyFamily(identity, 'Display'), fontWeight: display.weight }}>{identity.tagline}</h2>
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
              <textarea className={TEXTAREA_CLASS} onChange={(event) => dossier({ [field.id]: event.target.value })} value={identity.dossier[field.id]} />
            </Field>
          ))}
          <ListField label={<T>Application recipes · one per line</T>} onChange={(applications) => dossier({ applications })} values={identity.dossier.applications} />
          <ListField label={<T>Rendering recipe · one step per line</T>} onChange={(renderingRecipe) => dossier({ renderingRecipe })} values={identity.dossier.renderingRecipe} />
          <ListField label={<T>Do not rules · one per line</T>} onChange={(prohibited) => dossier({ prohibited })} values={identity.dossier.prohibited} />
        </div>
      </Panel>
      <ApplicationsEditor identity={identity} update={update} />
      <ReferenceSheet identity={identity} update={update} />
    </div>
  );
}
