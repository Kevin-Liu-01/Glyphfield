'use client';

import { useState } from 'react';
import { normalizeHex } from '@/lib/color';
import ColorControl from './ui/ColorControl';
import StudioRange from './ui/StudioRange';
import StudioSelect from './ui/StudioSelect';
import StudioCheckbox from './ui/StudioCheckbox';
import { getShaderEffect, shaderEffectDefaults, validateShaderEffectProps, type ShaderEffectControl, type ShaderEffectProps, type ShaderEffectValue } from '@/lib/shaderEffects';

function parseStructuredValue(value: string): ShaderEffectValue {
  try { return JSON.parse(value); } catch { return value; }
}

function StructuredControl({ label, value, onChange }: { label: string; value: ShaderEffectValue; onChange: (value: ShaderEffectValue) => void }) {
  const [error, setError] = useState('');
  return <label className='flex flex-col gap-2 text-xs'>{label}
    <textarea key={JSON.stringify(value)} aria-label={label} className='min-h-20 rounded border border-border bg-background p-2 font-mono text-xs' defaultValue={JSON.stringify(value, null, 2)} onBlur={(event) => {
      try { onChange(JSON.parse(event.target.value)); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Invalid value'); }
    }} />
    {error ? <span role='alert'>{error}</span> : null}
  </label>;
}
function ListControl({ label, value, gradient, onChange }: { label: string; value: ShaderEffectValue; gradient: boolean; onChange: (value: ShaderEffectValue) => void }) {
  const items = Array.isArray(value) ? value : [];
  return <div className='flex flex-col gap-3 text-xs'><p>{label}</p>
    {items.map((item, index) => item && typeof item === 'object' && !Array.isArray(item) ? <fieldset key={index} className='flex flex-col gap-3 rounded border border-border p-3'><legend>{label} {index + 1}</legend>
      {Object.entries(item).map(([key, field]) => <NativeControl key={key} name={key} control={{ label: `${label} ${index + 1} ${key}`, type: key === 'color' ? 'color' : key === 'position' && typeof field === 'object' ? 'position' : undefined, ...(gradient && key === 'position' ? { min: 0, max: 1, step: 0.01 } : {}) }} value={field} onChange={(next) => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...item, [key]: next } : entry))} />)}
      {items.length > 1 ? <button type='button' className='text-left underline' onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Remove {index + 1}</button> : null}
    </fieldset> : null)}
    {items.length < 8 ? <button type='button' className='text-left underline' onClick={() => onChange([...items, gradient ? { color: '#FFFFFF', position: 1 } : structuredClone(items[0] ?? { position: { x: 0.5, y: 0.5 }, color: '#FFFFFF', intensity: 2 })])}>Add {gradient ? 'color stop' : 'light'}</button> : null}
    {gradient && items.length ? <button type='button' className='text-left underline' onClick={() => onChange(null)}>Use default gradient</button> : null}
  </div>;
}

function NativeColorControl({ label, value, onChange }: { label: string; value: ShaderEffectValue; onChange: (value: ShaderEffectValue) => void }) {
    const hex = String(value);
    const opacity = hex.length === 9 ? parseInt(hex.slice(7), 16) / 255 * 100 : 100;
    const color = hex.length === 9 ? hex.slice(0, 7) : normalizeHex(hex);
    const combine = (nextColor: string, alpha: number) => alpha >= 100 ? nextColor : `${nextColor}${Math.round(alpha / 100 * 255).toString(16).padStart(2, '0')}`;
    return <ColorControl ariaLabel={`Effect ${label}`} label={label} value={color} opacity={opacity} onOpacityChange={(alpha) => onChange(combine(color, alpha))} onChange={(next) => onChange(combine(next, opacity))} />;
}

function NativeControl({ name, control, value, onChange }: { name: string; control: ShaderEffectControl; value: ShaderEffectValue; onChange: (value: ShaderEffectValue) => void }) {
  const types = [control.type].flat();
  const label = control.label ?? name;
  if (types.some((type) => type === 'gradient-stops' || type === 'list')) return <ListControl label={label} value={value} gradient={types.includes('gradient-stops')} onChange={onChange} />;
  if (types.includes('local-image')) return <label className='flex flex-col gap-2 text-xs'>{label}<input type='file' aria-label='Effect source image' accept='image/png,image/jpeg,image/webp' onChange={(event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 12_000_000) { event.target.setCustomValidity('Choose an image under 12 MB.'); event.target.reportValidity(); return; }
    event.target.setCustomValidity('');
    const reader = new FileReader();
    reader.onload = () => {
      try { onChange(String(reader.result)); } catch (cause) { input.setCustomValidity(cause instanceof Error ? cause.message : 'Could not import image.'); input.reportValidity(); }
    };
    reader.readAsDataURL(file);
  }} />{value ? <button type='button' className='text-left underline' onClick={() => onChange('')}>Use default source</button> : null}</label>;
  if (types.includes('color')) return <NativeColorControl label={label} value={value} onChange={onChange} />;
  if (control.options?.length) return <label className='flex flex-col gap-2 text-xs'>{label}<StudioSelect ariaLabel={`Effect ${label}`} value={String(value)} options={control.options.map((option) => ({ label: option.label, value: String(option.value) }))} onValueChange={(next) => onChange(control.options!.find((option) => String(option.value) === next)!.value)} /></label>;
  if (typeof value === 'boolean') return <label className='flex items-center justify-between gap-3 text-xs'>{label}<StudioCheckbox aria-label={`Effect ${label}`} checked={value} onChange={(event) => onChange(event.target.checked)} /></label>;
  if (typeof value === 'number') return <label className='flex flex-col gap-2 text-xs'><span className='flex justify-between gap-2'>{label}<output>{Number(value.toFixed(3))}</output></span><StudioRange aria-label={`Effect ${label}`} min={control.min ?? 0} max={control.max ?? Math.max(100, value * 2)} step={control.step ?? 0.01} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
  if (types.includes('position') && value && !Array.isArray(value) && typeof value === 'object') return <div className='flex flex-col gap-3'>{['x', 'y'].map((axis) => <NativeControl key={axis} name={`${name} ${axis}`} control={{ label: `${label} ${axis.toUpperCase()}`, min: -1, max: 2, step: 0.01 }} value={value[axis]} onChange={(next) => onChange({ ...value, [axis]: next })} />)}</div>;
  if (typeof value === 'string' && !types.some((type) => type === 'shape' || type === 'shape3d')) return <label className='flex flex-col gap-2 text-xs'>{label}<input aria-label={`Effect ${label}`} className='min-w-0 rounded border border-border bg-background p-2' value={value} onChange={(event) => onChange(event.target.value)} /></label>;
  if (typeof value === 'string') return <StructuredControl label={`Effect ${label}`} value={parseStructuredValue(value)} onChange={(next) => onChange(JSON.stringify(next))} />;
  return <StructuredControl label={`Effect ${label}`} value={value} onChange={onChange} />;
}

export default function ShaderEffectsControls({ materialId, value, onChange }: { materialId: string; value?: ShaderEffectProps; onChange: (value: ShaderEffectProps) => void }) {
  const effect = getShaderEffect(materialId);
  if (!effect) return null;
  const props = { ...shaderEffectDefaults(materialId), ...value };
  const controls = Object.entries(effect.props).filter(([name, control]) => props[name] !== undefined
    && !['shapeType', 'shapeSdfUrl'].includes(name)
    && !(props.surface === 'canvas' && (control.group === 'Shape' || control.group === 'Position')));
  const groups = [...new Set(controls.map(([, control]) => control.group ?? 'Effect'))];
  return <div className='flex flex-col gap-4'>
    <p className='text-xs leading-5 text-muted-foreground'>Shaders.com · {effect.category} · WebGPU{effect.requiresChild ? '. Applies to your image, or a flowing shader gradient when no image is attached.' : ''}</p>
    {groups.map((group) => <details open key={group} className='border-t border-border pt-3'><summary className='cursor-pointer text-xs font-medium'>{group}</summary><div className='flex flex-col gap-4 pt-4'>
      {controls.filter(([, control]) => (control.group ?? 'Effect') === group).map(([name, control]) => <NativeControl key={name} name={name} control={control} value={props[name]} onChange={(next) => onChange(validateShaderEffectProps(materialId, { ...props, [name]: next }))} />)}
    </div></details>)}
    <button className='text-left text-xs underline underline-offset-4' type='button' onClick={() => onChange(shaderEffectDefaults(materialId))}>Reset effect settings</button>
  </div>;
}
