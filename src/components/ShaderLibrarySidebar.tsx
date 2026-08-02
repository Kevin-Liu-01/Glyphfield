'use client';

import { T, useGT } from 'gt-next';
import { LibraryBig, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { LiveMaterialSourceBadge } from '@/components/LiveMaterialSourceLabel';
import ResizableSidebar from '@/components/ResizableSidebar';
import { Button } from '@/components/ui/Button';
import { useMountEffect } from '@/hooks/useMountEffect';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  DISCOVERABLE_LIVE_MATERIAL_OPTIONS,
  LIVE_MATERIAL_LOOK_PRESETS,
  type LiveMaterialId,
  type LiveMaterialOption,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import { requestShaderPreviewSlot } from '@/lib/shaderPreviewBudget';

type ShaderSourceFilter = 'all' | LiveMaterialOption['engine'];

const SOURCE_OPTIONS: readonly { label: string; value: ShaderSourceFilter }[] = [
  { label: 'All sources', value: 'all' },
  { label: 'Design studies', value: 'Design study' },
  { label: 'Paper', value: 'Paper Shaders' },
  { label: 'Glyphfield', value: 'Glyphfield' },
  { label: 'Shaders.com', value: 'Shaders.com study' },
  { label: 'WebGL Fluid', value: 'WebGL Fluid' },
  { label: 'ShaderGradient', value: 'ShaderGradient' },
];

function previewSettings(materialId: LiveMaterialId, colors: LiveMaterialSettings): LiveMaterialSettings {
  const look = LIVE_MATERIAL_LOOK_PRESETS.find((preset) => preset.materialId === materialId);
  return {
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    ...look?.settings,
    colorA: colors.colorA,
    colorB: colors.colorB,
    colorC: colors.colorC,
    speed: Math.max(0.18, Math.min(0.7, look?.settings.speed ?? colors.speed)),
  };
}

function ShaderLibraryPreview({
  material,
  settings,
}: {
  material: LiveMaterialOption;
  settings: LiveMaterialSettings;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hasRenderSlot, setHasRenderSlot] = useState(false);

  useMountEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry?.isIntersecting ?? false);
    });
    observer.observe(container);
    return () => observer.disconnect();
  });

  useEffect(() => {
    if (!visible) {
      setHasRenderSlot(false);
      return;
    }
    return requestShaderPreviewSlot(() => setHasRenderSlot(true));
  }, [visible]);

  return (
    <div
      className='shader-library-preview relative overflow-hidden bg-black'
      ref={containerRef}
    >
      {visible && hasRenderSlot ? (
        <LiveMaterialCanvas
          frameRate={16}
          materialId={material.id}
          renderScale={0.45}
          settings={previewSettings(material.id, settings)}
        />
      ) : <span aria-hidden='true' className='absolute inset-0 animate-pulse bg-muted' />}
    </div>
  );
}

function ShaderLibraryButton({
  onClick,
  open,
}: {
  onClick: () => void;
  open: boolean;
}) {
  return (
    <Button
      aria-expanded={open}
      aria-label='Toggle shader library'
      onClick={onClick}
      type='button'
      variant='outline'
    >
      <LibraryBig aria-hidden='true' />
      <span className='responsive-toolbar-label'><T>Shaders</T></span>
      <span className='responsive-toolbar-count text-[10px] tabular-nums text-muted-foreground'>{DISCOVERABLE_LIVE_MATERIAL_OPTIONS.length}</span>
    </Button>
  );
}

function ShaderLibraryBrowser({
  activeMaterialId,
  compact = false,
  onClose,
  onSelect,
  settings,
}: {
  activeMaterialId: LiveMaterialId;
  compact?: boolean;
  onClose?: () => void;
  onSelect: (materialId: LiveMaterialId) => void;
  settings: LiveMaterialSettings;
}) {
  const gt = useGT();
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<ShaderSourceFilter>('all');
  const filteredMaterials = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return DISCOVERABLE_LIVE_MATERIAL_OPTIONS.filter((material) => {
      if (source !== 'all' && material.engine !== source) return false;
      if (!normalizedQuery) return true;
      return `${material.name} ${material.description} ${material.engine}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, source]);

  return (
    <div className={compact ? 'shader-library-browser-compact' : 'shader-library-browser'}>
      <div className={compact
        ? 'shader-library-header bg-background pb-3'
        : 'shader-library-header sticky top-0 z-20 border-b border-border bg-background/95 p-4 backdrop-blur'}>
        {compact ? null : (
          <div className='flex items-start justify-between gap-4'>
          <div>
            <p className='text-sm font-semibold'><T>Shader library</T></p>
            <p className='mt-1 text-xs text-muted-foreground'>{DISCOVERABLE_LIVE_MATERIAL_OPTIONS.length} licensed materials · live previews</p>
          </div>
          {onClose ? (
            <Button aria-label={gt('Close shader library')} onClick={onClose} size='icon-xs' type='button' variant='ghost'>
              <X aria-hidden='true' />
            </Button>
          ) : null}
          </div>
        )}
        <label className={`${compact ? '' : 'mt-4'} flex h-9 items-center gap-2 border border-input bg-background px-2.5 focus-within:border-foreground`}>
          <Search aria-hidden='true' className='size-3.5 text-muted-foreground' />
          <input
            aria-label={gt('Search shaders')}
            className='min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground'
            onChange={(event) => setQuery(event.target.value)}
            placeholder={gt('Search shaders…')}
            type='search'
            value={query}
          />
        </label>
        <div aria-label={gt('Shader source filter')} className='mt-2 flex flex-wrap gap-1' role='group'>
          {SOURCE_OPTIONS.map((option) => (
            <button
              aria-pressed={source === option.value}
              className='shrink-0 border border-border px-2 py-1 text-[10px] font-medium hover:border-foreground aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background'
              key={option.value}
              onClick={() => setSource(option.value)}
              type='button'
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-2 ${compact ? '' : 'p-3'}`}>
        {filteredMaterials.map((material) => (
          <button
            aria-label={gt('Use {name} shader', { name: material.name })}
            aria-pressed={activeMaterialId === material.id}
            className='shader-library-card min-w-0 overflow-hidden border border-border bg-background text-left hover:border-foreground aria-pressed:border-foreground aria-pressed:ring-1 aria-pressed:ring-foreground'
            key={material.id}
            onClick={() => onSelect(material.id)}
            title={material.description}
            type='button'
          >
            <ShaderLibraryPreview material={material} settings={settings} />
            <span className='block p-2'>
              <span className='flex min-w-0 items-center gap-2'>
                <span className='min-w-0 flex-1 truncate text-[11px] font-semibold'>{material.name}</span>
                {activeMaterialId === material.id ? <span className='size-1.5 shrink-0 bg-foreground' aria-hidden='true' /> : null}
              </span>
              <LiveMaterialSourceBadge className='mt-1 ml-0 justify-start' engine={material.engine} />
            </span>
          </button>
        ))}
      </div>

      {filteredMaterials.length === 0 ? (
        <div className='p-8 text-center text-xs text-muted-foreground'><T>No shaders match this search.</T></div>
      ) : null}
    </div>
  );
}

function ShaderLibrarySidebar({
  activeMaterialId,
  onClose,
  onSelect,
  settings,
  side = 'left',
  storageKey,
}: {
  activeMaterialId: LiveMaterialId;
  onClose: () => void;
  onSelect: (materialId: LiveMaterialId) => void;
  settings: LiveMaterialSettings;
  side?: 'left' | 'right';
  storageKey: string;
}) {
  const gt = useGT();
  return (
    <ResizableSidebar
      className={`shader-library-sidebar shader-library-sidebar-${side} min-h-0 border-border bg-background ${side === 'left' ? 'border-r' : 'border-l'}`}
      defaultWidth={368}
      label={gt('shader library')}
      maxWidth={520}
      minWidth={300}
      resizeEdge={side === 'left' ? 'right' : 'left'}
      storageKey={storageKey}
    >
      <ShaderLibraryBrowser
        activeMaterialId={activeMaterialId}
        onClose={onClose}
        onSelect={onSelect}
        settings={settings}
      />
    </ResizableSidebar>
  );
}

export { ShaderLibraryBrowser, ShaderLibraryButton };
export default ShaderLibrarySidebar;
