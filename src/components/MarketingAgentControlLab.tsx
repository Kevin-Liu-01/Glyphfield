'use client';

import Image from 'next/image';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  Clock3,
  Maximize2,
  Rows3,
  ScanLine,
  Space,
  Sparkles,
  Weight,
} from '@/components/ui/SolidIcons';

import type { LucideIcon } from '@/components/ui/SolidIcons';

type ControlValues = {
  duration: number;
  fontSize: number;
  fontWeight: number;
  grain: number;
  letterSpacing: number;
  lineHeight: number;
  speed: number;
  strength: number;
};

type ControlKey = keyof ControlValues;
type CursorMotion = 'animate' | 'instant';
type AgentId = 'claude' | 'codex';

type ControlDefinition = {
  format: (value: number) => string;
  icon: LucideIcon;
  key: ControlKey;
  label: string;
  max: number;
  min: number;
  step: number;
};

type ControlGroup = {
  controls: readonly ControlDefinition[];
  id: string;
  label: string;
};

const INITIAL_VALUES: ControlValues = {
  duration: 1.6,
  fontSize: 40,
  fontWeight: 500,
  grain: 12,
  letterSpacing: -0.7,
  lineHeight: 0.98,
  speed: 0.34,
  strength: 0.68,
};

const CONTROL_GROUPS: readonly ControlGroup[] = [
  {
    controls: [
      { format: (value) => `${Math.round(value)}px`, icon: Maximize2, key: 'fontSize', label: 'Preview size', max: 72, min: 20, step: 1 },
      { format: (value) => value.toFixed(2), icon: Rows3, key: 'lineHeight', label: 'Line height', max: 1.3, min: 0.8, step: 0.01 },
    ],
    id: 'scale',
    label: 'Type scale',
  },
  {
    controls: [
      { format: (value) => String(Math.round(value)), icon: Weight, key: 'fontWeight', label: 'Weight', max: 800, min: 200, step: 50 },
      { format: (value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}px`, icon: Space, key: 'letterSpacing', label: 'Tracking', max: 2, min: -2, step: 0.1 },
    ],
    id: 'weight',
    label: 'Type weight',
  },
  {
    controls: [
      { format: (value) => `${Math.round(value * 100)}%`, icon: Sparkles, key: 'strength', label: 'Shader strength', max: 1, min: 0, step: 0.01 },
      { format: (value) => String(Math.round(value)), icon: ScanLine, key: 'grain', label: 'Grain', max: 20, min: 0, step: 1 },
    ],
    id: 'material',
    label: 'Material',
  },
  {
    controls: [
      { format: (value) => `${value.toFixed(2)}×`, icon: Clock3, key: 'speed', label: 'Motion speed', max: 1.2, min: 0.1, step: 0.01 },
      { format: (value) => `${value.toFixed(1)}s`, icon: Rows3, key: 'duration', label: 'Duration', max: 4, min: 0.6, step: 0.1 },
    ],
    id: 'motion',
    label: 'Motion',
  },
] as const;

const CONTROL_LOOKUP = new Map(
  CONTROL_GROUPS.flatMap(({ controls }) => controls).map((control) => [control.key, control])
);

const PAIRED_CONTROLS: Record<ControlKey, ControlKey> = {
  duration: 'speed',
  fontSize: 'lineHeight',
  fontWeight: 'letterSpacing',
  grain: 'strength',
  letterSpacing: 'fontWeight',
  lineHeight: 'fontSize',
  speed: 'duration',
  strength: 'grain',
};

const AGENTS = {
  claude: { icon: '/brand/agents/claude-code.svg', label: 'Claude' },
  codex: { icon: '/brand/agents/codex-openai.svg', label: 'Codex' },
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, places: number) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function pairedValue(source: ControlKey, value: number): number {
  switch (source) {
    case 'fontSize': return clamp(round(1.14 - (value - 20) * 0.006, 2), 0.8, 1.3);
    case 'lineHeight': return clamp(Math.round(58 - (value - 0.8) * 56), 20, 72);
    case 'fontWeight': return clamp(round(-0.2 - (value - 200) * 0.002, 1), -2, 2);
    case 'letterSpacing': return clamp(Math.round((450 - value * 175) / 50) * 50, 200, 800);
    case 'strength': return clamp(Math.round(value * 20), 0, 20);
    case 'grain': return clamp(round(value / 20, 2), 0, 1);
    case 'speed': return clamp(round(2.25 - value * 1.9, 1), 0.6, 4);
    case 'duration': return clamp(round((2.25 - value) / 1.9, 2), 0.1, 1.2);
  }
}

function JsonLine({ active = false, children, indent = 0 }: { active?: boolean; children: React.ReactNode; indent?: number }) {
  return (
    <span className='marketing-agent-json-line' data-active={active ? 'true' : 'false'} style={{ '--json-indent': indent } as React.CSSProperties}>
      {children}
    </span>
  );
}

function JsonProperty({ activeKey, comma = true, controlKey, name, value }: {
  activeKey: ControlKey;
  comma?: boolean;
  controlKey: ControlKey;
  name: string;
  value: number;
}) {
  return (
    <JsonLine active={activeKey === controlKey} indent={2}>
      <span className='marketing-agent-json-key'>&quot;{name}&quot;</span>
      <span>: </span>
      <strong>{value}</strong>
      {comma ? ',' : ''}
    </JsonLine>
  );
}

export default function MarketingAgentControlLab() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [activeAgent, setActiveAgent] = useState<AgentId>('codex');
  const [activeKey, setActiveKey] = useState<ControlKey>('lineHeight');
  const [cursorMotion, setCursorMotion] = useState<CursorMotion>('instant');
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const interactionMotionRef = useRef<CursorMotion>('instant');
  const labRef = useRef<HTMLDivElement>(null);
  const lastUserKeyRef = useRef<ControlKey | null>(null);

  const updateCursorPosition = useCallback(() => {
    const lab = labRef.current;
    const target = lab?.querySelector<HTMLElement>(`[data-control-key='${activeKey}']`);
    if (!lab || !target) return;
    const labRect = lab.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    setCursorPosition({
      x: targetRect.left - labRect.left + Math.min(targetRect.width * 0.62, targetRect.width - 76),
      y: targetRect.top - labRect.top + 8,
    });
  }, [activeKey]);

  useLayoutEffect(() => {
    updateCursorPosition();
  }, [updateCursorPosition]);

  useEffect(() => {
    const lab = labRef.current;
    if (!lab) return;
    const observer = new ResizeObserver(updateCursorPosition);
    observer.observe(lab);
    window.addEventListener('resize', updateCursorPosition);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateCursorPosition);
    };
  }, [updateCursorPosition]);

  function changeControl(key: ControlKey, value: number) {
    const pairedKey = PAIRED_CONTROLS[key];
    if (lastUserKeyRef.current !== key) {
      setActiveAgent((current) => current === 'codex' ? 'claude' : 'codex');
      lastUserKeyRef.current = key;
    }
    setValues((current) => ({
      ...current,
      [key]: value,
      [pairedKey]: pairedValue(key, value),
    }));
    setCursorMotion(interactionMotionRef.current);
    setActiveKey(pairedKey);
  }

  const activeDefinition = CONTROL_LOOKUP.get(activeKey)!;
  const activeAgentDefinition = AGENTS[activeAgent];

  return (
    <div className='marketing-agent-lab' ref={labRef}>
      <section className='marketing-agent-json' aria-label='Generated JSON contract'>
        <pre><code>
          <JsonLine>{'{'}</JsonLine>
          <JsonLine indent={1}><span className='marketing-agent-json-key'>&quot;type&quot;</span>: {'{'}</JsonLine>
          <JsonProperty activeKey={activeKey} controlKey='fontSize' name='size' value={values.fontSize} />
          <JsonProperty activeKey={activeKey} controlKey='fontWeight' name='weight' value={values.fontWeight} />
          <JsonProperty activeKey={activeKey} controlKey='lineHeight' name='leading' value={values.lineHeight} />
          <JsonProperty activeKey={activeKey} comma={false} controlKey='letterSpacing' name='tracking' value={values.letterSpacing} />
          <JsonLine indent={1}>{'},'}</JsonLine>
          <JsonLine indent={1}><span className='marketing-agent-json-key'>&quot;material&quot;</span>: {'{'}</JsonLine>
          <JsonProperty activeKey={activeKey} controlKey='strength' name='strength' value={values.strength} />
          <JsonProperty activeKey={activeKey} comma={false} controlKey='grain' name='grain' value={values.grain} />
          <JsonLine indent={1}>{'},'}</JsonLine>
          <JsonLine indent={1}><span className='marketing-agent-json-key'>&quot;motion&quot;</span>: {'{'}</JsonLine>
          <JsonProperty activeKey={activeKey} controlKey='speed' name='speed' value={values.speed} />
          <JsonProperty activeKey={activeKey} comma={false} controlKey='duration' name='duration' value={values.duration} />
          <JsonLine indent={1}>{'}'}</JsonLine>
          <JsonLine>{'}'}</JsonLine>
        </code></pre>
      </section>

      <div className='marketing-agent-control-groups'>
        {CONTROL_GROUPS.map((group) => (
          <fieldset className='marketing-agent-control-group' data-group={group.id} key={group.id}>
            <legend className='sr-only'>{group.label}</legend>
            <div className='marketing-agent-control-grid'>
              {group.controls.map(({ format, icon: Icon, key, label, max, min, step }) => (
                <label className='marketing-agent-control' data-control-key={key} key={key}>
                  <span><i><Icon aria-hidden='true' /></i><b>{label}</b><output>{format(values[key])}</output></span>
                  <input
                    aria-label={label}
                    max={max}
                    min={min}
                    onChange={(event) => changeControl(key, Number(event.target.value))}
                    onKeyDown={() => { interactionMotionRef.current = 'instant'; }}
                    onPointerDown={() => { interactionMotionRef.current = 'animate'; }}
                    step={step}
                    type='range'
                    value={values[key]}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div
        aria-hidden='true'
        className='marketing-agent-cursor'
        data-agent={activeAgent}
        data-motion={cursorMotion}
        style={{
          opacity: cursorPosition ? 1 : 0,
          transform: `translate3d(${cursorPosition?.x ?? 0}px, ${cursorPosition?.y ?? 0}px, 0)`,
        }}
      >
        <svg viewBox='0 0 18 22'><path d='M1 1.5 16 12l-7.1 1.1L5 20.5 1 1.5Z' /></svg>
        <span><Image alt='' height={13} src={activeAgentDefinition.icon} width={13} />{activeAgentDefinition.label}</span>
      </div>

      <span className='sr-only' aria-live='polite'>
        {activeAgentDefinition.label} updated {activeDefinition.label} to {activeDefinition.format(values[activeKey])}.
      </span>
    </div>
  );
}
