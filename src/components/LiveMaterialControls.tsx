'use client';

import { T, useGT } from 'gt-next';

import { LiveMaterialOptionLabel } from '@/components/LiveMaterialSourceLabel';
import MaterialPalettePresets from '@/components/MaterialPalettePresets';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import type { BrandIdentity } from '@/lib/brandIdentity';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  LIVE_MATERIAL_LOOK_PRESETS,
  LIVE_MATERIAL_OPTIONS,
  liveMaterialLookPreset,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';

const MATERIAL_CONTROLS = [
  { key: 'strength', label: 'Strength', max: 2, min: 0, step: 0.01 },
  { key: 'detail', label: 'Detail', max: 8, min: 0.5, step: 0.1 },
  { key: 'frequency', label: 'Frequency', max: 10, min: 0.2, step: 0.1 },
  { key: 'amplitude', label: 'Amplitude', max: 8, min: 0, step: 0.1 },
  { key: 'density', label: 'Density', max: 2, min: 0.1, step: 0.05 },
] as const;

const FINISH_CONTROLS = [
  { key: 'brightness', label: 'Brightness', max: 2, min: 0.1, step: 0.05, unit: '×' },
  { key: 'grain', label: 'Grain', max: 100, min: 0, step: 1, unit: '%' },
] as const;

const ORIENTATION_CONTROLS = [
  { key: 'rotationX', label: 'Rotation X' },
  { key: 'rotationY', label: 'Rotation Y' },
  { key: 'rotationZ', label: 'Rotation Z' },
] as const;

function valuesMatch(left: number, right: number) {
  return Math.abs(left - right) < 0.001;
}

function selectedLookId(materialId: LiveMaterialId, settings: LiveMaterialSettings) {
  return LIVE_MATERIAL_LOOK_PRESETS.find((preset) =>
    preset.materialId === materialId
    && Object.entries(preset.settings).every(([key, value]) => {
      const current = settings[key as keyof LiveMaterialSettings];
      return typeof value === 'number' && typeof current === 'number'
        ? valuesMatch(value, current)
        : value === current;
    })
  )?.id ?? 'custom';
}

function MaterialRange({
  label,
  max,
  min,
  onChange,
  step,
  unit = '',
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
}) {
  const precision = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  return (
    <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
      <span className='flex items-center justify-between gap-3'>
        <span>{label}</span>
        <output className='text-xs tabular-nums'>{value.toFixed(precision)}{unit}</output>
      </span>
      <input
        className='studio-range'
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type='range'
        value={value}
      />
    </label>
  );
}

export default function LiveMaterialControls({
  identity,
  materialId,
  onMaterialIdChange,
  onSettingsChange,
  settings,
}: {
  identity: Pick<BrandIdentity, 'colors' | 'id' | 'name' | 'shortName'>;
  materialId: LiveMaterialId;
  onMaterialIdChange: (materialId: LiveMaterialId) => void;
  onSettingsChange: (settings: LiveMaterialSettings) => void;
  settings: LiveMaterialSettings;
}) {
  const gt = useGT();
  const resolvedSettings = { ...DEFAULT_LIVE_MATERIAL_SETTINGS, ...settings };
  const activeLookId = selectedLookId(materialId, resolvedSettings);
  const activeLook = liveMaterialLookPreset(activeLookId);

  function update(patch: Partial<LiveMaterialSettings>) {
    onSettingsChange({ ...resolvedSettings, ...patch });
  }

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
        <T>Look preset</T>
        <StudioSelect
          ariaLabel={gt('Material look preset')}
          onValueChange={(value) => {
            const preset = liveMaterialLookPreset(value);
            if (!preset) return;
            onMaterialIdChange(preset.materialId);
            update(preset.settings);
          }}
          options={[
            ...(activeLookId === 'custom' ? [{ label: gt('Custom'), value: 'custom' }] : []),
            ...LIVE_MATERIAL_LOOK_PRESETS.map((preset) => ({
              label: gt(preset.name),
              value: preset.id,
            })),
          ]}
          value={activeLookId}
        />
        {activeLook ? <p className='text-xs leading-5'>{gt(activeLook.description)}</p> : null}
      </div>

      <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
        <T>Material</T>
        <StudioSelect
          ariaLabel={gt('Live material')}
          onValueChange={(value) => onMaterialIdChange(value as LiveMaterialId)}
          options={LIVE_MATERIAL_OPTIONS.map((material) => ({
            label: <LiveMaterialOptionLabel material={material} />,
            value: material.id,
          }))}
          value={materialId}
        />
      </div>

      <div className='flex flex-col gap-3 border-t border-border pt-4'>
        <div>
          <p className='text-sm font-medium'><T>Color system</T></p>
          <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Start from the active brand or apply a reusable material palette.</T></p>
        </div>
        <MaterialPalettePresets
          identity={identity}
          onSelect={([colorA, colorB, colorC]) => update({ colorA, colorB, colorC })}
          value={[resolvedSettings.colorA, resolvedSettings.colorB, resolvedSettings.colorC]}
        />
        {(['colorA', 'colorB', 'colorC'] as const).map((key, index) => (
          <ColorControl
            ariaLabel={gt('Material color {number}', { number: index + 1 })}
            key={key}
            label={gt('Color {number}', { number: index + 1 })}
            onChange={(value) => update({ [key]: value })}
            value={resolvedSettings[key]}
          />
        ))}
      </div>

      <div className='flex flex-col gap-3 border-t border-border pt-4'>
        <p className='text-sm font-medium'><T>Form</T></p>
        {MATERIAL_CONTROLS.map(({ key, label, max, min, step }) => (
          <MaterialRange key={key} label={gt(label)} max={max} min={min} onChange={(value) => update({ [key]: value })} step={step} value={resolvedSettings[key]} />
        ))}
      </div>

      <div className='flex flex-col gap-3 border-t border-border pt-4'>
        <p className='text-sm font-medium'><T>Light and texture</T></p>
        {FINISH_CONTROLS.map(({ key, label, max, min, step, unit }) => (
          <MaterialRange key={key} label={gt(label)} max={max} min={min} onChange={(value) => update({ [key]: value })} step={step} unit={unit} value={resolvedSettings[key]} />
        ))}
      </div>

      <div className='flex flex-col gap-3 border-t border-border pt-4'>
        <p className='text-sm font-medium'><T>Orientation</T></p>
        {ORIENTATION_CONTROLS.map(({ key, label }) => (
          <MaterialRange key={key} label={gt(label)} max={360} min={0} onChange={(value) => update({ [key]: value })} step={1} unit='°' value={resolvedSettings[key]} />
        ))}
      </div>

      <div className='flex flex-col gap-3 border-t border-border pt-4'>
        <p className='text-sm font-medium'><T>Motion</T></p>
        <MaterialRange label={gt('Speed')} max={2} min={0} onChange={(speed) => update({ speed })} step={0.05} unit='×' value={resolvedSettings.speed} />
      </div>
    </div>
  );
}
