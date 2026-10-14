'use client';

import { useState } from 'react';
import { T, useGT } from 'gt-next';
import { Plus, Trash2 } from '@/components/ui/SolidIcons';

import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
import {
  ControlSection,
  Field,
  INPUT_CLASS,
  RangeField,
  SegmentedChoice,
  TEXTAREA_CLASS,
  UploadField,
} from '@/components/tools/ToolFields';
import type { BrandIdentity } from '@/lib/brandIdentity';
import type { CanvasDocument, CanvasElement } from '@/lib/canvasDocument';
import {
  activeCodeTab,
  dataNumber,
  dataString,
  elementComponent,
  expressionAsset,
  expressionFormats,
  expressionState,
  pageElements,
  pageSettings,
  readCodeTabs,
  readLockupPartners,
  setPageNotes,
  slotElement,
  withAssets,
  type ExpressionFontRole,
  type ExpressionToolKind,
  type LockupPartner,
} from '@/lib/expressionModel';
import { setLayerAsset, setUploadedFont, updateExpressionLayer } from '@/lib/expressionOperations';
import { hashString, setCodeTab, setSlideItems, slideItems } from '@/lib/expressionSource';
import { CODE_LANGUAGES } from '@/lib/expressionSvg';
import {
  applyExpressionLayout,
  expressionFont,
  expressionLayouts,
  expressionPartnerOptions,
  setExpressionFormat,
  setPageSurface,
} from '@/lib/expressionTemplates';
import {
  addCodeTab,
  addLockupPartner,
  choosePartner,
  legacySurfaceValue,
  mediaSourceValue,
  partnerFontOptions,
  removeCodeTab,
  removeLockupPartner,
  setBackgroundImage,
  setCodeLanguage,
  setHeadlinePartnerFont,
  setLegacySurface,
  setLockupPartner,
  setMediaSource,
  defaultMediaDevice,
  type LegacySurface,
} from '@/lib/expressionToolOperations';
import { templateBackgroundOptions } from '@/lib/templateAssets';
import { MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';
import type { ExpressionCommit } from './useExpressionDocument';
import { colorRoleOptions, formatLineList, measureImageAspect, parseLineList, readFileAsAsset } from './expressionEditorUtils';
import styles from './ExpressionEditor.module.css';

type SectionProps = {
  activePageId: string;
  commit: ExpressionCommit;
  document: CanvasDocument;
  identity: BrandIdentity;
  kind: ExpressionToolKind;
  onResetTemplate: () => void;
};

function headlineOf(document: CanvasDocument, pageId: string): CanvasElement | null {
  return slotElement(document, pageId, 'headline') ?? slotElement(document, pageId, 'title');
}

function roleOptions(identity: BrandIdentity) {
  return identity.typography.map((font) => ({ label: `${font.role} · ${font.family}`, value: font.role }));
}

/** Headline copy plus its type role and weight, under the labels earlier versions used. */
function HeadlineFields({ commit, document, identity, labels, pageId }: Pick<SectionProps, 'commit' | 'document' | 'identity'> & {
  labels: { role: string; roleAria: string; text: string; textAria?: string; weight: string };
  pageId: string;
}) {
  const gt = useGT();
  const headline = headlineOf(document, pageId);
  if (!headline?.textStyle) return null;
  const edit = (input: Parameters<typeof updateExpressionLayer>[2], key: string) => commit(
    (current) => updateExpressionLayer(current, headline.id, input, identity),
    { coalesce: `${headline.id}:${key}`, label: gt('Edit headline') }
  );
  return (
    <>
      <Field label={gt(labels.text)}>
        <textarea aria-label={labels.textAria ? gt(labels.textAria) : undefined} className={TEXTAREA_CLASS} onChange={(event) => edit({ content: event.target.value }, 'content')} value={headline.content ?? ''} />
      </Field>
      <Field label={gt(labels.role)}>
        <StudioSelect ariaLabel={labels.roleAria} onValueChange={(value) => edit({ fontRole: value as ExpressionFontRole }, 'role')} options={roleOptions(identity)} value={headline.textStyle.fontRole ?? 'Display'} />
      </Field>
      <RangeField label={gt(labels.weight)} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(value) => edit({ fontWeight: value }, 'weight')} step={50} value={headline.textStyle.fontWeight} />
    </>
  );
}

function BackgroundImageFields({ commit, document, identity, pageId, uploadLabel }: Pick<SectionProps, 'commit' | 'document' | 'identity'> & { pageId: string; uploadLabel: string }) {
  const gt = useGT();
  const options = templateBackgroundOptions(identity);
  const current = slotElement(document, pageId, 'background-image');
  const value = current ? dataString(current, 'libraryAssetId') : '';
  return (
    <>
      <UploadField accept='image/*' fileName={current && !value ? current.name : undefined} label={uploadLabel} onFile={(file) => {
        void readFileAsAsset(file).then(({ name, url }) => commit((doc) => setBackgroundImage(doc, pageId, { name, type: 'upload', url }, identity), { label: gt('Background image') }));
      }} />
      {options.length > 0 ? (
        <Field label={<T>Brand background asset</T>}>
          <StudioSelect
            ariaLabel='Brand background asset'
            onValueChange={(next) => commit((doc) => setBackgroundImage(doc, pageId, next ? { assetId: next, type: 'library' } : null, identity), { label: gt('Background image') })}
            options={[{ label: gt('No library background'), value: '' }, ...options.map((asset) => ({ label: asset.label, value: asset.id }))]}
            value={value}
          />
        </Field>
      ) : null}
      {current ? (
        <RangeField label={<T>Background image opacity</T>} max={100} min={0} onChange={(opacity) => commit((doc) => updateExpressionLayer(doc, current.id, { opacity: opacity / 100 }, identity), { coalesce: `${current.id}:opacity`, label: gt('Background opacity') })} suffix='%' value={Math.round(current.style.opacity * 100)} />
      ) : null}
    </>
  );
}

function LegacySurfaceField({ commit, document, identity, pageId }: Pick<SectionProps, 'commit' | 'document' | 'identity'> & { pageId: string }) {
  const gt = useGT();
  return (
    <SegmentedChoice<LegacySurface>
      ariaLabel='Surface texture'
      onChange={(value) => commit((doc) => setLegacySurface(doc, pageId, value, identity), { label: gt('Surface') })}
      options={[
        { label: 'Base white', value: 'white' },
        { label: 'Base dark', value: 'dark' },
        { label: 'Grid', value: 'grid' },
        { label: 'Noise', value: 'noise' },
      ]}
      value={legacySurfaceValue(document, pageId)}
    />
  );
}

// OpenGraph ------------------------------------------------------------------

function OpenGraphContent(props: SectionProps) {
  const gt = useGT();
  const { activePageId: pageId, commit, document, identity } = props;
  const media = slotElement(document, pageId, 'media');
  const logo = slotElement(document, pageId, 'logo');
  const headline = headlineOf(document, pageId);
  const library = templateBackgroundOptions(identity).filter((asset) => identity.id !== 'ramp' || asset.tags?.includes('source-native') || asset.id === 'library-editorial');
  const logos = identity.assets.filter(({ type }) => type === 'logo' || type === 'icon');
  const surface = pageSettings(document, pageId).surface;
  return (
    <>
      <ControlSection title={<T>Content</T>}>
        <HeadlineFields commit={commit} document={document} identity={identity} labels={{ role: 'Typography role', roleAria: 'OpenGraph typography role', text: 'Headline', weight: 'Font weight' }} pageId={pageId} />
      </ControlSection>
      <ControlSection title={<T>Surface</T>}>
        <SegmentedChoice
          ariaLabel='OpenGraph surface'
          onChange={(value) => commit((doc) => setPageSurface(doc, pageId, value, identity), { label: gt('Surface') })}
          options={[{ label: 'Base white', value: 'paper' }, { label: 'Base dark', value: 'ink' }]}
          value={surface === 'paper' || surface === 'ink' ? surface : 'ink'}
        />
        {media ? (
          <>
            <UploadField accept='image/*' fileName={media.kind === 'image' && !dataString(media, 'libraryAssetId') ? media.name : undefined} label='Add supporting image' onFile={(file) => {
              void readFileAsAsset(file).then(({ name, url }) => commit((doc) => setMediaSource(doc, pageId, { name, type: 'upload', url }, identity), { label: gt('Supporting image') }));
            }} />
            <Field label={<T>Identity evidence</T>}>
              <StudioSelect
                ariaLabel='Identity evidence'
                onValueChange={(value) => commit((doc) => setMediaSource(doc, pageId, value === 'none' ? { device: defaultMediaDevice(identity), type: 'device' } : { assetId: value, type: 'library' }, identity), { label: gt('Supporting image') })}
                options={[{ label: gt('Brand device'), value: 'none' }, ...library.map((asset) => ({ label: asset.label, value: asset.id })), ...(mediaSourceValue(document, pageId) === 'upload' ? [{ label: gt('Uploaded image'), value: 'upload' }] : [])]}
                value={mediaSourceValue(document, pageId)}
              />
            </Field>
          </>
        ) : null}
        {logo ? (
          <>
            <UploadField accept='image/*,.svg' label='Replace logo' onFile={(file) => {
              void readFileAsAsset(file).then(({ name, url }) => commit((doc) => setLayerAsset(doc, logo.id, { name, prefix: 'upload', source: url }), { label: gt('Replace logo') }));
            }} />
            {logos.length > 0 ? (
              <Field label={<T>Brand logo asset</T>}>
                <StudioSelect
                  ariaLabel='Brand logo asset'
                  onValueChange={(value) => {
                    const asset = logos.find(({ id }) => id === value);
                    if (asset) commit((doc) => setLayerAsset(doc, logo.id, { libraryAssetId: asset.id, name: asset.label, prefix: 'logo', source: asset.path }), { label: gt('Replace logo') });
                  }}
                  options={[{ label: gt('Uploaded or custom'), value: '' }, ...logos.map((asset) => ({ label: asset.label, value: asset.id }))]}
                  value={dataString(logo, 'libraryAssetId')}
                />
              </Field>
            ) : null}
          </>
        ) : null}
        {headline ? (
          <UploadField accept='.otf,.ttf,.woff,.woff2,font/*' fileName={headline.textStyle?.fontId.startsWith('font:upload-') ? gt('Custom font loaded') : undefined} label='Add font file' onFile={(file) => {
            void readFileAsAsset(file).then((asset) => commit((doc) => setUploadedFont(doc, headline.id, asset), { label: gt('Upload font') }));
          }} />
        ) : null}
      </ControlSection>
    </>
  );
}

// Terminal -------------------------------------------------------------------

function TerminalContent(props: SectionProps) {
  const gt = useGT();
  const { activePageId: pageId, commit, document, identity } = props;
  const title = slotElement(document, pageId, 'title');
  const code = pageElements(document, pageId).find((element) => elementComponent(element) === 'code') ?? null;
  const tab = code ? activeCodeTab(code) : null;
  const tabs = code ? readCodeTabs(code) : [];
  const background = slotElement(document, pageId, 'background-image');
  const [linesDraft, setLinesDraft] = useState<string | null>(null);
  const assets = [...identity.assets, ...identity.proofAssets].filter((asset) => !asset.path.toLowerCase().endsWith('.pdf'));
  const editTab = (patch: Parameters<typeof setCodeTab>[3], key: string) => {
    if (code && tab) commit((doc) => setCodeTab(doc, code.id, tab.id, patch), { coalesce: `${code.id}:${tab.id}:${key}`, label: gt('Edit code') });
  };
  const editLayer = (element: CanvasElement, input: Parameters<typeof updateExpressionLayer>[2], key: string) => commit(
    (doc) => updateExpressionLayer(doc, element.id, input, identity),
    { coalesce: `${element.id}:${key}`, label: gt('Edit {name}', { name: element.name }) }
  );
  return (
    <>
      <ControlSection title={<T>Content</T>}>
        {title ? (
          <Field label={<T>Card title</T>}>
            <input className={INPUT_CLASS} onChange={(event) => editLayer(title, { content: event.target.value }, 'content')} value={title.content ?? ''} />
          </Field>
        ) : null}
        {tab ? (
          <Field label={<T>Language</T>}>
            <StudioSelect ariaLabel='Language' onValueChange={(value) => code && commit((doc) => setCodeLanguage(doc, code.id, tab.id, value), { label: gt('Language') })} options={CODE_LANGUAGES.map(({ id, label }) => ({ label, value: id }))} value={tab.language} />
          </Field>
        ) : null}
      </ControlSection>
      {code && tab ? (
        <ControlSection title={<T>Source</T>}>
          <div aria-label={gt('Code tabs')} className={styles.tabRow} role='group'>
            {tabs.map((item) => (
              <Button aria-label={gt('Show tab {name}', { name: item.name })} aria-pressed={item.id === tab.id} key={item.id} onClick={() => commit((doc) => updateExpressionLayer(doc, code.id, { data: { activeTab: item.id } }, identity), { label: gt('Show tab') })} size='sm' type='button' variant={item.id === tab.id ? 'default' : 'outline'}>
                {item.name}
              </Button>
            ))}
            <Button aria-label={gt('Add file tab')} onClick={() => commit((doc) => addCodeTab(doc, code.id, { language: tab.language, name: `file-${tabs.length + 1}` }).document, { label: gt('Add tab') })} size='icon-sm' type='button' variant='ghost'>
              <Plus aria-hidden='true' />
            </Button>
            <Button aria-label={gt('Remove tab {name}', { name: tab.name })} disabled={tabs.length <= 1} onClick={() => commit((doc) => removeCodeTab(doc, code.id, tab.id), { label: gt('Remove tab') })} size='icon-sm' type='button' variant='ghost'>
              <Trash2 aria-hidden='true' />
            </Button>
          </div>
          <Field label={<T>Tab name</T>}>
            <input aria-label={gt('Tab name')} className={INPUT_CLASS} onChange={(event) => editTab({ name: event.target.value }, 'name')} value={tab.name} />
          </Field>
          <textarea aria-label='Terminal source code' className={`${TEXTAREA_CLASS} min-h-56 font-mono`} onChange={(event) => editTab({ code: event.target.value }, 'code')} spellCheck={false} value={tab.code} />
          <Field label={<T>Highlighted lines · e.g. 2, 4-6</T>}>
            <input aria-label={gt('Highlighted lines')} className={INPUT_CLASS} onBlur={() => setLinesDraft(null)} onChange={(event) => { setLinesDraft(event.target.value); editTab({ highlight: parseLineList(event.target.value) }, 'highlight'); }} value={linesDraft ?? formatLineList(tab.highlight)} />
          </Field>
        </ControlSection>
      ) : null}
      <ControlSection title={<T>Typography</T>}>
        {title?.textStyle ? (
          <>
            <Field label={<T>Title font</T>}>
              <StudioSelect ariaLabel='Terminal title font' onValueChange={(value) => editLayer(title, { fontRole: value as ExpressionFontRole }, 'role')} options={roleOptions(identity)} value={title.textStyle.fontRole ?? 'Display'} />
            </Field>
            <RangeField label={<T>Title weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(value) => editLayer(title, { fontWeight: value }, 'weight')} step={50} value={title.textStyle.fontWeight} />
          </>
        ) : null}
        {code?.textStyle ? (
          <>
            <Field label={<T>Code font</T>}>
              <StudioSelect ariaLabel='Terminal code font' onValueChange={(value) => editLayer(code, { fontRole: value as ExpressionFontRole }, 'role')} options={roleOptions(identity)} value={code.textStyle.fontRole ?? 'Code'} />
            </Field>
            <RangeField label={<T>Code weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(value) => editLayer(code, { fontWeight: value }, 'weight')} step={50} value={code.textStyle.fontWeight} />
          </>
        ) : null}
      </ControlSection>
      <ControlSection title={<T>Brand asset</T>}>
        <Field label={<T>Card background</T>}>
          <StudioSelect
            ariaLabel='Terminal card background'
            onValueChange={(value) => commit((doc) => setBackgroundImage(doc, pageId, value === 'none' ? null : { assetId: value, type: 'library' }, identity, 0.14), { label: gt('Card background') })}
            options={[{ label: 'None', value: 'none' }, ...assets.map((asset) => ({ label: `${asset.label} · ${asset.type}`, value: asset.id }))]}
            value={background ? dataString(background, 'libraryAssetId') || 'none' : 'none'}
          />
        </Field>
        {background ? (
          <RangeField label={<T>Asset opacity</T>} max={100} min={0} onChange={(value) => editLayer(background, { opacity: value / 100 }, 'opacity')} value={Math.round(background.style.opacity * 100)} />
        ) : null}
      </ControlSection>
    </>
  );
}

// Partnership -----------------------------------------------------------------

function PartnerRow({ commit, identity, index, lockup, partner }: Pick<SectionProps, 'commit' | 'identity'> & { index: number; lockup: CanvasElement; partner: LockupPartner }) {
  const gt = useGT();
  const options = expressionPartnerOptions(identity);
  return (
    <div className={styles.partnerRow}>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-xs font-semibold'>{gt('Partner {number}', { number: index + 1 })}</span>
        <Button aria-label={gt('Remove partner {name}', { name: partner.label })} onClick={() => commit((doc) => removeLockupPartner(doc, lockup.id, partner.id), { label: gt('Remove partner') })} size='icon-xs' type='button' variant='ghost'>
          <Trash2 aria-hidden='true' />
        </Button>
      </div>
      {partner.kind === 'logo' ? (
        <StudioSelect ariaLabel={`Partner ${index + 1} artwork`} onValueChange={(value) => commit((doc) => choosePartner(doc, lockup.id, partner.id, value, identity), { label: gt('Choose partner') })} options={options.map((option) => ({ label: option.label, value: option.id }))} value={partner.sourceId ?? ''} />
      ) : (
        <input aria-label={gt('Partner {number} name', { number: index + 1 })} className={INPUT_CLASS} onChange={(event) => commit((doc) => setLockupPartner(doc, lockup.id, partner.id, { label: event.target.value }), { coalesce: `${lockup.id}:${partner.id}:label`, label: gt('Partner name') })} value={partner.label} />
      )}
      <UploadField accept='image/*,.svg' label={`Upload partner ${index + 1} logo`} onFile={(file) => {
        void readFileAsAsset(file).then(async ({ name, url }) => {
          const aspect = await measureImageAspect(url, 2.6);
          const assetId = `upload:${hashString(url)}`;
          commit((doc) => setLockupPartner(withAssets(doc, [expressionAsset(assetId, name, url)]), lockup.id, partner.id, { aspect, assetId, kind: 'logo', label: name.replace(/\.[^.]+$/, ''), sourceId: undefined }), { label: gt('Upload partner logo') });
        });
      }} />
    </div>
  );
}

/** Headline control labels name the brand being edited. */
function headlineLabels(identity: BrandIdentity) {
  const brand = identity.shortName || identity.name;
  return { role: `${brand} headline font`, roleAria: `${brand} headline font`, text: 'Title', weight: `${brand} headline weight` };
}

function PartnershipContent(props: SectionProps) {
  const gt = useGT();
  const { activePageId: pageId, commit, document, identity } = props;
  const lockup = pageElements(document, pageId).find((element) => elementComponent(element) === 'lockup') ?? null;
  const partners = lockup ? readLockupPartners(lockup) : [];
  const primary = partners[1] ?? null;
  const headline = headlineOf(document, pageId);
  const fonts = primary ? partnerFontOptions(identity, primary.sourceId ?? '') : [];
  const partnerFontFamily = headline ? dataString(headline, 'partnerFontFamily') : '';
  const partnerFontWeight = headline ? dataNumber(headline, 'partnerFontWeight', 500) : 500;
  const fontValue = fonts.find(({ family }) => family === partnerFontFamily)?.id ?? (partnerFontFamily ? 'custom' : fonts[0]?.id ?? '');
  const setLockup = (data: Record<string, string | number>, key: string) => {
    if (lockup) commit((doc) => updateExpressionLayer(doc, lockup.id, { data }, identity), { coalesce: `${lockup.id}:${key}`, label: gt('Lockup') });
  };
  return (
    <>
      <ControlSection title={<T>Content</T>}>
        <HeadlineFields commit={commit} document={document} identity={identity} labels={headlineLabels(identity)} pageId={pageId} />
      </ControlSection>
      {lockup && primary ? (
        <ControlSection title={<T>Partner</T>}>
          <Field label={<T>Partner</T>}>
            <StudioSelect ariaLabel='Partner' onValueChange={(value) => commit((doc) => choosePartner(doc, lockup.id, primary.id, value, identity), { label: gt('Choose partner') })} options={expressionPartnerOptions(identity).map((option) => ({ label: option.label, value: option.id }))} value={primary.sourceId ?? ''} />
          </Field>
          <div className='flex flex-col gap-2 text-sm'>
            <span className='text-muted-foreground'><T>Partner treatment</T></span>
            <SegmentedChoice
              ariaLabel='Partner treatment'
              onChange={(value) => commit((doc) => {
                const font = expressionFont(identity, 'Display');
                return setLockupPartner(doc, lockup.id, primary.id, value === 'text'
                  ? { fontFamily: partnerFontFamily || font.family, fontAssetId: headline ? dataString(headline, 'partnerFontAssetId') || font.asset.id : font.asset.id, fontWeight: partnerFontWeight, kind: 'text' }
                  : { kind: 'logo' });
              }, { label: gt('Partner treatment') })}
              options={[{ label: 'Use logo', value: 'logo' }, { label: 'Write name', value: 'text' }]}
              value={primary.kind}
            />
          </div>
          {primary.kind === 'text' ? (
            <Field label={<T>Lockup name</T>}>
              <input className={INPUT_CLASS} onChange={(event) => commit((doc) => setLockupPartner(doc, lockup.id, primary.id, { label: event.target.value }), { coalesce: `${lockup.id}:name`, label: gt('Lockup name') })} value={primary.label} />
            </Field>
          ) : (
            <UploadField accept='image/*,.svg' label='Replace partner logo' onFile={(file) => {
              void readFileAsAsset(file).then(async ({ name, url }) => {
                const aspect = await measureImageAspect(url, 2.6);
                const assetId = `upload:${hashString(url)}`;
                commit((doc) => setLockupPartner(withAssets(doc, [expressionAsset(assetId, name, url)]), lockup.id, primary.id, { aspect, assetId, label: name.replace(/\.[^.]+$/, ''), sourceId: undefined }), { label: gt('Replace partner logo') });
              });
            }} />
          )}
          {headline ? (
            <>
              <Field label={<T>Partner headline font</T>}>
                <StudioSelect
                  ariaLabel='Partner headline font'
                  onValueChange={(value) => {
                    const font = fonts.find(({ id }) => id === value);
                    if (font) commit((doc) => setHeadlinePartnerFont(doc, headline.id, { family: font.family, id: font.id, path: font.path, weight: font.weight }), { label: gt('Partner font') });
                  }}
                  options={[...(fontValue === 'custom' ? [{ label: gt('Uploaded font'), value: 'custom' }] : []), ...fonts.map((font) => ({ label: font.label, value: font.id }))]}
                  value={fontValue}
                />
              </Field>
              <UploadField accept='.otf,.ttf,.woff,.woff2,font/*' label='Upload partner headline font' onFile={(file) => {
                void readFileAsAsset(file).then(({ name, url }) => commit((doc) => setHeadlinePartnerFont(doc, headline.id, { name, url, weight: partnerFontWeight }), { label: gt('Partner font') }));
              }} />
              <RangeField label={<T>Partner headline weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(value) => commit((doc) => updateExpressionLayer(doc, headline.id, { data: { partnerFontWeight: value } }, identity), { coalesce: `${headline.id}:partner-weight`, label: gt('Partner weight') })} step={50} value={partnerFontWeight} />
              <p className='text-xs leading-5 text-muted-foreground'>
                <T>Styles the partner name in the headline and in text-based lockups.</T>
              </p>
            </>
          ) : null}
          <RangeField label={<T>Lockup spacing</T>} max={160} min={0} onChange={(value) => setLockup({ gap: value }, 'gap')} suffix='px' value={dataNumber(lockup, 'gap', 24)} />
        </ControlSection>
      ) : null}
      {lockup ? (
        <ControlSection title={<T>Lockup</T>}>
          {partners.slice(2).map((partner, index) => (
            <PartnerRow commit={commit} identity={identity} index={index + 2} key={partner.id} lockup={lockup} partner={partner} />
          ))}
          <div className={styles.iconRow}>
            <Button onClick={() => commit((doc) => addLockupPartner(doc, lockup.id, identity).document, { label: gt('Add partner') })} size='sm' type='button' variant='outline'><Plus aria-hidden='true' /><T>Add partner</T></Button>
            <Button onClick={() => commit((doc) => addLockupPartner(doc, lockup.id, identity, { kind: 'text', label: 'Partner' }).document, { label: gt('Add partner') })} size='sm' type='button' variant='outline'><Plus aria-hidden='true' /><T>Add written partner</T></Button>
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <Field label={<T>Separator</T>}>
              <StudioSelect ariaLabel='Lockup separator' onValueChange={(value) => setLockup({ separator: value }, 'separator')} options={[{ label: '×', value: '×' }, { label: '+', value: '+' }, { label: '/', value: '/' }, { label: 'Rule', value: '|' }, { label: 'None', value: 'none' }]} value={dataString(lockup, 'separator', '×')} />
            </Field>
            <Field label={<T>Sizing</T>}>
              <StudioSelect ariaLabel='Lockup sizing' onValueChange={(value) => setLockup({ sizing: value }, 'sizing')} options={[{ label: 'Optical balance', value: 'optical' }, { label: 'Equal height', value: 'height' }, { label: 'Equal width', value: 'width' }]} value={dataString(lockup, 'sizing', 'optical')} />
            </Field>
            <Field label={<T>Alignment</T>}>
              <StudioSelect ariaLabel='Lockup alignment' onValueChange={(value) => setLockup({ justify: value }, 'justify')} options={[{ label: 'Start', value: 'start' }, { label: 'Center', value: 'center' }, { label: 'End', value: 'end' }]} value={dataString(lockup, 'justify', 'start')} />
            </Field>
            <Field label={<T>Vertical</T>}>
              <StudioSelect ariaLabel='Lockup vertical alignment' onValueChange={(value) => setLockup({ verticalAlign: value }, 'verticalAlign')} options={[{ label: 'Center', value: 'center' }, { label: 'Top', value: 'top' }, { label: 'Baseline', value: 'bottom' }]} value={dataString(lockup, 'verticalAlign', 'center')} />
            </Field>
          </div>
          <Field label={<T>Logo color</T>}>
            <StudioSelect ariaLabel='Lockup tone' onValueChange={(value) => setLockup({ tone: value }, 'tone')} options={[{ label: 'One color', value: 'mono' }, { label: 'Original colors', value: 'original' }]} value={dataString(lockup, 'tone', 'mono')} />
          </Field>
        </ControlSection>
      ) : null}
    </>
  );
}

// Blog and slides -------------------------------------------------------------

function BlogContent(props: SectionProps) {
  const { activePageId: pageId, commit, document, identity } = props;
  return (
    <>
      <ControlSection title={<T>Content</T>}>
        <HeadlineFields commit={commit} document={document} identity={identity} labels={{ role: 'Typography role', roleAria: 'Template typography role', text: 'Title', weight: 'Font weight' }} pageId={pageId} />
      </ControlSection>
      <ControlSection title={<T>Surface</T>}>
        <LegacySurfaceField commit={commit} document={document} identity={identity} pageId={pageId} />
        <BackgroundImageFields commit={commit} document={document} identity={identity} pageId={pageId} uploadLabel='Add background image' />
      </ControlSection>
    </>
  );
}

function SlidesContent(props: SectionProps) {
  const gt = useGT();
  const { activePageId: pageId, commit, document, identity } = props;
  const layout = pageSettings(document, pageId).layout;
  const items = slideItems(document, pageId);
  const page = document.pages[pageId]!;
  const [bodyDraft, setBodyDraft] = useState<string | null>(null);
  return (
    <>
      <ControlSection title={<T>Content</T>}>
        <HeadlineFields commit={commit} document={document} identity={identity} labels={{ role: 'Typography role', roleAria: 'Template typography role', text: 'Title', weight: 'Font weight' }} pageId={pageId} />
        <Field label={<T>Body or list · one item per line</T>}>
          <textarea
            className={TEXTAREA_CLASS}
            onBlur={() => setBodyDraft(null)}
            onChange={(event) => {
              setBodyDraft(event.target.value);
              const next = event.target.value.split('\n').map((item) => item.trim()).filter(Boolean);
              if (next.join('\n') !== items.join('\n')) commit((doc) => setSlideItems(doc, pageId, next, identity), { coalesce: `${pageId}:items`, label: gt('Slide list') });
            }}
            value={bodyDraft ?? items.join('\n')}
          />
        </Field>
        <Field label={<T>Speaker notes</T>}>
          <textarea aria-label={gt('Speaker notes')} className={TEXTAREA_CLASS} onChange={(event) => commit((doc) => setPageNotes(doc, pageId, event.target.value), { coalesce: `${pageId}:notes`, label: gt('Speaker notes') })} value={page.notes} />
        </Field>
      </ControlSection>
      <ControlSection title={<T>Slide library</T>}>
        <div className={styles.layoutGrid}>
          {expressionLayouts('slides').map((item) => (
            <button aria-label={gt('Slide layout {name}', { name: item.label })} aria-pressed={layout === item.id} className={styles.layoutButton} key={item.id} onClick={() => commit((doc) => applyExpressionLayout(doc, pageId, item.id, identity), { label: gt('Slide layout') })} type='button'>
              {item.label}
            </button>
          ))}
        </div>
      </ControlSection>
      <ControlSection title={<T>Surface</T>}>
        <LegacySurfaceField commit={commit} document={document} identity={identity} pageId={pageId} />
        <BackgroundImageFields commit={commit} document={document} identity={identity} pageId={pageId} uploadLabel='Add background image' />
      </ControlSection>
    </>
  );
}

export function ExpressionContentSections(props: SectionProps) {
  if (props.kind === 'opengraph') return <OpenGraphContent {...props} />;
  if (props.kind === 'terminal') return <TerminalContent {...props} />;
  if (props.kind === 'partnership') return <PartnershipContent {...props} />;
  if (props.kind === 'blog') return <BlogContent {...props} />;
  return <SlidesContent {...props} />;
}

export function CanvasSection(props: SectionProps) {
  const gt = useGT();
  const { activePageId: pageId, commit, document, identity, kind } = props;
  const state = expressionState(document);
  const settings = pageSettings(document, pageId);
  return (
    <ControlSection title={<T>Format and layout</T>}>
      <Field label={<T>Format</T>}>
        <StudioSelect ariaLabel='Format' onValueChange={(value) => commit((doc) => setExpressionFormat(doc, value, identity), { label: gt('Format') })} options={expressionFormats(kind).map((format) => ({ label: format.label, value: format.id }))} value={state.format} />
      </Field>
      {kind !== 'slides' ? (
        <div className={styles.layoutGrid} role='group' aria-label={gt('Layouts')}>
          {expressionLayouts(kind).map((layout) => (
            <button aria-label={gt('Layout {name}', { name: layout.label })} aria-pressed={settings.layout === layout.id} className={styles.layoutButton} key={layout.id} onClick={() => commit((doc) => applyExpressionLayout(doc, pageId, layout.id, identity), { label: gt('Layout') })} type='button'>
              {layout.label}
            </button>
          ))}
        </div>
      ) : null}
      <Field label={<T>Page surface</T>}>
        <StudioSelect ariaLabel='Page surface' onValueChange={(value) => { if (value !== 'custom') commit((doc) => setPageSurface(doc, pageId, value, identity), { label: gt('Surface') }); }} options={colorRoleOptions(identity, { custom: settings.surface.startsWith('#') ? settings.surface : undefined }).filter(({ value }) => value !== 'custom')} value={settings.surface} />
      </Field>
      <Button onClick={props.onResetTemplate} size='sm' type='button' variant='outline'>
        <T>Reset to brand template</T>
      </Button>
    </ControlSection>
  );
}
