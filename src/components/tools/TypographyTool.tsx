'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { T, useGT } from 'gt-next';
import { RotateCcw } from '@/components/ui/SolidIcons';
import { LabInspectorSection, LabPanelHeading } from '@/components/LabWorkspace';
import StudioSelect from '@/components/ui/StudioSelect';
import { ToolShell } from '@/components/tools/ToolShell';
import {
  TEXTAREA_CLASS,
  Field,
  RangeField,
  SegmentedChoice,
  UploadField,
} from '@/components/tools/ToolFields';
import { useStudioDraft } from '@/hooks/usePersistentState';
import {
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandFontAsset,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import { hexToOklch } from '@/lib/color';
import { blobToDataUrl } from '@/lib/download';
import type { StudioTool } from '@/lib/studioCatalog';
import {
  capVisibleFontWeight,
  clampTypographyPreviewSize,
  MAX_VISIBLE_FONT_WEIGHT,
  measureTypingSample,
  TYPOGRAPHY_PREVIEW_DEFAULT_SIZES,
  TYPOGRAPHY_PREVIEW_MAX_SIZES,
} from '@/lib/typography';
import {
  parseSourceObject,
  sourceNumber,
  sourceObjectArray,
  sourceString,
  stringifySource,
} from '@/lib/sourceCode';

function fontFormatFromFileName(fileName: string): BrandFontAsset['format'] {
  const extension = fileName.split('.').pop()?.toLocaleLowerCase();
  const formats: Partial<Record<string, BrandFontAsset['format']>> = {
    otf: 'opentype',
    ttf: 'truetype',
    woff: 'woff',
    woff2: 'woff2',
  };
  return formats[extension ?? ''] ?? 'woff2';
}

function resolveTypographySelection(
  identity: BrandIdentity,
  fonts: BrandFontAsset[],
  selectedRole: BrandTypography['role'],
  previewSizes: Record<BrandTypography['role'], number>
) {
  const typography = brandTypographyRole(identity, selectedRole);
  const family = brandTypographyFamily(identity, selectedRole);
  const size = clampTypographyPreviewSize(
    selectedRole,
    previewSizes[selectedRole] ?? TYPOGRAPHY_PREVIEW_DEFAULT_SIZES[selectedRole]
  );
  const selectedFont = fonts.find(({ id }) => id === typography.fontId)
    ?? fonts.find((font) => font.family === family);
  const familyAssets = fonts.filter((font) => font.family === family);
  const minimumWeight = Math.max(
    100,
    selectedFont?.weightMin ?? Math.min(...familyAssets.map(({ weight }) => weight), 100)
  );
  const maximumWeight = Math.min(
    MAX_VISIBLE_FONT_WEIGHT,
    selectedFont?.weightMax
      ?? Math.max(...familyAssets.map(({ weight }) => weight), MAX_VISIBLE_FONT_WEIGHT)
  );
  const weightStep = Math.max(
    25,
    Math.round((maximumWeight - minimumWeight) / 3 / 25) * 25
  );
  const weights = Array.from(new Set([
    minimumWeight,
    minimumWeight + weightStep,
    minimumWeight + weightStep * 2,
    maximumWeight,
    capVisibleFontWeight(typography.weight ?? 400),
    ...familyAssets.map(({ weight }) => capVisibleFontWeight(weight)),
  ]))
    .filter((weight) => weight >= minimumWeight && weight <= maximumWeight)
    .sort((first, second) => first - second)
    .slice(0, 6);
  return {
    selectedFamily: family,
    selectedSize: size,
    selectedTypography: typography,
    specimenWeights: weights,
  };
}

function resolveTypographySystemPresentation(identity: BrandIdentity) {
  const display = brandTypographyRole(identity, 'Display');
  const body = brandTypographyRole(identity, 'Body');
  const accent = brandTypographyRole(identity, 'Accent');
  const code = brandTypographyRole(identity, 'Code');
  const primaryColor = identity.colors.find(({ id }) => id === 'emphasis')?.hex
    ?? identity.colors.find(({ name }) => name.toLocaleLowerCase() === 'primary')?.hex
    ?? identity.colors[0]?.hex
    ?? '#181818';
  const isRamp = identity.id === 'ramp';
  return {
    accent,
    accentFamily: brandTypographyFamily(identity, 'Accent'),
    accentWeight: capVisibleFontWeight(accent.weight ?? 400),
    body,
    bodyFamily: brandTypographyFamily(identity, 'Body'),
    bodyLineHeight: body.lineHeight ?? 1.5,
    bodyWeight: capVisibleFontWeight(body.weight ?? 400),
    code,
    codeFamily: brandTypographyFamily(identity, 'Code'),
    codeLabel: isRamp ? 'Operational data' : 'Command line',
    codeSample: isRamp ? '$24,680.00  /  Q3 2026  /  APPROVED' : `$ npx ${identity.id} build --brand`,
    codeUsesPrompt: !isRamp,
    codeWeight: capVisibleFontWeight(code.weight ?? 400),
    display,
    displayFamily: brandTypographyFamily(identity, 'Display'),
    displayLineHeight: display.lineHeight ?? 1,
    displayWeight: capVisibleFontWeight(display.weight ?? 400),
    primaryColor,
    primaryForeground: hexToOklch(primaryColor).lightness < 0.58 ? '#FFFFFF' : '#111111',
  };
}

/**
 * Live typing pace readout. It owns the 250ms clock so ticks re-render only this
 * footer, not the whole Typography tool.
 */
function TypingMeter({
  charactersEntered,
  inputAt,
  onReset,
  sampleText,
  startedAt,
}: {
  charactersEntered: number;
  inputAt: number | null;
  onReset: () => void;
  sampleText: string;
  startedAt: number | null;
}) {
  const gt = useGT();
  const [tickAt, setTickAt] = useState<number | null>(null);

  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setTickAt(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  // The latest of the last keystroke and the last tick, as one clock did before.
  const now = inputAt === null ? null : Math.max(inputAt, tickAt ?? inputAt);
  const elapsedMs = startedAt === null || now === null ? 0 : now - startedAt;
  const sample = measureTypingSample(sampleText, 0);
  const pace = measureTypingSample('x'.repeat(charactersEntered), elapsedMs);

  return (
    <footer className='typography-lab-typing-meter'>
      <span><strong>{pace.wordsPerMinute}</strong> wpm</span>
      <span><strong>{sample.words}</strong> words</span>
      <span><strong>{sample.characters}</strong> chars</span>
      <span><strong>{pace.seconds}</strong> sec</span>
      <button aria-label={gt('Clear specimen and restart typing meter')} onClick={onReset} title={gt('Clear and restart')} type='button'><RotateCcw aria-hidden='true' /></button>
    </footer>
  );
}

function TypographyTool({ identity, onIdentityChange, tool }: { identity: BrandIdentity; onIdentityChange: (identity: BrandIdentity) => void; tool: StudioTool }) {
  const gt = useGT();
  const fonts = brandFontAssets(identity);
  const [selectedRole, setSelectedRole] = useState<BrandTypography['role']>('Display');
  const [sampleText, setSampleText] = useStudioDraft(identity.id, tool.id, 'sample-text', identity.tagline);
  const [previewSizes, setPreviewSizes] = useStudioDraft<Record<BrandTypography['role'], number>>(
    identity.id,
    tool.id,
    'preview-sizes',
    TYPOGRAPHY_PREVIEW_DEFAULT_SIZES
  );
  const [previewAlign, setPreviewAlign] = useState<'left' | 'center'>('left');
  const [previewMode, setPreviewMode] = useState<'system' | 'type'>('type');
  const [typingCharactersEntered, setTypingCharactersEntered] = useState(0);
  const [typingStartedAt, setTypingStartedAt] = useState<number | null>(null);
  const [typingInputAt, setTypingInputAt] = useState<number | null>(null);
  const liveSpecimenRef = useRef<HTMLTextAreaElement>(null);
  const sourceCode = useMemo(() => stringifySource({ typography: identity.typography }), [identity.typography]);

  function applySourceCode(source: string) {
    const value = parseSourceObject(source);
    const typography = sourceObjectArray(value, 'typography');
    if (!typography) throw new TypeError('typography must be an array of typography roles.');
    const nextTypography = identity.typography.map((current) => {
      const next = typography.find((item) => sourceString(item, 'role', '') === current.role);
      return next ? {
        ...current,
        family: sourceString(next, 'family', current.family),
        fontId: sourceString(next, 'fontId', current.fontId ?? '') || undefined,
        letterSpacing: sourceNumber(next, 'letterSpacing', current.letterSpacing ?? 0),
        lineHeight: sourceNumber(next, 'lineHeight', current.lineHeight ?? 1.2),
        weight: sourceNumber(next, 'weight', current.weight ?? 400),
      } : current;
    });
    onIdentityChange({ ...identity, typography: nextTypography });
  }

  function updateRole(role: BrandTypography['role'], patch: Partial<BrandTypography>) {
    onIdentityChange({
      ...identity,
      typography: identity.typography.map((font) => font.role === role ? { ...font, ...patch } : font),
    });
  }

  function editSampleText(value: string) {
    const now = Date.now();
    if (typingStartedAt === null) setTypingStartedAt(now);
    setTypingCharactersEntered((current) => current + Math.max(0, Array.from(value).length - Array.from(sampleText).length));
    setTypingInputAt(now);
    setSampleText(value);
  }

  function resetTypingSession() {
    setSampleText('');
    setTypingCharactersEntered(0);
    setTypingStartedAt(null);
    setTypingInputAt(null);
  }

  async function loadFont(file: File) {
    const family = file.name.replace(/\.(otf|ttf|woff2?)$/i, '').replace(/[-_]+/g, ' ');
    const nextFont: BrandFontAsset = {
      family,
      fileName: file.name,
      format: fontFormatFromFileName(file.name),
      id: `font-${crypto.randomUUID()}`,
      label: family,
      path: await blobToDataUrl(file),
      style: file.name.toLocaleLowerCase().includes('italic') ? 'italic' : 'normal',
      weight: file.name.toLocaleLowerCase().includes('bold') ? 700 : 400,
    };
    onIdentityChange({ ...identity, fonts: [...fonts, nextFont] });
  }

  const {
    selectedFamily,
    selectedSize,
    selectedTypography,
    specimenWeights,
  } = resolveTypographySelection(
    identity,
    fonts,
    selectedRole,
    previewSizes
  );

  useEffect(() => {
    const specimen = liveSpecimenRef.current;
    if (!specimen || previewMode !== 'type') return;
    specimen.style.height = '0px';
    specimen.style.height = `${specimen.scrollHeight}px`;
  }, [previewMode, sampleText, selectedRole, selectedSize, selectedTypography.letterSpacing, selectedTypography.lineHeight, selectedTypography.weight]);

  const library = (
    <>
      <LabPanelHeading
        description={<T>Select a role to inspect it at production scale.</T>}
        title={<T>Typography roles</T>}
      />
      <div className='typography-lab-library'>
        {identity.typography.map((typography) => (
          <button aria-pressed={selectedRole === typography.role} key={typography.role} onClick={() => setSelectedRole(typography.role)} type='button'>
            <span>{typography.role}</span>
            <strong style={{ fontFamily: brandTypographyFamily(identity, typography.role), fontWeight: capVisibleFontWeight(typography.weight ?? 400) }}>Aa</strong>
            <small>{brandTypographyFamily(identity, typography.role)}</small>
          </button>
        ))}
      </div>
      <div className='p-4'><UploadField accept='.otf,.ttf,.woff,.woff2,font/*' label='Add font file to identity' onFile={loadFont} /></div>
    </>
  );

  const inspector = (
    <>
      <LabPanelHeading
        description={<T>Make live changes to the selected role and specimen.</T>}
        title={`${selectedRole} · ${selectedFamily}`}
      />
      <LabInspectorSection index='01' meta={selectedRole} title={<T>Typeface</T>}>
        <Field label={<T>Font family</T>}>
          <StudioSelect ariaLabel={`${selectedRole} font`} onValueChange={(fontId) => { const font = fonts.find((candidate) => candidate.id === fontId); if (font) updateRole(selectedRole, { family: font.family, fontId }); }} options={fonts.map((font) => ({ label: font.label, value: font.id }))} value={selectedTypography.fontId ?? fonts[0]?.id ?? ''} />
        </Field>
        <RangeField label={<T>Preview size</T>} max={TYPOGRAPHY_PREVIEW_MAX_SIZES[selectedRole]} min={10} onChange={(fontSize) => setPreviewSizes((current) => ({ ...current, [selectedRole]: fontSize }))} suffix='px' value={selectedSize} />
        <RangeField label={<T>Weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(weight) => updateRole(selectedRole, { weight })} step={25} value={selectedTypography.weight ?? 400} />
        <RangeField label={<T>Line height</T>} max={2} min={0.7} onChange={(lineHeight) => updateRole(selectedRole, { lineHeight })} step={0.02} value={selectedTypography.lineHeight ?? 1.2} />
        <RangeField label={<T>Tracking</T>} max={12} min={-8} onChange={(letterSpacing) => updateRole(selectedRole, { letterSpacing })} step={0.1} suffix='px' value={selectedTypography.letterSpacing ?? 0} />
      </LabInspectorSection>
      <LabInspectorSection index='02' meta='Live copy' title={<T>Specimen</T>}>
        <Field label={<T>Sample text</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => editSampleText(event.target.value)} value={sampleText} /></Field>
        <SegmentedChoice onChange={setPreviewAlign} options={[{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }]} value={previewAlign} />
      </LabInspectorSection>
      <LabInspectorSection index='03' meta={selectedTypography.usage} title={<T>Role guidance</T>}>
        <p className='lab-section-description'>{selectedTypography.usage}</p>
      </LabInspectorSection>
    </>
  );

  const {
    accent,
    accentFamily,
    accentWeight,
    body,
    bodyFamily,
    bodyLineHeight,
    bodyWeight,
    code,
    codeFamily,
    codeLabel,
    codeSample,
    codeUsesPrompt,
    codeWeight,
    display,
    displayFamily,
    displayLineHeight,
    displayWeight,
    primaryColor,
    primaryForeground,
  } = resolveTypographySystemPresentation(identity);

  return (
    <ToolShell inspector={inspector} library={library} sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('Typography source') }} tool={tool}>
      <div className='typography-lab-stage'>
        <div className='typography-lab-toolbar'>
          <div><span><T>Live specimen</T></span><strong>{selectedRole} / {selectedFamily}</strong></div>
          <div className='color-lab-segmented'>
            {(['type', 'system'] as const).map((mode) => <button aria-pressed={previewMode === mode} key={mode} onClick={() => setPreviewMode(mode)} type='button'>{mode}</button>)}
          </div>
        </div>
        {previewMode === 'type' ? (
          <div className='typography-lab-focus'>
            <article data-align={previewAlign}>
              <div><span>{selectedRole}</span><code>{selectedFamily} · {selectedTypography.weight ?? 400} / {selectedTypography.lineHeight ?? 1.2}</code></div>
              <textarea
                aria-label={gt('{role} live type specimen', { role: selectedRole })}
                className='typography-lab-live-input'
                onChange={(event) => editSampleText(event.target.value)}
                placeholder={gt('Type here to test the family…')}
                ref={liveSpecimenRef}
                style={{
                  fontFamily: selectedFamily,
                  fontSize: `${selectedSize}px`,
                  fontWeight: capVisibleFontWeight(selectedTypography.weight ?? 400),
                  letterSpacing: `${selectedTypography.letterSpacing ?? 0}px`,
                  lineHeight: selectedTypography.lineHeight ?? 1.2,
                }}
                value={sampleText}
              />
              <section className='typography-lab-role-lines' aria-label={gt('Typography role specimens')}>
                {identity.typography.map((typography) => (
                  <label data-active={selectedRole === typography.role} key={typography.role}>
                    <span><strong>{typography.role}</strong><code>{brandTypographyFamily(identity, typography.role)}</code></span>
                    <input
                      aria-label={gt('{role} editable specimen', { role: typography.role })}
                      onChange={(event) => editSampleText(event.target.value)}
                      onFocus={() => setSelectedRole(typography.role)}
                      style={{
                        fontFamily: brandTypographyFamily(identity, typography.role),
                        fontStyle: fonts.find(({ id }) => id === typography.fontId)?.style ?? 'normal',
                        fontWeight: capVisibleFontWeight(typography.weight ?? 400),
                      }}
                      value={sampleText}
                    />
                  </label>
                ))}
              </section>
              <section className='typography-lab-weight-lines' aria-label={gt('Font weight specimens')}>
                {specimenWeights.map((weight) => (
                  <div data-active={capVisibleFontWeight(selectedTypography.weight ?? 400) === weight} key={weight}>
                    <button onClick={() => updateRole(selectedRole, { weight })} type='button'>
                      <span>{weight}</span>
                      <small>{weight < 350 ? 'Light' : weight < 475 ? 'Regular' : 'Medium'}</small>
                    </button>
                    <input
                      aria-label={gt('{weight} weight editable specimen', { weight })}
                      onChange={(event) => editSampleText(event.target.value)}
                      onFocus={() => updateRole(selectedRole, { weight })}
                      style={{ fontFamily: selectedFamily, fontWeight: weight }}
                      value={sampleText}
                    />
                  </div>
                ))}
              </section>
              <TypingMeter
                charactersEntered={typingCharactersEntered}
                inputAt={typingInputAt}
                onReset={resetTypingSession}
                sampleText={sampleText}
                startedAt={typingStartedAt}
              />
            </article>
          </div>
        ) : (
      <div className='flex min-h-full items-center p-4 sm:p-7 xl:p-10'>
        <article className='mx-auto w-full max-w-[1480px] overflow-hidden bg-background/90 smooth-shadow-ring-xl backdrop-blur-sm'>
          <section
            className='px-5 pb-10 pt-8 sm:px-8 sm:pb-12 sm:pt-10 lg:px-12 lg:pb-14 lg:pt-12'
            style={{ backgroundColor: primaryColor, color: primaryForeground }}
          >
            <div className='flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] opacity-65'>
              <p>Display / {displayFamily}</p>
              <p className='flex gap-4 tabular-nums'>
                <span>Wt {displayWeight}</span>
                <span>Lh {displayLineHeight.toFixed(2)}</span>
                <span>Tr {display.letterSpacing ?? 0}</span>
              </p>
            </div>
            <h2
              className='mt-7 max-w-[18ch] text-balance text-[clamp(2.2rem,4vw,2.75rem)] text-current'
              style={{
                fontFamily: displayFamily,
                fontWeight: displayWeight,
                letterSpacing: `${display.letterSpacing}px`,
                lineHeight: Math.min(displayLineHeight, 1.02),
              }}
            >
              {identity.tagline}
            </h2>
            <p
              className='mt-7 text-[clamp(1rem,1.55vw,1.35rem)] text-current opacity-70'
              style={{
                fontFamily: accentFamily,
                fontWeight: accentWeight,
                letterSpacing: `${accent.letterSpacing}px`,
                lineHeight: accent.lineHeight,
              }}
            >
              {identity.greetings.join('  ·  ')}
            </p>
          </section>

          <div className='grid border-t border-border/80 lg:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.75fr)]'>
            <section className='flex min-h-[20rem] flex-col justify-between p-5 sm:p-8 lg:border-r lg:border-border/80 lg:p-10'>
              <div>
                <div className='flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground'>
                  <p>Body / {bodyFamily}</p>
                  <p className='tabular-nums'>Wt {bodyWeight} / {bodyLineHeight.toFixed(2)}</p>
                </div>
                <p
                  className='mt-7 max-w-[39ch] text-[clamp(1.2rem,2vw,1.75rem)] text-foreground/80'
                  style={{
                    fontFamily: bodyFamily,
                    fontWeight: bodyWeight,
                    letterSpacing: `${body.letterSpacing}px`,
                    lineHeight: bodyLineHeight,
                  }}
                >
                  {identity.positioning}
                </p>
              </div>
              <div
                className='mt-10 grid gap-3 border-t border-border/70 pt-5 text-sm text-muted-foreground sm:grid-cols-[1fr_auto] sm:items-end'
                style={{ fontFamily: bodyFamily, fontWeight: bodyWeight }}
              >
                <p className='break-words tracking-[0.08em]'>Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm</p>
                <p className='tabular-nums tracking-[0.12em]'>0123456789</p>
              </div>
            </section>

            <div className='grid border-t border-border/80 lg:border-t-0'>
              <section className='p-5 sm:p-8 lg:p-10'>
                <div className='flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground'>
                  <p>Code / {codeFamily}</p>
                  <p className='tabular-nums'>Wt {codeWeight}</p>
                </div>
                <div
                  className='mt-6 bg-foreground p-5 text-background shadow-[inset_0_0_0_1px_rgba(127,127,127,0.2)] sm:p-6'
                  style={{
                    fontFamily: codeFamily,
                    fontWeight: codeWeight,
                    letterSpacing: `${code.letterSpacing}px`,
                    lineHeight: code.lineHeight,
                  }}
                >
                  <p className='text-[11px] uppercase tracking-[0.14em] opacity-55'>{codeLabel}</p>
                  <p className='studio-scroll-area mt-5 overflow-x-auto whitespace-nowrap text-[clamp(0.8rem,1.2vw,1rem)]'>
                    {codeUsesPrompt ? <><span className='mr-3 opacity-45'>$</span>{codeSample.slice(2)}</> : codeSample}
                  </p>
                </div>
              </section>
              <section className='grid grid-cols-[auto_1fr] items-center gap-5 border-t border-border/80 p-5 sm:gap-8 sm:p-8 lg:p-10'>
                <p
                  className='text-[clamp(2.2rem,4vw,2.75rem)] text-foreground'
                  style={{
                    fontFamily: accentFamily,
                    fontWeight: accentWeight,
                    letterSpacing: `${accent.letterSpacing}px`,
                    lineHeight: 0.8,
                  }}
                >
                  Aa
                </p>
                <div className='min-w-0'>
                  <p className='text-[11px] uppercase tracking-[0.16em] text-muted-foreground'>Accent</p>
                  <p className='mt-2 truncate text-sm text-foreground'>{accentFamily}</p>
                  <p className='mt-1 text-xs text-muted-foreground'>{accent.usage}</p>
                </div>
              </section>
            </div>
          </div>
        </article>
      </div>
        )}
      </div>
    </ToolShell>
  );
}

export default TypographyTool;
