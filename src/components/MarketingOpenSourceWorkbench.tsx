'use client';

import Image from 'next/image';
import { T } from 'gt-next';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import MarketingArcField from '@/components/MarketingArcField';
import MitLogo from '@/components/MitLogo';
import StudioRange from '@/components/ui/StudioRange';
import { hexToHsv, hsvToHex, normalizeHex, normalizeHexOrFallback } from '@/lib/color';
import type { LiveMaterialId, LiveMaterialSettings } from '@/lib/liveMaterials';

type ShaderColorRole = 'colorA' | 'colorB' | 'colorC';
type SpectrumBounds = Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>;

const SHADER_COLOR_ROLES = [
  { label: 'Base', meta: 'A', role: 'colorA' },
  { label: 'Accent', meta: 'B', role: 'colorB' },
  { label: 'Light', meta: 'C', role: 'colorC' },
] as const satisfies readonly { label: string; meta: string; role: ShaderColorRole }[];

const SHADER_COLOR_DEBOUNCE_MS = 140;

function rolePresentation(role: ShaderColorRole) {
  return SHADER_COLOR_ROLES.find((option) => option.role === role)!;
}

export default function MarketingOpenSourceWorkbench({
  markPath,
  materialId,
  settings,
}: {
  markPath: string;
  materialId: LiveMaterialId;
  settings: LiveMaterialSettings;
}) {
  const [selectedRole, setSelectedRole] = useState<ShaderColorRole>('colorB');
  const [colors, setColors] = useState(() => ({
    colorA: normalizeHexOrFallback(settings.colorA, '#401B45'),
    colorB: normalizeHexOrFallback(settings.colorB, '#FF9B75'),
    colorC: normalizeHexOrFallback(settings.colorC, '#FFD08F'),
  }));
  const [shaderColors, setShaderColors] = useState(colors);
  const pendingColorRef = useRef<{ color: string; role: ShaderColorRole } | null>(null);
  const colorFrameRef = useRef(0);
  const activePointerRef = useRef<number | null>(null);
  const spectrumBoundsRef = useRef<SpectrumBounds | null>(null);
  const hexInputRef = useRef<HTMLInputElement>(null);
  const activeColor = colors[selectedRole];
  const activeHsv = hexToHsv(activeColor);
  const activeRole = rolePresentation(selectedRole);
  const shaderSettings = useMemo(() => ({ ...settings, ...shaderColors }), [settings, shaderColors]);
  const outputColorStyle = {
    '--marketing-v14-light-color': shaderColors.colorC,
  } as CSSProperties;

  useEffect(() => () => cancelAnimationFrame(colorFrameRef.current), []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShaderColors(colors), SHADER_COLOR_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [colors]);

  useEffect(() => {
    const input = hexInputRef.current;
    if (input && document.activeElement !== input) input.value = activeColor;
  }, [activeColor, selectedRole]);

  function applyColor(role: ShaderColorRole, color: string) {
    setColors((current) => current[role] === color ? current : { ...current, [role]: color });
  }

  function flushColorPreview() {
    cancelAnimationFrame(colorFrameRef.current);
    colorFrameRef.current = 0;
    const pending = pendingColorRef.current;
    pendingColorRef.current = null;
    if (pending) applyColor(pending.role, pending.color);
  }

  function commitColorPreviewFrame() {
    colorFrameRef.current = 0;
    const pending = pendingColorRef.current;
    pendingColorRef.current = null;
    if (!pending) return;
    applyColor(pending.role, pending.color);
  }

  function scheduleColorPreview(color: string) {
    pendingColorRef.current = {
      color: normalizeHexOrFallback(color, activeColor),
      role: selectedRole,
    };
    if (colorFrameRef.current) return;
    colorFrameRef.current = requestAnimationFrame(commitColorPreviewFrame);
  }

  function updateSaturationAndValue(clientX: number, clientY: number, bounds: SpectrumBounds) {
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const saturation = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    const value = Math.max(0, Math.min(1, 1 - (clientY - bounds.top) / bounds.height));
    scheduleColorPreview(hsvToHex(activeHsv.hue, saturation, value));
  }

  function handleSpectrumPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== null) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    activePointerRef.current = event.pointerId;
    spectrumBoundsRef.current = bounds;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSaturationAndValue(event.clientX, event.clientY, bounds);
  }

  function handleSpectrumPointerMove(event: PointerEvent<HTMLDivElement>) {
    const bounds = spectrumBoundsRef.current;
    if (activePointerRef.current !== event.pointerId || !bounds) return;
    updateSaturationAndValue(event.clientX, event.clientY, bounds);
  }

  function finishSpectrumGesture(event: PointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    spectrumBoundsRef.current = null;
    flushColorPreview();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleSpectrumKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.1 : 0.02;
    let saturation = activeHsv.saturation;
    let value = activeHsv.value;
    if (event.key === 'ArrowLeft') saturation -= step;
    else if (event.key === 'ArrowRight') saturation += step;
    else if (event.key === 'ArrowUp') value += step;
    else if (event.key === 'ArrowDown') value -= step;
    else return;
    event.preventDefault();
    applyColor(selectedRole, hsvToHex(activeHsv.hue, saturation, value));
  }

  function commitHex(input: HTMLInputElement) {
    try {
      applyColor(selectedRole, normalizeHex(input.value));
    } catch {
      input.value = activeColor;
    }
  }

  return (
    <div className='marketing-v14-open-source-workbench'>
      <aside aria-label='Shader color controls' className='marketing-v14-control-panel marketing-v14-control-panel--dark marketing-v14-color-inspector'>
        <header><strong>SHADER PALETTE</strong><span>{activeRole.label.toUpperCase()} / {activeRole.meta}</span></header>
        <div aria-label='Shader color stop' className='marketing-v14-segmented-row' role='group'>
          {SHADER_COLOR_ROLES.map((option) => (
            <button
              aria-pressed={selectedRole === option.role}
              className={selectedRole === option.role ? 'is-active' : undefined}
              key={option.role}
              onClick={() => {
                flushColorPreview();
                setSelectedRole(option.role);
              }}
              type='button'
            >
              <i aria-hidden='true' style={{ backgroundColor: colors[option.role] }} />
              <T>{option.label}</T>
            </button>
          ))}
        </div>
        <label className='marketing-v14-color-field'>
          <i aria-hidden='true' style={{ backgroundColor: activeColor }} />
          <small>HEX</small>
          <input
            aria-label={`${activeRole.label} shader color`}
            defaultValue={activeColor}
            onBlur={(event) => commitHex(event.currentTarget)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            ref={hexInputRef}
            spellCheck={false}
          />
        </label>
        <div
          aria-label={`${activeRole.label} saturation and brightness`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(activeHsv.saturation * 100)}
          aria-valuetext={`${Math.round(activeHsv.saturation * 100)}% saturation, ${Math.round(activeHsv.value * 100)}% brightness`}
          className='marketing-v14-color-spectrum'
          onKeyDown={handleSpectrumKeyDown}
          onLostPointerCapture={finishSpectrumGesture}
          onPointerCancel={finishSpectrumGesture}
          onPointerDown={handleSpectrumPointerDown}
          onPointerMove={handleSpectrumPointerMove}
          onPointerUp={finishSpectrumGesture}
          role='slider'
          style={{ backgroundColor: `hsl(${activeHsv.hue} 100% 50%)` }}
          tabIndex={0}
        >
          <i
            aria-hidden='true'
            style={{
              left: `clamp(7px, ${activeHsv.saturation * 100}%, calc(100% - 7px))`,
              top: `clamp(7px, ${(1 - activeHsv.value) * 100}%, calc(100% - 7px))`,
            }}
          />
        </div>
        <label className='marketing-v14-hue-row'>
          <b aria-hidden='true' style={{ backgroundColor: activeColor }} />
          <StudioRange
            aria-label={`${activeRole.label} hue`}
            max='360'
            min='0'
            onChange={(event) => scheduleColorPreview(hsvToHex(Number(event.currentTarget.value), activeHsv.saturation, activeHsv.value))}
            onPointerCancel={flushColorPreview}
            onPointerUp={flushColorPreview}
            value={Math.round(activeHsv.hue)}
          />
        </label>
        <div aria-live='polite' className='marketing-v14-hsv-row'>
          <span><small>H</small><output>{Math.round(activeHsv.hue)}°</output></span>
          <span><small>S</small><output>{Math.round(activeHsv.saturation * 100)}%</output></span>
          <span><small>V</small><output>{Math.round(activeHsv.value * 100)}%</output></span>
        </div>
      </aside>
      <div className='marketing-v7-open-source-panel'>
        <MarketingArcField
          className='marketing-v8-open-source-panel-material'
          materialId={materialId}
          maxPixelCount={320_000}
          renderScale={0.64}
          settings={shaderSettings}
        />
        <div className='marketing-v7-open-source-panel-content' style={outputColorStyle}>
          <MitLogo />
          <footer>
            <i><Image alt='' aria-hidden='true' height={32} src={markPath} width={32} /></i>
            <p><T>Studio source, agent API, and</T><br /><T>portable artifact schema.</T></p>
          </footer>
        </div>
      </div>
    </div>
  );
}
