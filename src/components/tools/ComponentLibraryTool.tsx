'use client';

import { T, useGT } from 'gt-next';
import ComponentLibraryPreview from '@/components/ComponentLibraryPreview';
import ComponentLibraryCatalog, { ComponentPatternIcon } from '@/components/ComponentLibraryCatalog';
import {
  COMPONENT_FAMILY_OPTIONS,
  COMPONENT_PATTERNS,
  componentBrandPalette,
  componentPreviewStyle,
  getFirstComponentPattern,
  type ComponentElevation,
  type ComponentFamily,
  type ComponentPalette,
  type ComponentPatternId,
} from '@/lib/componentLibrary';
import { LabPanelHeading } from '@/components/LabWorkspace';
import ColorControl from '@/components/ui/ColorControl';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import StudioSelect from '@/components/ui/StudioSelect';
import { ToolShell } from '@/components/tools/ToolShell';
import {
  INPUT_CLASS,
  TEXTAREA_CLASS,
  ControlSection,
  Field,
  RangeField,
} from '@/components/tools/ToolFields';
import { useStudioDraft } from '@/hooks/usePersistentState';
import {
  brandTypographyFamily,
  brandTypographyRole,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import { normalizeHexOrFallback } from '@/lib/color';
import type { StudioTool } from '@/lib/studioCatalog';
import { capVisibleFontWeight, MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';
import {
  parseSourceObject,
  sourceBoolean,
  sourceNumber,
  sourceObject,
  sourceString,
  stringifySource,
} from '@/lib/sourceCode';

function ComponentLibraryTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const brandPalette = componentBrandPalette(identity);
  const [family, setFamily] = useStudioDraft<ComponentFamily>(identity.id, tool.id, 'family', 'actions');
  const [pattern, setPattern] = useStudioDraft<ComponentPatternId>(
    identity.id,
    tool.id,
    'pattern',
    'buttons'
  );
  const [label, setLabel] = useStudioDraft(identity.id, tool.id, 'label', 'Get started');
  const [supportingCopy, setSupportingCopy] = useStudioDraft(
    identity.id,
    tool.id,
    'supporting-copy',
    identity.description
  );
  const [disabled, setDisabled] = useStudioDraft(identity.id, tool.id, 'disabled', false);
  const [radius, setRadius] = useStudioDraft(
    identity.id,
    tool.id,
    'radius',
    identity.style.borderRadius
  );
  const [density, setDensity] = useStudioDraft(
    identity.id,
    tool.id,
    'density',
    identity.style.density
  );
  const [useBrandDefaults, setUseBrandDefaults] = useStudioDraft(
    identity.id,
    tool.id,
    'use-brand-defaults',
    true
  );
  const [surface, setSurface] = useStudioDraft<'base' | 'soft' | 'inverse'>(
    identity.id,
    tool.id,
    'surface',
    'base'
  );
  const [size, setSize] = useStudioDraft<'sm' | 'default' | 'lg'>(
    identity.id,
    tool.id,
    'size',
    'default'
  );
  const [fontRole, setFontRole] = useStudioDraft<BrandTypography['role']>(identity.id, tool.id, 'font-role', 'Body');
  const [fontWeight, setFontWeight] = useStudioDraft(identity.id, tool.id, 'font-weight', brandTypographyRole(identity, 'Body').weight ?? 400);
  const [textScale, setTextScale] = useStudioDraft(identity.id, tool.id, 'text-scale', 100);
  const [letterSpacing, setLetterSpacing] = useStudioDraft(identity.id, tool.id, 'letter-spacing', 0);
  const [borderWidth, setBorderWidth] = useStudioDraft(identity.id, tool.id, 'border-width', 1);
  const [elevation, setElevation] = useStudioDraft<ComponentElevation>(identity.id, tool.id, 'elevation', 'soft');
  const [backgroundColor, setBackgroundColor] = useStudioDraft(identity.id, tool.id, 'color-background', brandPalette.background);
  const [surfaceColor, setSurfaceColor] = useStudioDraft(identity.id, tool.id, 'color-surface', brandPalette.surface);
  const [foregroundColor, setForegroundColor] = useStudioDraft(identity.id, tool.id, 'color-foreground', brandPalette.foreground);
  const [mutedColor, setMutedColor] = useStudioDraft(identity.id, tool.id, 'color-muted', brandPalette.muted);
  const [mutedForegroundColor, setMutedForegroundColor] = useStudioDraft(identity.id, tool.id, 'color-muted-foreground', brandPalette.mutedForeground);
  const [accentColor, setAccentColor] = useStudioDraft(identity.id, tool.id, 'color-accent', brandPalette.accent);
  const [accentForegroundColor, setAccentForegroundColor] = useStudioDraft(identity.id, tool.id, 'color-accent-foreground', brandPalette.accentForeground);
  const [borderColor, setBorderColor] = useStudioDraft(identity.id, tool.id, 'color-border', brandPalette.border);
  const [successColor, setSuccessColor] = useStudioDraft(identity.id, tool.id, 'color-success', brandPalette.success);
  const [dangerColor, setDangerColor] = useStudioDraft(identity.id, tool.id, 'color-danger', brandPalette.danger);
  const componentAssets = [...identity.assets, ...identity.proofAssets].filter((asset) => !asset.path.toLocaleLowerCase().endsWith('.pdf'));
  const [componentAssetId, setComponentAssetId] = useStudioDraft(identity.id, tool.id, 'asset-id', 'none');
  const [componentAssetOpacity, setComponentAssetOpacity] = useStudioDraft(identity.id, tool.id, 'asset-opacity', 10);
  const componentAsset = componentAssets.find(({ id }) => id === componentAssetId);
  const resolvedDensity = useBrandDefaults ? identity.style.density : density;
  const resolvedRadius = useBrandDefaults ? identity.style.borderRadius : radius;
  const resolvedFontRole = useBrandDefaults ? 'Body' : fontRole;
  const resolvedFontWeight = useBrandDefaults ? brandTypographyRole(identity, 'Body').weight ?? 400 : fontWeight;
  const customPalette: ComponentPalette = {
    accent: accentColor,
    accentForeground: accentForegroundColor,
    background: backgroundColor,
    border: borderColor,
    danger: dangerColor,
    foreground: foregroundColor,
    muted: mutedColor,
    mutedForeground: mutedForegroundColor,
    success: successColor,
    surface: surfaceColor,
  };
  const resolvedPalette = useBrandDefaults ? brandPalette : customPalette;
  const selectedPattern =
    COMPONENT_PATTERNS.some((item) => item.id === pattern && item.family === family)
      ? pattern
      : getFirstComponentPattern(family);
  const selectedPatternConfig =
    COMPONENT_PATTERNS.find((item) => item.id === selectedPattern) ?? COMPONENT_PATTERNS[0];

  function selectPattern(nextPattern: ComponentPatternId) {
    const nextPatternConfig = COMPONENT_PATTERNS.find((item) => item.id === nextPattern);
    if (!nextPatternConfig) return;
    setFamily(nextPatternConfig.family);
    setPattern(nextPattern);
  }

  function updateManualColor(setter: (value: string) => void, value: string) {
    setter(value);
    setUseBrandDefaults(false);
  }

  const sourceCode = stringifySource({
    asset: { id: componentAssetId, opacity: componentAssetOpacity },
    borderWidth,
    colors: customPalette,
    density,
    disabled,
    elevation,
    family,
    label,
    letterSpacing,
    pattern: selectedPattern,
    radius,
    size,
    supportingCopy,
    surface,
    textScale,
    typography: { role: fontRole, weight: fontWeight },
    useBrandDefaults,
  });

  function applySourceCode(source: string) {
    const next = parseSourceObject(source);
    const assetSource = sourceObject(next, 'asset') ?? {};
    const colorsSource = sourceObject(next, 'colors') ?? {};
    const typographySource = sourceObject(next, 'typography') ?? {};
    const nextFamily = sourceString(next, 'family', family);
    const nextPattern = sourceString(next, 'pattern', selectedPattern);
    const nextDensity = sourceString(next, 'density', density);
    const nextSurface = sourceString(next, 'surface', surface);
    const nextSize = sourceString(next, 'size', size);
    const nextElevation = sourceString(next, 'elevation', elevation);
    const nextRole = sourceString(typographySource, 'role', fontRole);
    const patternConfig = COMPONENT_PATTERNS.find(({ id }) => id === nextPattern);
    if (!COMPONENT_FAMILY_OPTIONS.some(({ value }) => value === nextFamily)) throw new Error(gt('Unknown component family.'));
    if (!patternConfig || patternConfig.family !== nextFamily) throw new Error(gt('The component does not belong to that family.'));
    if (!['compact', 'comfortable', 'spacious'].includes(nextDensity)) throw new Error(gt('Unknown component density.'));
    if (!['base', 'soft', 'inverse'].includes(nextSurface)) throw new Error(gt('Unknown component surface.'));
    if (!['sm', 'default', 'lg'].includes(nextSize)) throw new Error(gt('Unknown component size.'));
    if (!['none', 'soft', 'strong'].includes(nextElevation)) throw new Error(gt('Unknown component elevation.'));
    if (!identity.typography.some(({ role }) => role === nextRole)) throw new Error(gt('Unknown typography role.'));
    setFamily(nextFamily as ComponentFamily);
    setPattern(nextPattern as ComponentPatternId);
    setDensity(nextDensity as typeof density);
    setSurface(nextSurface as typeof surface);
    setSize(nextSize as typeof size);
    setElevation(nextElevation as ComponentElevation);
    setFontRole(nextRole as BrandTypography['role']);
    setLabel(sourceString(next, 'label', label));
    setSupportingCopy(sourceString(next, 'supportingCopy', supportingCopy));
    setDisabled(sourceBoolean(next, 'disabled', disabled));
    setRadius(sourceNumber(next, 'radius', radius));
    setBorderWidth(sourceNumber(next, 'borderWidth', borderWidth));
    setTextScale(sourceNumber(next, 'textScale', textScale));
    setLetterSpacing(sourceNumber(next, 'letterSpacing', letterSpacing));
    setUseBrandDefaults(sourceBoolean(next, 'useBrandDefaults', useBrandDefaults));
    setFontWeight(sourceNumber(typographySource, 'weight', fontWeight));
    setComponentAssetId(sourceString(assetSource, 'id', componentAssetId));
    setComponentAssetOpacity(sourceNumber(assetSource, 'opacity', componentAssetOpacity));
    setBackgroundColor(normalizeHexOrFallback(sourceString(colorsSource, 'background', backgroundColor), backgroundColor));
    setSurfaceColor(normalizeHexOrFallback(sourceString(colorsSource, 'surface', surfaceColor), surfaceColor));
    setForegroundColor(normalizeHexOrFallback(sourceString(colorsSource, 'foreground', foregroundColor), foregroundColor));
    setMutedColor(normalizeHexOrFallback(sourceString(colorsSource, 'muted', mutedColor), mutedColor));
    setMutedForegroundColor(normalizeHexOrFallback(sourceString(colorsSource, 'mutedForeground', mutedForegroundColor), mutedForegroundColor));
    setAccentColor(normalizeHexOrFallback(sourceString(colorsSource, 'accent', accentColor), accentColor));
    setAccentForegroundColor(normalizeHexOrFallback(sourceString(colorsSource, 'accentForeground', accentForegroundColor), accentForegroundColor));
    setBorderColor(normalizeHexOrFallback(sourceString(colorsSource, 'border', borderColor), borderColor));
    setSuccessColor(normalizeHexOrFallback(sourceString(colorsSource, 'success', successColor), successColor));
    setDangerColor(normalizeHexOrFallback(sourceString(colorsSource, 'danger', dangerColor), dangerColor));
  }

  const library = (
    <ComponentLibraryCatalog
      onSelect={selectPattern}
      selectedPattern={selectedPattern}
    />
  );

  const inspector = (
    <>
      <LabPanelHeading
        description={<T>Configuration updates the live preview without hiding the catalog.</T>}
        title={(
          <span className='component-library-inspector-title'>
            <ComponentPatternIcon pattern={selectedPattern} />
            {gt(selectedPatternConfig.label)}
          </span>
        )}
      />
      <ControlSection title={<T>Content</T>}>
        <Field label={<T>Label</T>}>
          <input
            className={INPUT_CLASS}
            onChange={(event) => setLabel(event.target.value)}
            value={label}
          />
        </Field>
        <Field label={<T>Supporting copy</T>}>
          <textarea
            className={TEXTAREA_CLASS}
            onChange={(event) => setSupportingCopy(event.target.value)}
            value={supportingCopy}
          />
        </Field>
      </ControlSection>
      <ControlSection title={<T>System</T>}>
        <label className='flex items-center justify-between gap-4 text-sm'>
          <span><T>Follow brand defaults</T></span>
          <StudioCheckbox
            checked={useBrandDefaults}
            onChange={(event) => setUseBrandDefaults(event.target.checked)}
          />
        </label>
        <Field label={<T>Component size</T>}>
          <StudioSelect
            ariaLabel='Component size'
            onValueChange={(value) => setSize(value as typeof size)}
            options={[
              { label: 'Small', value: 'sm' },
              { label: 'Default', value: 'default' },
              { label: 'Large', value: 'lg' },
            ]}
            value={size}
          />
        </Field>
        <Field label={<T>Density</T>}>
          <StudioSelect
            ariaLabel='Component density'
            onValueChange={(value) => {
              setDensity(value as typeof density);
              setUseBrandDefaults(false);
            }}
            options={[
              { label: 'Compact', value: 'compact' },
              { label: 'Comfortable', value: 'comfortable' },
              { label: 'Spacious', value: 'spacious' },
            ]}
            value={resolvedDensity}
          />
        </Field>
        <Field label={<T>Surface mode</T>}>
          <StudioSelect
            ariaLabel='Component surface'
            onValueChange={(value) => setSurface(value as typeof surface)}
            options={[
              { label: 'Base', value: 'base' },
              { label: 'Soft', value: 'soft' },
              { label: 'Inverse', value: 'inverse' },
            ]}
            value={surface}
          />
        </Field>
        <RangeField
          label={<T>Corner radius</T>}
          max={32}
          min={0}
          onChange={(value) => {
            setRadius(value);
            setUseBrandDefaults(false);
          }}
          suffix='px'
          value={resolvedRadius}
        />
        <RangeField label={<T>Border width</T>} max={4} min={0} onChange={setBorderWidth} suffix='px' value={borderWidth} />
        <Field label={<T>Elevation</T>}>
          <StudioSelect
            ariaLabel='Component elevation'
            onValueChange={(value) => setElevation(value as ComponentElevation)}
            options={[
              { label: 'None', value: 'none' },
              { label: 'Soft', value: 'soft' },
              { label: 'Strong', value: 'strong' },
            ]}
            value={elevation}
          />
        </Field>
        <label className='flex items-center justify-between gap-4 text-sm'>
          <T>Disabled state</T>
          <StudioCheckbox
            checked={disabled}
            onChange={(event) => setDisabled(event.target.checked)}
          />
        </label>
      </ControlSection>
      <ControlSection title={<T>Color system</T>}>
        <ColorControl ariaLabel={gt('Component canvas color')} label={<T>Canvas</T>} onChange={(value) => updateManualColor(setBackgroundColor, value)} onPreview={(value) => updateManualColor(setBackgroundColor, value)} value={resolvedPalette.background} />
        <ColorControl ariaLabel={gt('Component surface color')} label={<T>Surface</T>} onChange={(value) => updateManualColor(setSurfaceColor, value)} onPreview={(value) => updateManualColor(setSurfaceColor, value)} value={resolvedPalette.surface} />
        <ColorControl ariaLabel={gt('Component text color')} label={<T>Text</T>} onChange={(value) => updateManualColor(setForegroundColor, value)} onPreview={(value) => updateManualColor(setForegroundColor, value)} value={resolvedPalette.foreground} />
        <ColorControl ariaLabel={gt('Component accent color')} label={<T>Accent</T>} onChange={(value) => updateManualColor(setAccentColor, value)} onPreview={(value) => updateManualColor(setAccentColor, value)} value={resolvedPalette.accent} />
        <ColorControl ariaLabel={gt('Component accent text color')} label={<T>Accent text</T>} onChange={(value) => updateManualColor(setAccentForegroundColor, value)} onPreview={(value) => updateManualColor(setAccentForegroundColor, value)} value={resolvedPalette.accentForeground} />
        <ColorControl ariaLabel={gt('Component muted color')} label={<T>Muted surface</T>} onChange={(value) => updateManualColor(setMutedColor, value)} onPreview={(value) => updateManualColor(setMutedColor, value)} value={resolvedPalette.muted} />
        <ColorControl ariaLabel={gt('Component muted text color')} label={<T>Muted text</T>} onChange={(value) => updateManualColor(setMutedForegroundColor, value)} onPreview={(value) => updateManualColor(setMutedForegroundColor, value)} value={resolvedPalette.mutedForeground} />
        <ColorControl ariaLabel={gt('Component border color')} label={<T>Border</T>} onChange={(value) => updateManualColor(setBorderColor, value)} onPreview={(value) => updateManualColor(setBorderColor, value)} value={resolvedPalette.border} />
        <ColorControl ariaLabel={gt('Component success color')} label={<T>Success</T>} onChange={(value) => updateManualColor(setSuccessColor, value)} onPreview={(value) => updateManualColor(setSuccessColor, value)} value={resolvedPalette.success} />
        <ColorControl ariaLabel={gt('Component danger color')} label={<T>Danger</T>} onChange={(value) => updateManualColor(setDangerColor, value)} onPreview={(value) => updateManualColor(setDangerColor, value)} value={resolvedPalette.danger} />
      </ControlSection>
      <ControlSection title={<T>Typography</T>}>
        <Field label={<T>Font role</T>}><StudioSelect ariaLabel='Component font role' onValueChange={(value) => { const role = value as BrandTypography['role']; setFontRole(role); setFontWeight(brandTypographyRole(identity, role).weight ?? 400); setUseBrandDefaults(false); }} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={resolvedFontRole} /></Field>
        <RangeField label={<T>Font weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(value) => { setFontWeight(value); setUseBrandDefaults(false); }} step={50} value={resolvedFontWeight} />
        <RangeField label={<T>Text scale</T>} max={140} min={70} onChange={setTextScale} suffix='%' value={textScale} />
        <RangeField label={<T>Letter spacing</T>} max={12} min={-6} onChange={setLetterSpacing} suffix='%' value={letterSpacing} />
      </ControlSection>
      <ControlSection title={<T>Shared media</T>}>
        <Field label={<T>Shared asset</T>}><StudioSelect ariaLabel='Component shared asset' onValueChange={setComponentAssetId} options={[{ label: 'None', value: 'none' }, ...componentAssets.map((asset) => ({ label: `${asset.label} · ${asset.type}`, value: asset.id }))]} value={componentAsset?.id ?? 'none'} /></Field>
        {componentAsset ? <RangeField label={<T>Asset opacity</T>} max={100} min={0} onChange={setComponentAssetOpacity} value={componentAssetOpacity} /> : null}
      </ControlSection>
    </>
  );

  return (
    <ToolShell inspector={inspector} library={library} sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('Component source') }} tool={tool}>
      <div className='grid min-h-full content-center p-5 sm:p-8'>
        <div
          className={`component-library-demo component-density-${resolvedDensity} relative mx-auto w-full max-w-5xl overflow-hidden smooth-shadow-ring-sm`}
          data-component-size={size}
          data-elevation={elevation}
          data-surface={surface}
          style={{ ...componentPreviewStyle(resolvedRadius, identity, { borderWidth, elevation, letterSpacing, palette: resolvedPalette, surface, textScale }), fontFamily: brandTypographyFamily(identity, resolvedFontRole), fontWeight: capVisibleFontWeight(resolvedFontWeight) }}
        >
          {componentAsset ? <img alt='' aria-hidden='true' className='pointer-events-none absolute inset-0 size-full object-cover' src={componentAsset.path} style={{ opacity: componentAssetOpacity / 100 }} /> : null}
          <header className='component-library-header relative z-10 flex items-center justify-between gap-6 border-b border-border px-5 py-4'>
            <div className='component-library-preview-title'>
              <span><ComponentPatternIcon pattern={selectedPattern} /></span>
              <div>
                <p className='text-sm font-semibold'>{gt(selectedPatternConfig.label)}</p>
                <p className='mt-1 text-xs capitalize text-muted-foreground'>{family} · {resolvedDensity}</p>
              </div>
            </div>
            <span className='font-mono text-xs text-muted-foreground'>
              {COMPONENT_PATTERNS.length} <T>patterns</T> · {COMPONENT_FAMILY_OPTIONS.length} <T>families</T>
            </span>
          </header>
          <div className='relative z-10'>
            <ComponentLibraryPreview
              disabled={disabled}
              identity={identity}
              label={label}
              pattern={selectedPattern}
              size={size}
              supportingCopy={supportingCopy}
            />
          </div>
        </div>
      </div>
    </ToolShell>
  );
}

export default ComponentLibraryTool;
