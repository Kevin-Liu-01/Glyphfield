'use client';

import { T } from 'gt-next';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { useMountEffect } from '@/hooks/useMountEffect';
import { resolveTimeline } from '@/lib/animation';
import {
  renderFrame,
  type AnimationPackageId,
  type RenderConfig,
  type StudioSource,
} from '@/lib/renderFrame';
import type { StudioSettings } from '@/lib/studio';

type AnimationPackageOption = {
  description: string;
  id: AnimationPackageId;
  label: string;
  textOnly?: boolean;
};

const ANIMATION_PACKAGES: readonly AnimationPackageOption[] = [
  { id: 'morph-fade', label: 'Morph fade', description: 'Soft blur and shared center.' },
  { id: 'type-delete', label: 'Type / delete', description: 'Grapheme-by-grapheme handoff.', textOnly: true },
  { id: 'crossfade', label: 'Crossfade', description: 'Clean opacity exchange.' },
  { id: 'scale-fade', label: 'Scale fade', description: 'Subtle opposing depth.' },
  { id: 'slide-fade', label: 'Slide fade', description: 'Horizontal directional move.' },
  { id: 'rise-fade', label: 'Rise fade', description: 'Vertical lift and settle.' },
  { id: 'zoom-through', label: 'Zoom through', description: 'Push through the outgoing frame.' },
  { id: 'blur-swipe', label: 'Blur swipe', description: 'Fast motion with soft trails.' },
  { id: 'flip-fade', label: 'Flip fade', description: 'Compressed card-like turnover.' },
  { id: 'spring-pop', label: 'Spring pop', description: 'Gentle overshoot and arrival.' },
  { id: 'rotate-fade', label: 'Rotate fade', description: 'Small angular handoff.' },
  { id: 'drift-fade', label: 'Drift fade', description: 'Diagonal floating exchange.' },
];

const PREVIEW_WIDTH = 220;
const PREVIEW_HEIGHT = 124;
const PREVIEW_HOLD_MS = 420;
const PREVIEW_TRANSITION_MS = 620;
const PREVIEW_FRAME_INTERVAL = 1000 / 14;

type PreviewSubscriber = (timestamp: number) => void;
const previewSubscribers = new Set<PreviewSubscriber>();
let previewAnimationFrame = 0;
let previousPreviewFrame = 0;

function tickPreviews(timestamp: number) {
  if (timestamp - previousPreviewFrame >= PREVIEW_FRAME_INTERVAL) {
    previousPreviewFrame = timestamp;
    previewSubscribers.forEach((subscriber) => subscriber(timestamp));
  }
  previewAnimationFrame = previewSubscribers.size > 0
    ? requestAnimationFrame(tickPreviews)
    : 0;
}

function subscribeToPreviewFrames(subscriber: PreviewSubscriber) {
  previewSubscribers.add(subscriber);
  if (previewAnimationFrame === 0) {
    previewAnimationFrame = requestAnimationFrame(tickPreviews);
  }
  return () => {
    previewSubscribers.delete(subscriber);
    if (previewSubscribers.size === 0 && previewAnimationFrame !== 0) {
      cancelAnimationFrame(previewAnimationFrame);
      previewAnimationFrame = 0;
    }
  };
}

const AnimationPackagePreview = memo(function AnimationPackagePreview({
  animate,
  packageId,
  settings,
}: {
  animate: boolean;
  packageId: AnimationPackageId;
  settings: StudioSettings;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  const sources = useMemo<readonly StudioSource[]>(() => [
    {
      foreground: settings.foreground,
      fontSize: 42,
      fontWeight: 650,
      id: 'preview-form',
      kind: 'text',
      text: 'FORM',
    },
    {
      foreground: settings.foreground,
      fontSize: 42,
      fontWeight: 650,
      id: 'preview-flow',
      kind: 'text',
      text: 'FLOW',
    },
  ], [settings.foreground]);
  const config = useMemo<RenderConfig>(() => ({
    alignX: 0,
    alignY: 0,
    background: settings.background,
    backgroundAngle: settings.backgroundAngle,
    backgroundSecondary: settings.backgroundSecondary,
    backgroundStyle: settings.backgroundStyle === 'solid' ? 'solid' : 'gradient',
    backgroundTransition: settings.backgroundTransition,
    bezier: settings.bezier,
    blur: Math.max(7, Math.min(18, settings.blur)),
    fit: 'contain',
    fontSize: 42,
    fontWeight: 650,
    foreground: settings.foreground,
    height: PREVIEW_HEIGHT,
    packageId,
    scale: 1,
    width: PREVIEW_WIDTH,
  }), [packageId, settings]);

  useMountEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry?.isIntersecting ?? false);
    }, { rootMargin: '120px' });
    observer.observe(container);
    return () => observer.disconnect();
  });

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = (timestamp: number) => {
      if (document.visibilityState === 'hidden') return;
      context.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
      renderFrame(
        context,
        sources,
        config,
        resolveTimeline(reducedMotion ? PREVIEW_HOLD_MS + PREVIEW_TRANSITION_MS * 0.55 : timestamp, {
          holdMs: PREVIEW_HOLD_MS,
          itemCount: sources.length,
          transitionMs: PREVIEW_TRANSITION_MS,
        })
      );
    };

    draw(performance.now());
    if (reducedMotion || !animate) return;
    return subscribeToPreviewFrames(draw);
  }, [animate, config, sources, visible]);

  return (
    <div
      className='animation-package-preview relative overflow-hidden bg-black'
      data-preview-motion={animate ? 'running' : 'static'}
      ref={containerRef}
    >
      <canvas
        aria-hidden='true'
        className='block size-full'
        height={PREVIEW_HEIGHT}
        ref={canvasRef}
        width={PREVIEW_WIDTH}
      />
      {!visible ? <span aria-hidden='true' className='absolute inset-0 animate-pulse bg-muted' /> : null}
    </div>
  );
}, (previous, next) => (
  previous.animate === next.animate
  && previous.packageId === next.packageId
  && previous.settings.background === next.settings.background
  && previous.settings.backgroundAngle === next.settings.backgroundAngle
  && previous.settings.backgroundSecondary === next.settings.backgroundSecondary
  && previous.settings.backgroundStyle === next.settings.backgroundStyle
  && previous.settings.backgroundTransition === next.settings.backgroundTransition
  && previous.settings.bezier.every((value, index) => value === next.settings.bezier[index])
  && previous.settings.blur === next.settings.blur
  && previous.settings.foreground === next.settings.foreground
));

export default function AnimationPackageGallery({
  animatePreviews = true,
  compact = false,
  hasImageSources,
  onSelect,
  selectedId,
  settings,
}: {
  animatePreviews?: boolean;
  compact?: boolean;
  hasImageSources: boolean;
  onSelect: (id: AnimationPackageId) => void;
  selectedId: AnimationPackageId;
  settings: StudioSettings;
}) {
  return (
    <div className={`grid grid-cols-2 ${compact ? 'gap-1' : 'gap-2'}`}>
      {ANIMATION_PACKAGES.map((option) => {
        const disabled = Boolean(option.textOnly && hasImageSources);
        const selected = selectedId === option.id;
        return (
          <button
            aria-label={`Use ${option.label} animation`}
            aria-pressed={selected}
            className='animation-package-card min-w-0 overflow-hidden border border-border bg-background text-left transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-foreground aria-pressed:ring-1 aria-pressed:ring-foreground'
            disabled={disabled}
            key={option.id}
            onClick={() => onSelect(option.id)}
            title={disabled ? 'Text-only animation' : option.description}
            type='button'
          >
            <AnimationPackagePreview
              animate={animatePreviews}
              packageId={option.id}
              settings={settings}
            />
            <span className={`block ${compact ? 'p-1.5' : 'p-2.5'}`}>
              <span className='flex min-w-0 items-center gap-2'>
                <span className={`min-w-0 flex-1 truncate font-semibold ${compact ? 'text-[9px]' : 'text-[11px]'}`}><T>{option.label}</T></span>
                {selected ? <span aria-hidden='true' className='size-1.5 shrink-0 bg-foreground' /> : null}
              </span>
              {compact ? null : (
                <span className='mt-1 block text-[10px] leading-4 text-muted-foreground'><T>{option.description}</T></span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { ANIMATION_PACKAGES };
