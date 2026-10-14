'use client';

import { useState } from 'react';
import { T, useGT } from 'gt-next';
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowUp,
  Copy,
  RotateCcw,
  RotateCw,
  Trash2,
} from '@/components/ui/SolidIcons';

import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import { ShaderLibraryBrowser } from '@/components/ShaderLibrarySidebar';
import TextAlignmentControl from '@/components/TextAlignmentControl';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import StudioSelect from '@/components/ui/StudioSelect';
import {
  ControlSection,
  Field,
  NumberField,
  RangeField,
  TEXTAREA_CLASS,
  UploadField,
  INPUT_CLASS,
} from '@/components/tools/ToolFields';
import type { BrandIdentity } from '@/lib/brandIdentity';
import type { CanvasDocument, CanvasElement } from '@/lib/canvasDocument';
import { EXPRESSION_DEVICES } from '@/lib/expressionDevices';
import {
  dataBoolean,
  dataNumber,
  dataString,
  elementComponent,
  patchElement,
  readNumberArray,
  readStringArray,
  resolveExpressionColor,
  type ExpressionAlignment,
  type ExpressionFontRole,
} from '@/lib/expressionModel';
import {
  alignExpressionLayers,
  setLayerAsset,
  setUploadedFont,
  updateExpressionLayer,
  type UpdateLayerInput,
} from '@/lib/expressionOperations';
import { CODE_THEMES } from '@/lib/expressionSvg';
import { expressionColors } from '@/lib/expressionTemplates';
import { DEFAULT_LOGO_APPEARANCE, type LogoAppearanceSettings } from '@/lib/logoAppearance';
import { SHADER_LIBRARY_DEFAULT_IDS, shaderPreviewAssetPath } from '@/lib/shaderLab';
import { MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';
import type { LiveMaterialId } from '@/lib/liveMaterials';
import type { ExpressionCommit } from './useExpressionDocument';
import { colorRoleOptions, isLiteralColor, readFileAsAsset } from './expressionEditorUtils';
import styles from './ExpressionEditor.module.css';

const ALIGNMENTS: readonly { icon: typeof AlignHorizontalJustifyStart; label: string; value: ExpressionAlignment }[] = [
  { icon: AlignHorizontalJustifyStart, label: 'Align layer left', value: 'left' },
  { icon: AlignHorizontalJustifyCenter, label: 'Center layer horizontally', value: 'horizontal-center' },
  { icon: AlignHorizontalJustifyEnd, label: 'Align layer right', value: 'right' },
  { icon: AlignVerticalJustifyStart, label: 'Align layer top', value: 'top' },
  { icon: AlignVerticalJustifyCenter, label: 'Center layer vertically', value: 'vertical-center' },
  { icon: AlignVerticalJustifyEnd, label: 'Align layer bottom', value: 'bottom' },
];

export type InspectorActions = {
  duplicate: (ids: string[]) => void;
  remove: (ids: string[]) => void;
  reorder: (id: string, target: 'back' | 'backward' | 'forward' | 'front') => void;
};

type InspectorProps = {
  actions: InspectorActions;
  commit: ExpressionCommit;
  document: CanvasDocument;
  identity: BrandIdentity;
};

function useUpdate({ commit, identity }: Pick<InspectorProps, 'commit' | 'identity'>, element: CanvasElement) {
  return (input: UpdateLayerInput, key = Object.keys(input).join(',')) => {
    commit((current) => updateExpressionLayer(current, element.id, input, identity), { coalesce: `${element.id}:${key}`, label: `Edit ${element.name}` });
  };
}

function ColorRoleField({ ariaLabel, identity, label, none = false, onChange, value }: {
  ariaLabel: string;
  identity: BrandIdentity;
  label: string;
  none?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const gt = useGT();
  const [custom, setCustom] = useState(isLiteralColor(value));
  const hex = resolveExpressionColor(value === 'none' ? 'ink' : value, expressionColors(identity), '#000000');
  return (
    <div className='flex flex-col gap-2'>
      <Field label={gt(label)}>
        <StudioSelect
          ariaLabel={ariaLabel}
          onValueChange={(next) => {
            if (next === 'custom') {
              setCustom(true);
              onChange(hex);
              return;
            }
            setCustom(false);
            onChange(next);
          }}
          options={colorRoleOptions(identity, { custom: isLiteralColor(value) ? value : undefined, none })}
          value={value || 'ink'}
        />
      </Field>
      {custom || isLiteralColor(value) ? (
        <ColorControl ariaLabel={`${ariaLabel} hex`} label={gt('Custom color')} onChange={onChange} value={hex} />
      ) : null}
    </div>
  );
}

function LayerSection({ actions, commit, element, identity, document }: InspectorProps & { element: CanvasElement }) {
  const gt = useGT();
  const update = useUpdate({ commit, identity }, element);
  const { height, rotation, width, x, y } = element.bounds;
  return (
    <ControlSection title={<T>Layer</T>}>
      <Field label={<T>Name</T>}>
        <input aria-label={gt('Layer name')} className={INPUT_CLASS} onChange={(event) => update({ name: event.target.value })} value={element.name} />
      </Field>
      <div className={styles.numberGrid}>
        <NumberField ariaLabel='Layer X' label='X' onCommit={(value) => update({ bounds: { x: value } }, 'x')} value={x} />
        <NumberField ariaLabel='Layer Y' label='Y' onCommit={(value) => update({ bounds: { y: value } }, 'y')} value={y} />
        <NumberField ariaLabel='Layer width' label='W' min={1} onCommit={(value) => update({ bounds: { width: value } }, 'w')} value={width} />
        <NumberField ariaLabel='Layer height' label='H' min={1} onCommit={(value) => update({ bounds: { height: value } }, 'h')} value={height} />
      </div>
      <div className='flex items-end gap-2'>
        <div className='min-w-0 flex-1'>
          <RangeField label={<T>Rotation</T>} max={180} min={-180} onChange={(value) => update({ bounds: { rotation: value } }, 'rotation')} suffix='°' value={rotation} />
        </div>
        <Button aria-label={gt('Rotate layer left 15°')} onClick={() => update({ bounds: { rotation: rotation - 15 } }, 'rotate-step')} size='icon-sm' title={gt('Rotate left 15°')} type='button' variant='ghost'><RotateCcw aria-hidden='true' /></Button>
        <Button aria-label={gt('Rotate layer right 15°')} onClick={() => update({ bounds: { rotation: rotation + 15 } }, 'rotate-step')} size='icon-sm' title={gt('Rotate right 15°')} type='button' variant='ghost'><RotateCw aria-hidden='true' /></Button>
      </div>
      <RangeField label={<T>Layer opacity</T>} max={100} min={0} onChange={(value) => update({ opacity: value / 100 }, 'opacity')} suffix='%' value={Math.round(element.style.opacity * 100)} />
      <div className='flex flex-wrap gap-3 text-sm'>
        <label className='flex items-center gap-2'>
          <StudioCheckbox aria-label={gt('Layer hidden')} checked={element.hidden} onChange={(event) => update({ hidden: event.target.checked })} />
          <T>Hidden</T>
        </label>
        <label className='flex items-center gap-2'>
          <StudioCheckbox aria-label={gt('Layer locked')} checked={element.locked} onChange={(event) => update({ locked: event.target.checked })} />
          <T>Locked</T>
        </label>
      </div>
      <div aria-label={gt('Arrange layer')} className={styles.iconRow} role='group'>
        <Button aria-label={gt('Bring layer forward')} onClick={() => actions.reorder(element.id, 'forward')} size='icon-sm' title={gt('Bring forward')} type='button' variant='outline'><ArrowUp aria-hidden='true' /></Button>
        <Button aria-label={gt('Send layer backward')} onClick={() => actions.reorder(element.id, 'backward')} size='icon-sm' title={gt('Send backward')} type='button' variant='outline'><ArrowDown aria-hidden='true' /></Button>
        <Button onClick={() => actions.reorder(element.id, 'front')} size='sm' type='button' variant='outline'><T>To front</T></Button>
        <Button onClick={() => actions.reorder(element.id, 'back')} size='sm' type='button' variant='outline'><T>To back</T></Button>
      </div>
      <div aria-label={gt('Align layer to artboard')} className={styles.iconRow} role='group'>
        {ALIGNMENTS.map(({ icon: Icon, label, value }) => (
          <Button aria-label={gt(label)} key={value} onClick={() => commit((current) => alignExpressionLayers(current, [element.id], value), { label: gt(label) })} size='icon-sm' title={gt(label)} type='button' variant='ghost'>
            <Icon aria-hidden='true' />
          </Button>
        ))}
      </div>
      <div className={styles.iconRow}>
        <Button onClick={() => actions.duplicate([element.id])} size='sm' type='button' variant='outline'><Copy aria-hidden='true' /><T>Duplicate layer</T></Button>
        <Button onClick={() => actions.remove([element.id])} size='sm' type='button' variant='outline'><Trash2 aria-hidden='true' /><T>Delete layer</T></Button>
      </div>
      {document.assets[element.assetId ?? ''] ? <p className={styles.hint}>{document.assets[element.assetId!]!.name}</p> : null}
    </ControlSection>
  );
}

function fontRoleOptions(identity: BrandIdentity, element: CanvasElement) {
  const options = identity.typography.map((font) => ({ label: `${font.role} · ${font.family}`, value: font.role }));
  if (element.textStyle?.fontId.startsWith('font:upload-')) options.unshift({ label: 'Uploaded font', value: 'uploaded' as ExpressionFontRole });
  return options;
}

function TextSection({ commit, element, identity }: InspectorProps & { element: CanvasElement }) {
  const gt = useGT();
  const update = useUpdate({ commit, identity }, element);
  const style = element.textStyle!;
  const uploaded = style.fontId.startsWith('font:upload-');
  return (
    <ControlSection title={<T>Text</T>}>
      <Field label={<T>Text</T>}>
        <textarea aria-label={gt('Layer text')} className={TEXTAREA_CLASS} onChange={(event) => update({ content: event.target.value }, 'content')} value={element.content ?? ''} />
      </Field>
      <Field label={<T>Type role</T>}>
        <StudioSelect ariaLabel='Text role' onValueChange={(value) => { if (value !== 'uploaded') update({ fontRole: value as ExpressionFontRole }); }} options={fontRoleOptions(identity, element)} value={uploaded ? 'uploaded' : style.fontRole ?? 'Body'} />
      </Field>
      <RangeField label={<T>Text size</T>} max={400} min={8} onChange={(value) => update({ fontSize: value }, 'size')} suffix='px' value={Math.round(style.fontSize)} />
      <RangeField label={<T>Text weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(value) => update({ fontWeight: value }, 'weight')} step={10} value={style.fontWeight} />
      <RangeField label={<T>Tracking</T>} max={20} min={-10} onChange={(value) => update({ letterSpacing: value / 100 }, 'tracking')} step={0.5} suffix='%' value={Math.round(style.letterSpacing * 1000) / 10} />
      <RangeField label={<T>Line height</T>} max={240} min={70} onChange={(value) => update({ lineHeight: value / 100 }, 'lineHeight')} step={2} suffix='%' value={Math.round(style.lineHeight * 100)} />
      <ColorRoleField ariaLabel='Text color' identity={identity} label='Color' onChange={(value) => update({ fill: value }, 'fill')} value={dataString(element, 'fill', 'ink')} />
      <TextAlignmentControl ariaLabel={gt('Text alignment')} onChange={(align) => update({ align })} value={style.align === 'justify' ? 'left' : style.align} />
      <div className='grid grid-cols-2 gap-2'>
        <Field label={<T>Casing</T>}>
          <StudioSelect ariaLabel='Text casing' onValueChange={(value) => update({ casing: value as UpdateLayerInput['casing'] })} options={[{ label: 'As typed', value: 'none' }, { label: 'Uppercase', value: 'uppercase' }, { label: 'Lowercase', value: 'lowercase' }]} value={style.casing} />
        </Field>
        <Field label={<T>Vertical</T>}>
          <StudioSelect ariaLabel='Text vertical alignment' onValueChange={(value) => update({ data: { valign: value } })} options={[{ label: 'Top', value: 'top' }, { label: 'Middle', value: 'middle' }, { label: 'Bottom', value: 'bottom' }]} value={dataString(element, 'valign', 'top')} />
        </Field>
      </div>
      <label className='flex items-center gap-2 text-sm'>
        <StudioCheckbox aria-label={gt('Shrink text to fit')} checked={dataString(element, 'fit') === 'shrink'} onChange={(event) => update({ data: { fit: event.target.checked ? 'shrink' : 'none' } })} />
        <T>Shrink to fit the box</T>
      </label>
      <UploadField accept='.otf,.ttf,.woff,.woff2,font/*' fileName={uploaded ? gt('Uploaded font in use') : undefined} label='Upload layer font' onFile={(file) => {
        void readFileAsAsset(file).then((asset) => commit((current) => setUploadedFont(current, element.id, asset), { label: gt('Upload font') }));
      }} />
    </ControlSection>
  );
}

function ImageSection({ commit, element, identity }: InspectorProps & { element: CanvasElement }) {
  const gt = useGT();
  const update = useUpdate({ commit, identity }, element);
  const library = [...identity.assets, ...identity.proofAssets].filter(({ path, type }) => ['background', 'image', 'product', 'proof', 'reference', 'texture'].includes(type) && !/\.pdf$/i.test(path));
  const fit = element.imageTreatment?.objectFit ?? 'cover';
  return (
    <ControlSection title={<T>Image</T>}>
      <Field label={<T>Library image</T>}>
        <StudioSelect
          ariaLabel='Image source'
          onValueChange={(value) => {
            const asset = library.find(({ id }) => id === value);
            if (asset) commit((current) => setLayerAsset(current, element.id, { libraryAssetId: asset.id, name: asset.label, prefix: 'image', source: asset.path }), { label: gt('Replace image') });
          }}
          options={[{ label: gt('Uploaded or custom'), value: '' }, ...library.map((asset) => ({ label: asset.label, value: asset.id }))]}
          value={dataString(element, 'libraryAssetId')}
        />
      </Field>
      <UploadField accept='image/*,.svg' label='Replace image' onFile={(file) => {
        void readFileAsAsset(file).then(({ name, url }) => commit((current) => setLayerAsset(current, element.id, { name, prefix: 'upload', source: url }), { label: gt('Replace image') }));
      }} />
      <div className='grid grid-cols-2 gap-2'>
        <Field label={<T>Fit</T>}>
          <StudioSelect ariaLabel='Image fit' onValueChange={(value) => commit((current) => {
            const latest = current.elements[element.id];
            return latest?.imageTreatment ? patchElement(current, element.id, { imageTreatment: { ...latest.imageTreatment, objectFit: value as 'contain' | 'cover' | 'fill' } }) : current;
          }, { label: gt('Image fit') })} options={[{ label: 'Fill frame', value: 'cover' }, { label: 'Fit inside', value: 'contain' }, { label: 'Stretch', value: 'fill' }]} value={fit} />
        </Field>
        <Field label={<T>Treatment</T>}>
          <StudioSelect ariaLabel='Image treatment' onValueChange={(value) => update({ data: { treatment: value } })} options={[{ label: 'Natural', value: 'natural' }, { label: 'Monochrome', value: 'monochrome' }, { label: 'Duotone', value: 'duotone' }, { label: 'Brand duotone', value: 'brand' }]} value={dataString(element, 'treatment', 'natural')} />
        </Field>
      </div>
      <RangeField label={<T>Image zoom</T>} max={300} min={50} onChange={(value) => update({ data: { zoom: value / 100 } }, 'zoom')} suffix='%' value={Math.round(dataNumber(element, 'zoom', 1) * 100)} />
      <RangeField label={<T>Image horizontal</T>} max={100} min={-100} onChange={(value) => update({ data: { panX: value / 100 } }, 'panX')} suffix='%' value={Math.round(dataNumber(element, 'panX', 0) * 100)} />
      <RangeField label={<T>Image vertical</T>} max={100} min={-100} onChange={(value) => update({ data: { panY: value / 100 } }, 'panY')} suffix='%' value={Math.round(dataNumber(element, 'panY', 0) * 100)} />
      <RangeField label={<T>Corner radius</T>} max={200} min={0} onChange={(value) => update({ radius: value }, 'radius')} suffix='px' value={element.style.borderRadius} />
    </ControlSection>
  );
}

function LogoSection({ commit, element, identity }: InspectorProps & { element: CanvasElement }) {
  const gt = useGT();
  const update = useUpdate({ commit, identity }, element);
  const logos = identity.assets.filter(({ type }) => type === 'logo' || type === 'icon');
  const appearance = element.data.appearance && typeof element.data.appearance === 'object' && !Array.isArray(element.data.appearance)
    ? { ...DEFAULT_LOGO_APPEARANCE, ...(element.data.appearance as Partial<LogoAppearanceSettings>) }
    : null;
  return (
    <ControlSection title={<T>Logo</T>}>
      <Field label={<T>Logo artwork</T>}>
        <StudioSelect
          ariaLabel='Logo artwork'
          onValueChange={(value) => {
            const asset = logos.find(({ id }) => id === value);
            if (asset) commit((current) => setLayerAsset(current, element.id, { libraryAssetId: asset.id, name: asset.label, prefix: 'logo', source: asset.path }), { label: gt('Replace logo') });
          }}
          options={[{ label: gt('Uploaded or custom'), value: '' }, ...logos.map((asset) => ({ label: asset.label, value: asset.id }))]}
          value={dataString(element, 'libraryAssetId')}
        />
      </Field>
      <UploadField accept='image/*,.svg' label='Replace logo artwork' onFile={(file) => {
        void readFileAsAsset(file).then(({ name, url }) => commit((current) => setLayerAsset(current, element.id, { name, prefix: 'upload', source: url }), { label: gt('Replace logo') }));
      }} />
      <Field label={<T>Tone</T>}>
        <StudioSelect
          ariaLabel='Logo tone'
          onValueChange={(value) => update({ data: { tone: value } })}
          options={[{ label: gt('Original colors'), value: 'original' }, ...colorRoleOptions(identity).filter(({ value }) => value !== 'custom')]}
          value={dataString(element, 'tone', 'original')}
        />
      </Field>
      <label className='flex items-center gap-2 text-sm'>
        <StudioCheckbox aria-label={gt('Logo effects')} checked={Boolean(appearance)} onChange={(event) => update({ data: { appearance: event.target.checked ? { ...DEFAULT_LOGO_APPEARANCE } : undefined } })} />
        <T>Logo effects</T>
      </label>
      {appearance ? (
        <LogoAppearanceControls onChange={(patch) => update({ data: { appearance: { ...appearance, ...patch } } }, 'appearance')} settings={appearance} />
      ) : null}
    </ControlSection>
  );
}

function ShapeSection({ commit, element, identity }: InspectorProps & { element: CanvasElement }) {
  const update = useUpdate({ commit, identity }, element);
  const shape = dataString(element, 'shape', 'rect');
  return (
    <ControlSection title={<T>Shape</T>}>
      <Field label={<T>Shape</T>}>
        <StudioSelect ariaLabel='Shape type' onValueChange={(value) => update({ data: { shape: value } })} options={[{ label: 'Rectangle', value: 'rect' }, { label: 'Ellipse', value: 'ellipse' }, { label: 'Line', value: 'line' }]} value={shape} />
      </Field>
      <ColorRoleField ariaLabel='Shape fill' identity={identity} label='Fill' none onChange={(value) => update({ fill: value }, 'fill')} value={dataString(element, 'fill', 'ink')} />
      {shape !== 'line' ? (
        <ColorRoleField ariaLabel='Shape stroke' identity={identity} label='Stroke' none onChange={(value) => update({ data: { stroke: value, strokeWidth: Math.max(1, dataNumber(element, 'strokeWidth', 1)) } }, 'stroke')} value={dataString(element, 'stroke', 'none')} />
      ) : null}
      <RangeField label={<T>Stroke width</T>} max={24} min={0} onChange={(value) => update({ data: { strokeWidth: value } }, 'strokeWidth')} step={0.5} suffix='px' value={dataNumber(element, 'strokeWidth', shape === 'line' ? 1 : 0)} />
      {shape === 'rect' ? <RangeField label={<T>Corner radius</T>} max={400} min={0} onChange={(value) => update({ radius: value }, 'radius')} suffix='px' value={element.style.borderRadius} /> : null}
    </ControlSection>
  );
}

function ShaderSection({ commit, element, identity }: InspectorProps & { element: CanvasElement }) {
  const gt = useGT();
  const update = useUpdate({ commit, identity }, element);
  const materialId = (dataString(element, 'materialId') || SHADER_LIBRARY_DEFAULT_IDS.surface) as LiveMaterialId;
  return (
    <ControlSection title={<T>Shader</T>}>
      <p className={styles.hint}><T>Shader backgrounds use the Shader Library's captured still, so the export matches the canvas exactly.</T></p>
      <Field label={<T>Tint</T>}>
        <StudioSelect ariaLabel='Shader tint' onValueChange={(value) => update({ data: { tint: value } })} options={[{ label: 'Original colors', value: 'none' }, { label: 'Brand duotone', value: 'brand' }]} value={dataString(element, 'tint', 'none')} />
      </Field>
      <ShaderLibraryBrowser
        activeMaterialId={materialId}
        compact
        limit={12}
        onSelect={(next) => commit((current) => updateExpressionLayer(
          setLayerAsset(current, element.id, { libraryAssetId: next, name: next, prefix: 'shader', source: shaderPreviewAssetPath(next) }),
          element.id,
          { data: { materialId: next } },
          identity
        ), { label: gt('Change shader') })}
      />
    </ControlSection>
  );
}

function TextureSection({ commit, element, identity }: InspectorProps & { element: CanvasElement }) {
  const update = useUpdate({ commit, identity }, element);
  return (
    <ControlSection title={<T>Texture</T>}>
      <Field label={<T>Pattern</T>}>
        <StudioSelect ariaLabel='Texture pattern' onValueChange={(value) => update({ data: { texture: value } })} options={[{ label: 'Grid', value: 'grid' }, { label: 'Dots', value: 'dots' }, { label: 'Lines', value: 'lines' }, { label: 'Diagonal', value: 'diagonal' }, { label: 'Noise', value: 'noise' }]} value={dataString(element, 'texture', 'grid')} />
      </Field>
      <ColorRoleField ariaLabel='Texture color' identity={identity} label='Color' onChange={(value) => update({ fill: value }, 'fill')} value={dataString(element, 'fill', 'ink')} />
      <RangeField label={<T>Texture spacing</T>} max={160} min={4} onChange={(value) => update({ data: { spacing: value } }, 'spacing')} suffix='px' value={dataNumber(element, 'spacing', 40)} />
    </ControlSection>
  );
}

function DeviceSection({ commit, element, identity }: InspectorProps & { element: CanvasElement }) {
  const update = useUpdate({ commit, identity }, element);
  return (
    <ControlSection title={<T>Brand device</T>}>
      <Field label={<T>Device</T>}>
        <StudioSelect ariaLabel='Brand device' onValueChange={(value) => update({ data: { device: value } })} options={EXPRESSION_DEVICES.map(({ id, label }) => ({ label, value: id }))} value={dataString(element, 'device')} />
      </Field>
    </ControlSection>
  );
}

function CodeWindowSection({ commit, element, identity }: InspectorProps & { element: CanvasElement }) {
  const gt = useGT();
  const update = useUpdate({ commit, identity }, element);
  return (
    <ControlSection title={<T>Code window</T>}>
      <div className='grid grid-cols-2 gap-2'>
        <Field label={<T>Theme</T>}>
          <StudioSelect ariaLabel='Code theme' onValueChange={(value) => update({ data: { theme: value } })} options={CODE_THEMES.map(({ id, label }) => ({ label, value: id }))} value={dataString(element, 'theme', 'brand-dark')} />
        </Field>
        <Field label={<T>Chrome</T>}>
          <StudioSelect ariaLabel='Window chrome' onValueChange={(value) => update({ data: { chrome: value } })} options={[{ label: 'File tabs', value: 'tabs' }, { label: 'Window', value: 'window' }, { label: 'None', value: 'none' }]} value={dataString(element, 'chrome', 'tabs')} />
        </Field>
      </div>
      <label className='flex items-center gap-2 text-sm'>
        <StudioCheckbox aria-label={gt('Show line numbers')} checked={dataBoolean(element, 'lineNumbers', true)} onChange={(event) => update({ data: { lineNumbers: event.target.checked } })} />
        <T>Line numbers</T>
      </label>
      <RangeField label={<T>Code size</T>} max={48} min={9} onChange={(value) => update({ fontSize: value }, 'size')} suffix='px' value={Math.round(element.textStyle?.fontSize ?? 18)} />
      <RangeField label={<T>Code line height</T>} max={240} min={100} onChange={(value) => update({ lineHeight: value / 100 }, 'lineHeight')} step={2} suffix='%' value={Math.round((element.textStyle?.lineHeight ?? 1.6) * 100)} />
      <RangeField label={<T>Window radius</T>} max={64} min={0} onChange={(value) => update({ radius: value }, 'radius')} suffix='px' value={element.style.borderRadius} />
    </ControlSection>
  );
}

function ChartSection({ commit, element, identity }: InspectorProps & { element: CanvasElement }) {
  const gt = useGT();
  const update = useUpdate({ commit, identity }, element);
  return (
    <ControlSection title={<T>Chart</T>}>
      <Field label={<T>Values · comma separated</T>}>
        <input aria-label={gt('Chart values')} className={INPUT_CLASS} onChange={(event) => update({ data: { values: event.target.value.split(',').map(Number).filter(Number.isFinite) } }, 'values')} value={readNumberArray(element, 'values').join(', ')} />
      </Field>
      <Field label={<T>Labels · comma separated</T>}>
        <input aria-label={gt('Chart labels')} className={INPUT_CLASS} onChange={(event) => update({ data: { labels: event.target.value.split(',').map((label) => label.trim()) } }, 'labels')} value={readStringArray(element, 'labels').join(', ')} />
      </Field>
      <ColorRoleField ariaLabel='Chart color' identity={identity} label='Bars' onChange={(value) => update({ fill: value }, 'fill')} value={dataString(element, 'fill', 'ink')} />
    </ControlSection>
  );
}

export function SelectionInspector(props: InspectorProps & { selection: readonly string[] }) {
  const gt = useGT();
  const elements = props.selection.flatMap((id) => props.document.elements[id] ? [props.document.elements[id]!] : []);
  if (elements.length === 0) return null;
  if (elements.length > 1) {
    const ids = elements.map(({ id }) => id);
    return (
      <ControlSection title={<T>Selection</T>}>
        <p className={styles.hint}>{gt('{count} layers selected', { count: elements.length })}</p>
        <div aria-label={gt('Align selection to artboard')} className={styles.iconRow} role='group'>
          {ALIGNMENTS.map(({ icon: Icon, label, value }) => (
            <Button aria-label={gt(label.replace('layer', 'selection'))} key={value} onClick={() => props.commit((current) => alignExpressionLayers(current, ids, value), { label: gt('Align selection') })} size='icon-sm' type='button' variant='ghost'>
              <Icon aria-hidden='true' />
            </Button>
          ))}
        </div>
        <div className={styles.iconRow}>
          <Button onClick={() => props.actions.duplicate(ids)} size='sm' type='button' variant='outline'><Copy aria-hidden='true' /><T>Duplicate selection</T></Button>
          <Button onClick={() => props.actions.remove(ids)} size='sm' type='button' variant='outline'><Trash2 aria-hidden='true' /><T>Delete selection</T></Button>
        </div>
      </ControlSection>
    );
  }
  const element = elements[0]!;
  const component = elementComponent(element);
  return (
    <>
      <LayerSection {...props} element={element} />
      {element.kind === 'text' ? <TextSection {...props} element={element} /> : null}
      {element.kind === 'image' ? <ImageSection {...props} element={element} /> : null}
      {element.kind === 'logo' ? <LogoSection {...props} element={element} /> : null}
      {element.kind === 'shape' || element.kind === 'line' ? <ShapeSection {...props} element={element} /> : null}
      {element.kind === 'shader' ? <ShaderSection {...props} element={element} /> : null}
      {element.kind === 'texture' ? <TextureSection {...props} element={element} /> : null}
      {component === 'device' ? <DeviceSection {...props} element={element} /> : null}
      {component === 'code' ? <CodeWindowSection {...props} element={element} /> : null}
      {component === 'chart' ? <ChartSection {...props} element={element} /> : null}
    </>
  );
}
