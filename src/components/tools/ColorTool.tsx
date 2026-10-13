'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { T, useGT } from 'gt-next';
import { Check, Copy, RotateCcw, X } from '@/components/ui/SolidIcons';
import { LabInspectorSection, LabPanelHeading } from '@/components/LabWorkspace';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import { ToolShell } from '@/components/tools/ToolShell';
import { INPUT_CLASS, TEXTAREA_CLASS, Field, RangeField } from '@/components/tools/ToolFields';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { brandAssetPath, type BrandIdentity } from '@/lib/brandIdentity';
import { copyTextToClipboard } from '@/lib/clipboard';
import { colorContrastRatio, formatOklch, hexToOklch, mixHexColors, normalizeHex, normalizeHexOrFallback, oklchToHex, resolveReadableColor } from '@/lib/color';
import type { StudioTool } from '@/lib/studioCatalog';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import {
  parseSourceObject,
  sourceNumber,
  sourceObjectArray,
  sourceString,
  stringifySource,
} from '@/lib/sourceCode';

type EditableColor = {
  hex: string;
  id: string;
  name: string;
  opacity: number;
  role: string;
};

function sanitizeEditableColors(
  value: unknown,
  fallbacks: BrandIdentity['colors']
): EditableColor[] {
  const candidates = Array.isArray(value) && value.length > 0 ? value : fallbacks;
  return candidates.map((candidate, index) => {
    const source = candidate && typeof candidate === 'object'
      ? candidate as Partial<EditableColor>
      : {};
    const fallback = fallbacks[index];
    const opacity = typeof source.opacity === 'number' && Number.isFinite(source.opacity)
      ? Math.min(100, Math.max(0, source.opacity))
      : 100;
    return {
      hex: normalizeHexOrFallback(source.hex, fallback?.hex ?? '#000000'),
      id: typeof source.id === 'string' ? source.id : fallback?.id ?? `color-${index + 1}`,
      name: typeof source.name === 'string' ? source.name : fallback?.name ?? `Color ${index + 1}`,
      opacity,
      role: typeof source.role === 'string' ? source.role : fallback?.role ?? '',
    };
  });
}

function clonePalette(palette: EditableColor[]) {
  return palette.map((color) => ({ ...color }));
}

function palettesMatch(first: EditableColor[], second: EditableColor[]) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function ColorTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const [storedColors, setColors] = useStudioDraft<EditableColor[]>(
    identity.id,
    tool.id,
    'colors',
    () => identity.colors.map(({ hex, id, name, role }) => ({ hex, id, name, opacity: 100, role }))
  );
  const colors = useMemo(
    () => sanitizeEditableColors(storedColors, identity.colors),
    [identity.colors, storedColors]
  );
  const colorsRef = useCommittedRef(colors);
  const editBaselineRef = useRef<EditableColor[] | null>(null);
  const undoStackRef = useRef<EditableColor[][]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
  useEffect(() => {
    if (JSON.stringify(storedColors) !== JSON.stringify(colors)) setColors(colors);
  }, [colors, setColors, storedColors]);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [contrastIndex, setContrastIndex] = useState(() => Math.min(1, identity.colors.length - 1));
  const [previewSurface, setPreviewSurface] = useState<'paper' | 'ink' | 'grid'>('paper');
  const [colorPopover, setColorPopover] = useState<{ left: number; top: number } | null>(null);
  const colorCanvasRef = useRef<HTMLDivElement>(null);
  const sourceCode = stringifySource({ colors });
  const resolvedSelectedIndex = Math.min(selectedIndex, Math.max(0, colors.length - 1));
  const selectedColor = colors[resolvedSelectedIndex] ?? { hex: '#000000', name: 'Color', opacity: 100, role: '' };
  const selectedOklch = hexToOklch(selectedColor.hex);
  const draftColorByIdentityId = (id: string, fallback: string) => {
    const identityIndex = identity.colors.findIndex((color) => color.id === id);
    return colors[identityIndex]?.hex ?? identity.colors[identityIndex]?.hex ?? fallback;
  };
  const surfaceBackground = previewSurface === 'ink'
    ? draftColorByIdentityId('ink', '#181818')
    : previewSurface === 'grid'
      ? draftColorByIdentityId('muted', '#F2F2F2')
      : draftColorByIdentityId('paper', '#FFFFFF');
  const selectedBackground = mixHexColors(surfaceBackground, selectedColor.hex, selectedColor.opacity / 100);
  const requestedContrastColor = colors[Math.min(contrastIndex, Math.max(0, colors.length - 1))]?.hex ?? '#FFFFFF';
  const contrastResolution = resolveReadableColor(selectedBackground, requestedContrastColor);
  const contrastColor = contrastResolution.color;
  const contrastRatio = contrastResolution.ratio;
  const actionTextColor = resolveReadableColor(contrastColor, selectedColor.hex).color;
  const darkWordmarkPath = brandAssetPath(identity, 'wordmark');
  const lightWordmarkPath = brandAssetPath(identity, 'wordmark-light');
  const darkMarkPath = brandAssetPath(identity, 'mark-dark');
  const lightMarkPath = brandAssetPath(identity, 'mark-light');
  const useLightLogo = colorContrastRatio(selectedBackground, '#FFFFFF') >= colorContrastRatio(selectedBackground, '#000000');
  const proofLogo = (useLightLogo
    ? [
        { kind: 'wordmark' as const, path: lightWordmarkPath },
        { kind: 'mark' as const, path: lightMarkPath },
        { kind: 'wordmark' as const, path: darkWordmarkPath },
        { kind: 'mark' as const, path: darkMarkPath },
      ]
    : [
        { kind: 'wordmark' as const, path: darkWordmarkPath },
        { kind: 'mark' as const, path: darkMarkPath },
        { kind: 'wordmark' as const, path: lightWordmarkPath },
        { kind: 'mark' as const, path: lightMarkPath },
      ]).find(({ path }) => Boolean(path));

  useEffect(() => {
    if (!colorPopover) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setColorPopover(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [colorPopover]);

  function writePalette(nextPalette: EditableColor[]) {
    const sanitized = sanitizeEditableColors(nextPalette, identity.colors);
    colorsRef.current = sanitized;
    setColors(sanitized);
  }

  function pushUndoSnapshot(snapshot: EditableColor[]) {
    const previous = undoStackRef.current.at(-1);
    if (previous && palettesMatch(previous, snapshot)) return;
    undoStackRef.current = [...undoStackRef.current, clonePalette(snapshot)].slice(-40);
    setUndoDepth(undoStackRef.current.length);
  }

  function beginColorEdit() {
    if (!editBaselineRef.current) editBaselineRef.current = clonePalette(colorsRef.current);
  }

  function patchedSelectedPalette(patch: Partial<EditableColor>) {
    return colorsRef.current.map((color, index) => (
      index === resolvedSelectedIndex ? { ...color, ...patch } : color
    ));
  }

  function previewSelectedColor(patch: Partial<EditableColor>) {
    beginColorEdit();
    const nextPalette = patchedSelectedPalette(patch);
    if (!palettesMatch(colorsRef.current, nextPalette)) writePalette(nextPalette);
  }

  function commitSelectedColor(patch: Partial<EditableColor>) {
    const baseline = editBaselineRef.current ?? clonePalette(colorsRef.current);
    const nextPalette = patchedSelectedPalette(patch);
    editBaselineRef.current = null;
    if (palettesMatch(baseline, nextPalette)) return;
    pushUndoSnapshot(baseline);
    writePalette(nextPalette);
  }

  function finishColorEdit() {
    const baseline = editBaselineRef.current;
    editBaselineRef.current = null;
    if (!baseline || palettesMatch(baseline, colorsRef.current)) return;
    pushUndoSnapshot(baseline);
  }

  function commitPalette(nextPalette: EditableColor[]) {
    const current = clonePalette(colorsRef.current);
    const sanitized = sanitizeEditableColors(nextPalette, identity.colors);
    editBaselineRef.current = null;
    if (palettesMatch(current, sanitized)) return;
    pushUndoSnapshot(current);
    writePalette(sanitized);
  }

  function undoLastColorChange() {
    const previous = undoStackRef.current.at(-1);
    if (!previous) return;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setUndoDepth(undoStackRef.current.length);
    editBaselineRef.current = null;
    writePalette(previous);
  }

  function openColorPopover(target: HTMLElement, index: number, clientX?: number, clientY?: number) {
    const canvas = colorCanvasRef.current;
    if (!canvas) return;
    const canvasBounds = canvas.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    const popoverWidth = Math.min(300, Math.max(240, canvasBounds.width - 24));
    const popoverHeight = 430;
    const pointerX = clientX ?? targetBounds.left + targetBounds.width / 2;
    const pointerY = clientY ?? targetBounds.top + targetBounds.height / 2;
    const maximumLeft = Math.max(12, canvasBounds.width - popoverWidth - 12);
    const maximumTop = Math.max(12, canvasBounds.height - popoverHeight - 12);
    setSelectedIndex(index);
    setColorPopover({
      left: Math.min(maximumLeft, Math.max(12, pointerX - canvasBounds.left + 14)),
      top: Math.min(maximumTop, Math.max(12, pointerY - canvasBounds.top + 14)),
    });
  }

  function openColorPopoverFromClick(event: MouseEvent<HTMLElement>, index: number) {
    event.stopPropagation();
    openColorPopover(event.currentTarget, index, event.clientX, event.clientY);
  }

  function applySourceCode(source: string) {
    const value = parseSourceObject(source);
    const nextColors = sourceObjectArray(value, 'colors');
    if (!nextColors) throw new TypeError('colors must be an array of color objects.');
    commitPalette(nextColors.map((color, index) => ({
      hex: normalizeHex(sourceString(color, 'hex', colors[index]?.hex ?? '#000000')),
      id: sourceString(color, 'id', colors[index]?.id ?? `color-${index + 1}`),
      name: sourceString(color, 'name', colors[index]?.name ?? `Color ${index + 1}`),
      opacity: sourceNumber(color, 'opacity', colors[index]?.opacity ?? 100),
      role: sourceString(color, 'role', colors[index]?.role ?? ''),
    })));
  }

  function colorTokensCss() {
    return colors
      .map(
        (color) =>
          `--color-${color.name.toLocaleLowerCase().replaceAll(' ', '-')}: ${formatOklch(color.hex).replace(')', ` / ${color.opacity ?? 100}%)`)}; /* ${normalizeHex(color.hex)} */`
      )
      .join('\n');
  }

  async function copyTokens(throwOnError = false) {
    const value = colorTokensCss();
    try {
      await copyTextToClipboard(value);
      setCopyError(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
      setCopyError(true);
      if (throwOnError) throw new Error('Clipboard access was denied.');
    }
    return value;
  }

  const library = (
    <>
      <LabPanelHeading
        description={<T>Select a semantic token to edit and test in context.</T>}
        title={<T>Brand colors</T>}
      />
      <div className='color-lab-library'>
        {colors.map((color, index) => (
          <button
            aria-pressed={selectedIndex === index}
            className='color-lab-token'
            key={color.id}
            onClick={() => {
              setSelectedIndex(index);
              setColorPopover(null);
            }}
            type='button'
          >
            <span style={{ backgroundColor: color.hex }} />
            <span><strong>{color.name}</strong><small>{color.role || formatOklch(color.hex)}</small></span>
            <code>{normalizeHex(color.hex)}</code>
          </button>
        ))}
      </div>
    </>
  );

  const inspector = (
    <>
      <LabPanelHeading
        description={<T>Adjust perceptual channels while keeping production values visible.</T>}
        title={selectedColor.name}
      />
      <LabInspectorSection index='01' meta='OKLCH' title={<T>Color</T>}>
        <ColorControl
          ariaLabel={gt('Change {name}', { name: selectedColor.name })}
          label={<T>Exact color</T>}
          onChange={(hex) => commitSelectedColor({ hex })}
          onOpacityChange={(opacity) => commitSelectedColor({ opacity })}
          onOpacityPreview={(opacity) => previewSelectedColor({ opacity })}
          onPreview={(hex) => previewSelectedColor({ hex })}
          opacity={selectedColor.opacity}
          value={selectedColor.hex}
        />
        <RangeField label={<T>Lightness</T>} max={100} min={0} onChange={(lightness) => previewSelectedColor({ hex: oklchToHex({ ...hexToOklch(colorsRef.current[resolvedSelectedIndex]?.hex ?? selectedColor.hex), lightness: lightness / 100 }) })} onChangeEnd={finishColorEdit} onChangeStart={beginColorEdit} suffix='%' value={Math.round(selectedOklch.lightness * 100)} />
        <RangeField label={<T>Chroma</T>} max={0.4} min={0} onChange={(chroma) => previewSelectedColor({ hex: oklchToHex({ ...hexToOklch(colorsRef.current[resolvedSelectedIndex]?.hex ?? selectedColor.hex), chroma }) })} onChangeEnd={finishColorEdit} onChangeStart={beginColorEdit} step={0.005} value={Number(selectedOklch.chroma.toFixed(3))} />
        <RangeField label={<T>Hue</T>} max={360} min={0} onChange={(hue) => previewSelectedColor({ hex: oklchToHex({ ...hexToOklch(colorsRef.current[resolvedSelectedIndex]?.hex ?? selectedColor.hex), hue }) })} onChangeEnd={finishColorEdit} onChangeStart={beginColorEdit} suffix='°' value={Math.round(selectedOklch.hue)} />
      </LabInspectorSection>
      <LabInspectorSection index='02' meta='Semantic' title={<T>Token</T>}>
        <Field label={<T>Name</T>}><input className={INPUT_CLASS} onBlur={finishColorEdit} onChange={(event) => previewSelectedColor({ name: event.target.value })} onFocus={beginColorEdit} value={selectedColor.name} /></Field>
        <Field label={<T>Role</T>}><textarea className={TEXTAREA_CLASS} onBlur={finishColorEdit} onChange={(event) => previewSelectedColor({ role: event.target.value })} onFocus={beginColorEdit} value={selectedColor.role} /></Field>
      </LabInspectorSection>
      <LabInspectorSection index='03' meta={`${contrastRatio.toFixed(2)}:1`} title={<T>Contrast check</T>}>
        <StudioSelect
          ariaLabel={gt('Contrast color')}
          onValueChange={(value) => setContrastIndex(Number(value))}
          options={colors.map((color, index) => ({ label: color.name, value: String(index) }))}
          value={String(contrastIndex)}
        />
        <p className='lab-section-description'>{contrastRatio >= 4.5 ? <T>Passes WCAG AA for normal text.</T> : contrastRatio >= 3 ? <T>Passes for large text only.</T> : <T>Use this pairing for decoration, not text.</T>}</p>
      </LabInspectorSection>
    </>
  );

  return (
    <ToolShell
      automation={{
        actions: studioToolActionNames('colors'),
        invoke: (action) => {
          if (action === 'colors.tokens.read') return colorTokensCss();
          if (action === 'colors.tokens.copy') return copyTokens(true);
          throw new RangeError(`Unknown Color tokens action: ${action}.`);
        },
      }}
      actions={
        <>
          <Button disabled={undoDepth === 0} onClick={undoLastColorChange} title={undoDepth === 0 ? gt('Change a color to enable undo.') : gt('Restore the previous color value.')} type='button' variant='outline'>
            <RotateCcw aria-hidden='true' />
            <T>Undo color</T>
          </Button>
          <Button onClick={() => void copyTokens()} title={copyError ? gt('Clipboard access was denied. Try again.') : undefined} type='button' variant='outline'>
            {copied ? <Check aria-hidden='true' /> : copyError ? <X aria-hidden='true' /> : <Copy aria-hidden='true' />}
            {copied ? <T>Copied</T> : copyError ? <T>Try copy again</T> : <T>Copy tokens</T>}
          </Button>
        </>
      }
      inspector={inspector}
      library={library}
      sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('Color system source') }}
      tool={tool}
    >
      <div className='color-lab-stage' data-surface={previewSurface}>
        <div className='color-lab-toolbar'>
          <div>
            <span><T>Live token proof</T></span>
            <strong>{selectedColor.name}</strong>
          </div>
          <div className='color-lab-segmented'>
            {(['paper', 'ink', 'grid'] as const).map((surface) => <button aria-pressed={previewSurface === surface} key={surface} onClick={() => setPreviewSurface(surface)} type='button'>{surface}</button>)}
          </div>
        </div>
        <div className='color-lab-canvas' onClick={() => setColorPopover(null)} ref={colorCanvasRef}>
          <button
            aria-label={gt('Inspect and edit {name}', { name: selectedColor.name })}
            className='color-lab-proof'
            onClick={(event) => openColorPopoverFromClick(event, resolvedSelectedIndex)}
            data-auto-contrast={contrastResolution.fallbackApplied ? 'true' : 'false'}
            style={{ backgroundColor: selectedBackground, color: contrastColor }}
            type='button'
          >
            <span className='color-lab-proof-meta'><span>{selectedColor.role || 'Semantic brand color'}{contrastResolution.fallbackApplied ? ' · Auto contrast' : ''}</span><code>{normalizeHex(selectedColor.hex)}</code></span>
            {proofLogo?.path ? (
              <img
                alt={`${identity.name} ${proofLogo.kind}`}
                className='color-lab-proof-logo'
                data-logo-kind={proofLogo.kind}
                src={proofLogo.path}
              />
            ) : <span className='color-lab-proof-title'>{identity.shortName}</span>}
            <span className='color-lab-proof-description'>{identity.tagline}</span>
            <span className='color-lab-proof-action' style={{ backgroundColor: contrastColor, color: actionTextColor }}><T>Primary action</T></span>
          </button>
          <div className='color-lab-values'>
            <div><span>HEX</span><strong>{normalizeHex(selectedColor.hex)}</strong></div>
            <div><span>OKLCH</span><strong>{formatOklch(selectedColor.hex)}</strong></div>
            <div><span>CONTRAST</span><strong>{contrastRatio.toFixed(2)}:1</strong></div>
          </div>
          <div className='color-lab-ramp' aria-label={gt('Tonal ramp')}>
            {[0.9, 0.72, 0.5, 0.28, 0.12].map((amount) => <span key={`light-${amount}`} style={{ backgroundColor: mixHexColors('#FFFFFF', selectedColor.hex, amount) }} />)}
            {[0.15, 0.32, 0.52, 0.72, 0.88].map((amount) => <span key={`dark-${amount}`} style={{ backgroundColor: mixHexColors(selectedColor.hex, '#000000', amount) }} />)}
          </div>
          <div aria-label={gt('Color token canvas')} className='color-lab-token-map'>
            {colors.map((color, index) => (
              <button
                aria-label={gt('Inspect and edit {name}', { name: color.name })}
                aria-pressed={resolvedSelectedIndex === index}
                key={`${color.id}-canvas`}
                onClick={(event) => openColorPopoverFromClick(event, index)}
                style={{ backgroundColor: color.hex }}
                type='button'
              >
                <span>{color.name}</span>
                <code>{normalizeHex(color.hex)}</code>
              </button>
            ))}
          </div>
          {colorPopover ? (
            <aside
              aria-label={gt('Edit {name}', { name: selectedColor.name })}
              className='color-lab-canvas-popover'
              onClick={(event) => event.stopPropagation()}
              role='region'
              style={{ left: colorPopover.left, top: colorPopover.top }}
            >
              <header>
                <div>
                  <span><T>Canvas color</T></span>
                  <strong>{selectedColor.name}</strong>
                </div>
                <button aria-label={gt('Close color editor')} onClick={() => setColorPopover(null)} type='button'><X aria-hidden='true' /></button>
              </header>
              <ColorControl
                ariaLabel={gt('Change {name}', { name: selectedColor.name })}
                label={<T>Edit sampled token</T>}
                onChange={(hex) => commitSelectedColor({ hex })}
                onOpacityChange={(opacity) => commitSelectedColor({ opacity })}
                onOpacityPreview={(opacity) => previewSelectedColor({ opacity })}
                onPreview={(hex) => previewSelectedColor({ hex })}
                opacity={selectedColor.opacity}
                value={selectedColor.hex}
              />
              <div className='color-lab-canvas-popover-meta'>
                <span>{formatOklch(selectedColor.hex)}</span>
                <span>{contrastRatio.toFixed(2)}:1</span>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </ToolShell>
  );
}

export default ColorTool;
