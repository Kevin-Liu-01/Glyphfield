'use client';

import Image from 'next/image';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import StudioRange from '@/components/ui/StudioRange';
import {
  Clock3,
  Maximize2,
  Rows3,
  ScanLine,
  Space,
  Sparkles,
  Weight,
} from '@/components/ui/SolidIcons';
import { DEFAULT_LIVE_MATERIAL_SETTINGS, type LiveMaterialSettings } from '@/lib/liveMaterials';

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
type AgentPhase = 'dragging' | 'grabbing' | 'idle' | 'moving' | 'releasing';

type AgentCursorPosition = {
  angle: number;
  x: number;
  y: number;
};

type CursorTrackGeometry = {
  max: number;
  min: number;
  width: number;
  x: number;
  y: number;
};

type ConnectorPath = {
  end: { x: number; y: number };
  key: ControlKey;
  path: string;
  start: { x: number; y: number };
};

type PreviewConnector = {
  end: { x: number; y: number };
  path: string;
  start: { x: number; y: number };
};

type AgentSceneGeometry = {
  connectors: ConnectorPath[];
  cursorTracks: Partial<Record<ControlKey, CursorTrackGeometry>>;
  cursors: Record<AgentId, AgentCursorPosition | null>;
  height: number;
  previewConnector: PreviewConnector | null;
  width: number;
};

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

const AUTONOMOUS_CONTROL_STEPS = [
  { agent: 'codex', key: 'fontSize', values: [46, 54] },
  { agent: 'claude', key: 'fontWeight', values: [450, 600] },
  { agent: 'codex', key: 'lineHeight', values: [0.92, 1.04] },
  { agent: 'claude', key: 'letterSpacing', values: [-0.9, -0.2] },
  { agent: 'codex', key: 'strength', values: [0.54, 0.78] },
  { agent: 'claude', key: 'grain', values: [7, 16] },
  { agent: 'codex', key: 'speed', values: [0.26, 0.52] },
  { agent: 'claude', key: 'duration', values: [1.4, 2.2] },
] as const satisfies readonly {
  agent: AgentId;
  key: ControlKey;
  values: readonly [number, number];
}[];

const AUTONOMOUS_STEP_INTERVAL_MS = 3_100;
const AGENT_TRAVEL_DURATION_MS = 720;
const AGENT_GRAB_DURATION_MS = 140;
const AGENT_DRAG_DURATION_MS = 860;
const AGENT_RELEASE_DURATION_MS = 180;
const USER_AUTOMATION_PAUSE_MS = 6_000;

const INITIAL_AGENT_TARGETS: Record<AgentId, ControlKey> = {
  claude: 'fontWeight',
  codex: 'lineHeight',
};

const INITIAL_AGENT_MOTIONS: Record<AgentId, CursorMotion> = {
  claude: 'instant',
  codex: 'instant',
};

const INITIAL_AGENT_PHASES: Record<AgentId, AgentPhase> = {
  claude: 'idle',
  codex: 'idle',
};

const EMPTY_SCENE_GEOMETRY: AgentSceneGeometry = {
  connectors: [],
  cursorTracks: {},
  cursors: { claude: null, codex: null },
  height: 0,
  previewConnector: null,
  width: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: number, min: number, max: number) {
  return clamp((value - min) / (max - min), 0, 1);
}

function interpolate(min: number, max: number, progress: number) {
  return min + (max - min) * progress;
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

function roundedOrthogonalPath(start: { x: number; y: number }, end: { x: number; y: number }): string {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  if (Math.abs(deltaY) < 1) {
    return `M ${round(start.x, 1)} ${round(start.y, 1)} H ${round(end.x, 1)}`;
  }

  const busX = round(start.x + deltaX * 0.5, 1);
  const verticalDirection = Math.sign(deltaY);
  const horizontalDirection = Math.sign(deltaX) || 1;
  const radius = Math.min(7, Math.abs(deltaX) * 0.22, Math.abs(deltaY) * 0.22);
  const roundedRadius = round(radius, 1);

  return [
    `M ${round(start.x, 1)} ${round(start.y, 1)}`,
    `H ${round(busX - roundedRadius * horizontalDirection, 1)}`,
    `Q ${busX} ${round(start.y, 1)} ${busX} ${round(start.y + roundedRadius * verticalDirection, 1)}`,
    `V ${round(end.y - roundedRadius * verticalDirection, 1)}`,
    `Q ${busX} ${round(end.y, 1)} ${round(busX + roundedRadius * horizontalDirection, 1)} ${round(end.y, 1)}`,
    `H ${round(end.x, 1)}`,
  ].join(' ');
}

function cubicBezierCoordinate(t: number, point1: number, point2: number): number {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * point1 + 3 * inverse * t * t * point2 + t * t * t;
}

function cubicBezierProgress(progress: number): number {
  const bounded = clamp(progress, 0, 1);
  let lower = 0;
  let upper = 1;
  let parameter = bounded;

  for (let index = 0; index < 12; index += 1) {
    parameter = (lower + upper) / 2;
    const x = cubicBezierCoordinate(parameter, 0.77, 0.175);
    if (x < bounded) lower = parameter;
    else upper = parameter;
  }

  return cubicBezierCoordinate(parameter, 0, 1);
}

function formattedJsonValue(key: ControlKey, value: number): string {
  switch (key) {
    case 'fontSize':
    case 'fontWeight':
    case 'grain':
      return String(Math.round(value));
    case 'lineHeight':
    case 'speed':
    case 'strength':
      return round(value, 2).toFixed(2);
    case 'duration':
    case 'letterSpacing':
      return round(value, 1).toFixed(1);
  }
}

function cursorAngle(previous: AgentCursorPosition | null, next: { x: number; y: number }): number {
  if (!previous) return 0;
  const deltaX = next.x - previous.x;
  const deltaY = next.y - previous.y;
  if (Math.abs(deltaX) + Math.abs(deltaY) < 2) return previous.angle;
  return Math.atan2(deltaY, deltaX) * 180 / Math.PI + 135;
}

function cursorPositionOnTrack(
  track: CursorTrackGeometry | undefined,
  value: number,
  fallback: AgentCursorPosition | null
): AgentCursorPosition | null {
  if (!track) return fallback;
  const progress = track.max === track.min ? 0 : (value - track.min) / (track.max - track.min);
  return {
    angle: fallback?.angle ?? 0,
    x: track.x + clamp(progress, 0, 1) * track.width,
    y: track.y,
  };
}

function JsonLine({ active = false, children, controlKey, indent = 0 }: {
  active?: boolean;
  children: React.ReactNode;
  controlKey?: ControlKey;
  indent?: number;
}) {
  return (
    <span
      className='marketing-agent-json-line'
      data-active={active ? 'true' : 'false'}
      data-json-control-key={controlKey}
      style={{ '--json-indent': indent } as React.CSSProperties}
    >
      <span className='marketing-agent-json-content'>{children}</span>
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
    <JsonLine active={activeKey === controlKey} controlKey={controlKey} indent={2}>
      <span className='marketing-agent-json-property'>
        <span className='marketing-agent-json-key'>&quot;{name}&quot;</span>
        <span className='marketing-agent-json-separator'>:</span>
        <strong className='marketing-agent-json-value'>{formattedJsonValue(controlKey, value)}</strong>
        <span className='marketing-agent-json-comma'>{comma ? ',' : ''}</span>
      </span>
    </JsonLine>
  );
}

function JsonObjectStart({ name }: { name: string }) {
  return (
    <JsonLine indent={1}>
      <span className='marketing-agent-json-object-start'>
        <span className='marketing-agent-json-key'>&quot;{name}&quot;</span>
        <span className='marketing-agent-json-separator'>:</span>
        <span>{'{'}</span>
      </span>
    </JsonLine>
  );
}

export default function MarketingAgentControlLab() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [activeAgent, setActiveAgent] = useState<AgentId>('codex');
  const [activeKey, setActiveKey] = useState<ControlKey>('lineHeight');
  const [agentTargets, setAgentTargets] = useState(INITIAL_AGENT_TARGETS);
  const [agentMotions, setAgentMotions] = useState(INITIAL_AGENT_MOTIONS);
  const [agentPhases, setAgentPhases] = useState(INITIAL_AGENT_PHASES);
  const [sceneGeometry, setSceneGeometry] = useState<AgentSceneGeometry>(EMPTY_SCENE_GEOMETRY);
  const [userInteractionKey, setUserInteractionKey] = useState<ControlKey | null>(null);
  const labRef = useRef<HTMLDivElement>(null);
  const previewScanRef = useRef<HTMLDivElement>(null);
  const autonomousStepRef = useRef(0);
  const automationPausedUntilRef = useRef(0);
  const valuesRef = useRef(values);
  const agentAnimationFramesRef = useRef<Record<AgentId, number | null>>({ claude: null, codex: null });
  const agentTimersRef = useRef<Record<AgentId, number[]>>({ claude: [], codex: [] });

  const clearAgentMotion = useCallback((agent: AgentId) => {
    const animationFrame = agentAnimationFramesRef.current[agent];
    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      agentAnimationFramesRef.current[agent] = null;
    }
    agentTimersRef.current[agent].forEach((timer) => window.clearTimeout(timer));
    agentTimersRef.current[agent] = [];
  }, []);

  const scheduleAgentTimer = useCallback((agent: AgentId, callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      agentTimersRef.current[agent] = agentTimersRef.current[agent].filter((candidate) => candidate !== timer);
      callback();
    }, delay);
    agentTimersRef.current[agent].push(timer);
  }, []);

  const tweenAgentControl = useCallback((agent: AgentId, key: ControlKey, target: number) => {
    const initial = valuesRef.current[key];
    const startedAt = performance.now();
    setAgentPhases((current) => ({ ...current, [agent]: 'dragging' }));

    const update = (timestamp: number) => {
      const progress = clamp((timestamp - startedAt) / AGENT_DRAG_DURATION_MS, 0, 1);
      const nextValue = progress === 1
        ? target
        : initial + (target - initial) * cubicBezierProgress(progress);

      setValues((current) => {
        const next = { ...current, [key]: nextValue };
        valuesRef.current = next;
        return next;
      });

      if (progress < 1) {
        agentAnimationFramesRef.current[agent] = window.requestAnimationFrame(update);
        return;
      }

      agentAnimationFramesRef.current[agent] = null;
      setAgentPhases((current) => ({ ...current, [agent]: 'releasing' }));
      scheduleAgentTimer(agent, () => {
        setAgentPhases((current) => ({ ...current, [agent]: 'idle' }));
      }, AGENT_RELEASE_DURATION_MS);
    };

    agentAnimationFramesRef.current[agent] = window.requestAnimationFrame(update);
  }, [scheduleAgentTimer]);

  const updateSceneGeometry = useCallback(() => {
    const lab = labRef.current;
    if (!lab) return;
    const labRect = lab.getBoundingClientRect();
    const connectors = [activeKey].flatMap((key): ConnectorPath[] => {
      const jsonLine = lab.querySelector<HTMLElement>(`[data-json-control-key='${key}']`);
      const jsonContent = jsonLine?.querySelector<HTMLElement>('.marketing-agent-json-content');
      const control = lab.querySelector<HTMLElement>(`[data-control-key='${key}']`);
      if (!jsonLine || !jsonContent || !control) return [];
      const jsonRect = jsonLine.getBoundingClientRect();
      const jsonContentRect = jsonContent.getBoundingClientRect();
      const controlRect = control.getBoundingClientRect();
      const start = {
        x: jsonContentRect.right - labRect.left + 7,
        y: jsonRect.top - labRect.top + jsonRect.height / 2,
      };
      const end = {
        x: controlRect.left - labRect.left,
        y: controlRect.top - labRect.top + controlRect.height / 2,
      };
      return [{ end, key, path: roundedOrthogonalPath(start, end), start }];
    });

    const preview = lab.querySelector<HTMLElement>('.marketing-agent-preview');
    const activeControl = lab.querySelector<HTMLElement>(`[data-control-key='${activeKey}']`);
    let previewConnector: PreviewConnector | null = null;
    if (preview && activeControl) {
      const previewRect = preview.getBoundingClientRect();
      const controlRect = activeControl.getBoundingClientRect();
      const start = {
        x: controlRect.right - labRect.left,
        y: controlRect.top - labRect.top + controlRect.height / 2,
      };
      const end = {
        x: previewRect.left - labRect.left,
        y: clamp(start.y, previewRect.top - labRect.top + 18, previewRect.bottom - labRect.top - 18),
      };
      previewConnector = { end, path: roundedOrthogonalPath(start, end), start };
    }

    const cursorTracks = CONTROL_GROUPS.flatMap(({ controls }) => controls).reduce<Partial<Record<ControlKey, CursorTrackGeometry>>>((next, definition) => {
      const control = lab.querySelector<HTMLElement>(`[data-control-key='${definition.key}']`);
      const range = control?.querySelector<HTMLInputElement>('input[type="range"]');
      if (!range) return next;
      const rangeRect = range.getBoundingClientRect();
      next[definition.key] = {
        max: Number(range.max) || 100,
        min: Number(range.min) || 0,
        width: rangeRect.width,
        x: rangeRect.left - labRect.left,
        y: rangeRect.top - labRect.top + rangeRect.height / 2,
      };
      return next;
    }, {});

    setSceneGeometry((current) => {
      const cursors = (Object.keys(agentTargets) as AgentId[]).reduce<Record<AgentId, AgentCursorPosition | null>>((next, agent) => {
        const key = agentTargets[agent];
        const track = cursorTracks[key];
        if (!track) {
          next[agent] = current.cursors[agent];
          return next;
        }
        const point = {
          x: track.x + clamp((valuesRef.current[key] - track.min) / (track.max - track.min), 0, 1) * track.width,
          y: track.y,
        };
        next[agent] = {
          ...point,
          angle: cursorAngle(current.cursors[agent], point),
        };
        return next;
      }, { claude: null, codex: null });

      return {
        connectors,
        cursorTracks,
        cursors,
        height: labRect.height,
        previewConnector,
        width: labRect.width,
      };
    });
  }, [activeKey, agentTargets]);

  useLayoutEffect(() => {
    updateSceneGeometry();
  }, [updateSceneGeometry]);

  useEffect(() => {
    const lab = labRef.current;
    if (!lab) return;
    const observer = new ResizeObserver(updateSceneGeometry);
    observer.observe(lab);
    window.addEventListener('resize', updateSceneGeometry);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSceneGeometry);
    };
  }, [updateSceneGeometry]);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    const animation = previewScanRef.current?.getAnimations()[0];
    if (!animation) return;
    animation.updatePlaybackRate(1.6 / Math.max(0.1, values.duration));
  }, [values.duration]);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer = 0;

    const advance = () => {
      if (!reducedMotion.matches && document.visibilityState !== 'hidden' && Date.now() >= automationPausedUntilRef.current) {
        const sequenceIndex = autonomousStepRef.current;
        const step = AUTONOMOUS_CONTROL_STEPS[sequenceIndex % AUTONOMOUS_CONTROL_STEPS.length]!;
        const valueIndex = Math.floor(sequenceIndex / AUTONOMOUS_CONTROL_STEPS.length) % step.values.length;
        autonomousStepRef.current += 1;
        clearAgentMotion(step.agent);
        setAgentMotions((current) => ({ ...current, [step.agent]: 'animate' }));
        setAgentPhases((current) => ({ ...current, [step.agent]: 'moving' }));
        setAgentTargets((current) => ({ ...current, [step.agent]: step.key }));
        setActiveAgent(step.agent);
        setActiveKey(step.key);
        scheduleAgentTimer(step.agent, () => {
          setAgentPhases((current) => ({ ...current, [step.agent]: 'grabbing' }));
          scheduleAgentTimer(step.agent, () => {
            tweenAgentControl(step.agent, step.key, step.values[valueIndex]);
          }, AGENT_GRAB_DURATION_MS);
        }, AGENT_TRAVEL_DURATION_MS);
      }
      timer = window.setTimeout(advance, AUTONOMOUS_STEP_INTERVAL_MS);
    };

    timer = window.setTimeout(advance, 900);
    return () => {
      window.clearTimeout(timer);
      (Object.keys(AGENTS) as AgentId[]).forEach(clearAgentMotion);
    };
  }, [clearAgentMotion, scheduleAgentTimer, tweenAgentControl]);

  const beginUserInteraction = useCallback((key: ControlKey) => {
    (Object.keys(AGENTS) as AgentId[]).forEach(clearAgentMotion);
    automationPausedUntilRef.current = Date.now() + USER_AUTOMATION_PAUSE_MS;
    setAgentMotions(INITIAL_AGENT_MOTIONS);
    setAgentPhases(INITIAL_AGENT_PHASES);
    setUserInteractionKey(key);
    setActiveKey(key);
  }, [clearAgentMotion]);

  const endUserInteraction = useCallback(() => {
    setUserInteractionKey(null);
  }, []);

  function changeControl(key: ControlKey, value: number) {
    const pairedKey = PAIRED_CONTROLS[key];
    automationPausedUntilRef.current = Date.now() + USER_AUTOMATION_PAUSE_MS;
    setUserInteractionKey(key);
    setValues((current) => {
      const next = {
        ...current,
        [key]: value,
        [pairedKey]: pairedValue(key, value),
      };
      valuesRef.current = next;
      return next;
    });
    setActiveKey(key);
  }

  const activeDefinition = CONTROL_LOOKUP.get(activeKey)!;
  const activeAgentDefinition = AGENTS[activeAgent];
  const shaderResponse = useMemo(() => {
    // These focused operating ranges make the autonomous demo's two states read
    // clearly while still allowing the full sliders to reach either extreme.
    const strength = normalize(values.strength, 0.5, 0.82);
    const grain = normalize(values.grain, 6, 17);
    const speed = normalize(values.speed, 0.22, 0.58);

    return {
      ditherSize: interpolate(1.4, 8.2, grain),
      grainAmount: interpolate(8, 92, grain),
      motionSpeed: interpolate(0.04, 1.4, speed),
      shaderContrast: interpolate(0.1, 2.1, strength),
      shaderScale: interpolate(0.72, 1.55, strength),
    };
  }, [values.grain, values.speed, values.strength]);
  const previewSettings = useMemo<LiveMaterialSettings>(() => ({
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    amplitude: 3.2,
    brightness: interpolate(0.78, 1.04, normalize(values.strength, 0.5, 0.82)),
    colorA: '#18072F',
    colorB: '#C8E2FF',
    colorC: '#E6FFB4',
    grain: shaderResponse.grainAmount,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    speed: shaderResponse.motionSpeed,
    strength: shaderResponse.shaderContrast,
  }), [shaderResponse, values.strength]);
  const paperShaderOverrides = useMemo(() => ({
    scale: shaderResponse.shaderScale,
    size: shaderResponse.ditherSize,
  }), [shaderResponse.ditherSize, shaderResponse.shaderScale]);
  const draggingControlKeys = new Set(
    (Object.keys(AGENTS) as AgentId[])
      .filter((agent) => agentPhases[agent] === 'dragging')
      .map((agent) => agentTargets[agent])
  );

  return (
    <div
      className='marketing-agent-lab'
      data-active-agent={activeAgent}
      data-user-interacting={userInteractionKey ? 'true' : 'false'}
      ref={labRef}
    >
      <section className='marketing-agent-json' aria-label='Generated JSON contract'>
        <pre><code>
          <JsonLine>{'{'}</JsonLine>
          <JsonObjectStart name='type' />
          <JsonProperty activeKey={activeKey} controlKey='fontSize' name='size' value={values.fontSize} />
          <JsonProperty activeKey={activeKey} controlKey='fontWeight' name='weight' value={values.fontWeight} />
          <JsonProperty activeKey={activeKey} controlKey='lineHeight' name='leading' value={values.lineHeight} />
          <JsonProperty activeKey={activeKey} comma={false} controlKey='letterSpacing' name='tracking' value={values.letterSpacing} />
          <JsonLine indent={1}>{'},'}</JsonLine>
          <JsonObjectStart name='material' />
          <JsonProperty activeKey={activeKey} controlKey='strength' name='strength' value={values.strength} />
          <JsonProperty activeKey={activeKey} comma={false} controlKey='grain' name='grain' value={values.grain} />
          <JsonLine indent={1}>{'},'}</JsonLine>
          <JsonObjectStart name='motion' />
          <JsonProperty activeKey={activeKey} controlKey='speed' name='speed' value={values.speed} />
          <JsonProperty activeKey={activeKey} comma={false} controlKey='duration' name='duration' value={values.duration} />
          <JsonLine indent={1}>{'}'}</JsonLine>
          <JsonLine>{'}'}</JsonLine>
        </code></pre>
      </section>

      {sceneGeometry.width > 0 && sceneGeometry.height > 0 ? (
        <svg
          aria-hidden='true'
          className='marketing-agent-connectors'
          preserveAspectRatio='none'
          viewBox={`0 0 ${sceneGeometry.width} ${sceneGeometry.height}`}
        >
          <defs>
            <marker id='marketing-agent-connector-arrow' markerHeight='6' markerWidth='6' orient='auto' refX='5' refY='3'>
              <path d='M 0 0 L 6 3 L 0 6 z' />
            </marker>
          </defs>
          {sceneGeometry.connectors.map((connector) => (
            <g
              className='marketing-agent-connector'
              data-active={connector.key === activeKey ? 'true' : 'false'}
              data-agent={connector.key === activeKey ? activeAgent : undefined}
              data-route-key={connector.key}
              key='active-route'
            >
              <path d={connector.path} markerEnd={connector.key === activeKey ? 'url(#marketing-agent-connector-arrow)' : undefined} />
              <circle cx={connector.start.x} cy={connector.start.y} r='2.2' />
              <circle cx={connector.end.x} cy={connector.end.y} r='2.2' />
            </g>
          ))}
          {sceneGeometry.previewConnector ? (
            <g className='marketing-agent-preview-route' data-agent={activeAgent}>
              <path
                className='marketing-agent-preview-connector'
                d={sceneGeometry.previewConnector.path}
                data-agent={activeAgent}
                markerEnd='url(#marketing-agent-connector-arrow)'
              />
              <circle cx={sceneGeometry.previewConnector.start.x} cy={sceneGeometry.previewConnector.start.y} r='2.6' />
              <circle cx={sceneGeometry.previewConnector.end.x} cy={sceneGeometry.previewConnector.end.y} r='2.6' />
            </g>
          ) : null}
        </svg>
      ) : null}

      <div className='marketing-agent-control-groups'>
        {CONTROL_GROUPS.map((group) => (
          <fieldset className='marketing-agent-control-group' data-group={group.id} key={group.id}>
            <legend className='sr-only'>{group.label}</legend>
            <div className='marketing-agent-control-grid'>
              {group.controls.map(({ format, icon: Icon, key, label, max, min, step }) => (
                <label
                  className='marketing-agent-control'
                  data-active={activeKey === key ? 'true' : 'false'}
                  data-agent={activeKey === key ? activeAgent : undefined}
                  data-control-key={key}
                  key={key}
                >
                  <span><i><Icon aria-hidden='true' /></i><b>{label}</b><output>{format(values[key])}</output></span>
                  <StudioRange
                    aria-label={label}
                    max={max}
                    min={min}
                    onBlur={endUserInteraction}
                    onChange={(event) => changeControl(key, Number(event.target.value))}
                    onKeyDown={() => beginUserInteraction(key)}
                    onKeyUp={endUserInteraction}
                    onPointerCancel={endUserInteraction}
                    onPointerDown={() => beginUserInteraction(key)}
                    onPointerUp={endUserInteraction}
                    step={draggingControlKeys.has(key) ? 'any' : step}
                    value={values[key]}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <section
        aria-label='Live agent output preview'
        className='marketing-agent-preview'
        data-shader-dither-size={round(shaderResponse.ditherSize, 2)}
        data-shader-scale={round(shaderResponse.shaderScale, 2)}
        data-shader-speed={round(shaderResponse.motionSpeed, 2)}
      >
        <LazyLiveMaterialCanvas
          activeWhileMounted
          frameRate={24}
          materialId='paper-dithering-warp'
          paperShaderOverrides={paperShaderOverrides}
          renderScale={0.6}
          settings={previewSettings}
        />
        <div className='marketing-agent-preview-shade' aria-hidden='true' />
        <div className='marketing-agent-preview-scan' aria-hidden='true' ref={previewScanRef} />
        <div className='marketing-agent-preview-copy'>
          <strong
            style={{
              '--marketing-agent-preview-font-size': `${values.fontSize}px`,
              fontWeight: values.fontWeight,
              letterSpacing: `${values.letterSpacing}px`,
              lineHeight: values.lineHeight,
            } as React.CSSProperties}
          >
            <span>One source.</span>
            <span>Any surface.</span>
          </strong>
        </div>
      </section>

      {(Object.keys(AGENTS) as AgentId[]).map((agent) => {
        const definition = AGENTS[agent];
        const targetKey = agentTargets[agent];
        const position = cursorPositionOnTrack(
          sceneGeometry.cursorTracks[targetKey],
          values[targetKey],
          sceneGeometry.cursors[agent]
        );
        return (
          <div
            aria-hidden='true'
            className='marketing-agent-cursor'
            data-active={activeAgent === agent ? 'true' : 'false'}
            data-agent={agent}
            data-motion={agentMotions[agent]}
            data-phase={agentPhases[agent]}
            key={agent}
            style={{
              opacity: position ? 1 : 0,
              transform: `translate3d(${position?.x ?? 0}px, ${position?.y ?? 0}px, 0)`,
            }}
          >
            <i className='marketing-agent-cursor-grip' />
            <svg
              className='marketing-agent-cursor-pointer'
              style={{ transform: `rotate(${position?.angle ?? 0}deg)` }}
              viewBox='0 0 18 22'
            >
              <path d='M1 1.5 16 12l-7.1 1.1L5 20.5 1 1.5Z' />
            </svg>
            <span><Image alt='' height={13} src={definition.icon} width={13} />{definition.label}</span>
          </div>
        );
      })}

      <span className='sr-only' aria-live={userInteractionKey ? 'polite' : 'off'}>
        {userInteractionKey
          ? `Updated ${CONTROL_LOOKUP.get(userInteractionKey)!.label} to ${CONTROL_LOOKUP.get(userInteractionKey)!.format(values[userInteractionKey])}.`
          : `${activeAgentDefinition.label} updated ${activeDefinition.label} to ${activeDefinition.format(values[activeKey])}.`}
      </span>
    </div>
  );
}
