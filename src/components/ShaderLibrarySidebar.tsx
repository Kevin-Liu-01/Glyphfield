'use client';

import { T, useGT } from 'gt-next';
import { LibraryBig, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import AuthenticShaderPreview from '@/components/AuthenticShaderPreview';
import { LabPanelHeading, StudioSidebar } from '@/components/LabWorkspace';
import { LiveMaterialSourceTag } from '@/components/LiveMaterialSourceLabel';
import { Button } from '@/components/ui/Button';
import {
  DISCOVERABLE_LIVE_MATERIAL_OPTIONS,
  type LiveMaterialId,
  type LiveMaterialOption,
} from '@/lib/liveMaterials';
import {
  SHADER_LAB_CATEGORIES,
  shaderLabMaterials,
  type ShaderLabCategory,
} from '@/lib/shaderLab';

const EMPTY_EXCLUDED_MATERIAL_IDS: readonly LiveMaterialId[] = [];

function ShaderLibraryPreview({
  material,
}: {
  material: LiveMaterialOption;
}) {
  return (
    <div className='shader-library-preview relative overflow-hidden bg-black'>
      <AuthenticShaderPreview materialId={material.id} />
      <LiveMaterialSourceTag className='shader-library-source-tag' material={material} />
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
  excludeMaterialIds = EMPTY_EXCLUDED_MATERIAL_IDS,
  limit,
  onClose,
  onSelect,
}: {
  activeMaterialId: LiveMaterialId;
  compact?: boolean;
  excludeMaterialIds?: readonly LiveMaterialId[];
  limit?: number;
  onClose?: () => void;
  onSelect: (materialId: LiveMaterialId) => void;
}) {
  const gt = useGT();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ShaderLabCategory>('all');
  const filteredMaterials = useMemo(() => {
    const excludedIds = new Set(excludeMaterialIds);
    const materials = shaderLabMaterials(query, category).filter(({ id }) => !excludedIds.has(id));
    if (!limit || materials.length <= limit) return materials;
    const topMaterials = materials.slice(0, limit);
    const activeMaterial = materials.find(({ id }) => id === activeMaterialId);
    if (!activeMaterial || topMaterials.some(({ id }) => id === activeMaterialId)) {
      return topMaterials;
    }
    return [activeMaterial, ...topMaterials.slice(0, limit - 1)];
  }, [activeMaterialId, category, excludeMaterialIds, limit, query]);

  return (
    <div className={compact ? 'shader-library-browser-compact' : 'shader-library-browser'}>
      <div className={compact
        ? 'shader-library-header bg-background pb-3'
        : 'shader-library-header sticky top-0 z-20 border-b border-border bg-background/95 p-4 backdrop-blur'}>
        {compact ? (
          <div className='mb-2 flex items-center justify-between gap-2'>
            <p className='font-mono text-[9px] uppercase tracking-wider text-muted-foreground'>
              <T>Top shaders</T>
            </p>
            <span className='font-mono text-[9px] tabular-nums text-muted-foreground'>
              {filteredMaterials.length}{limit ? ` / ${limit}` : ''}
            </span>
          </div>
        ) : (
          <LabPanelHeading
            action={onClose ? (
            <Button aria-label={gt('Close shader library')} onClick={onClose} size='icon-xs' type='button' variant='ghost'>
              <X aria-hidden='true' />
            </Button>
            ) : null}
            density='compact'
            description={`${DISCOVERABLE_LIVE_MATERIAL_OPTIONS.length} materials · shared with Shaders`}
            title={<T>Shader library</T>}
          />
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
        <div aria-label={gt('Shader category filter')} className='mt-2 flex flex-wrap gap-1' role='group'>
          {SHADER_LAB_CATEGORIES.map((option) => (
            <button
              aria-pressed={category === option.id}
            className={`shrink-0 border border-border font-medium hover:border-foreground aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background ${compact ? 'px-1.5 py-1 text-[9px]' : 'px-2 py-1 text-[10px]'}`}
              key={option.id}
              onClick={() => setCategory(option.id)}
              type='button'
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-2 ${compact ? 'gap-1' : 'gap-2 p-3'}`}>
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
            <ShaderLibraryPreview material={material} />
            <span className={`block ${compact ? 'p-1.5' : 'p-2'}`}>
              <span className='flex min-w-0 items-center gap-2'>
                <span className={`min-w-0 flex-1 truncate font-semibold ${compact ? 'text-[9px]' : 'text-[11px]'}`}>{material.name}</span>
                {activeMaterialId === material.id ? <span className='size-1.5 shrink-0 bg-foreground' aria-hidden='true' /> : null}
              </span>
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
  side = 'left',
  storageKey,
}: {
  activeMaterialId: LiveMaterialId;
  onClose: () => void;
  onSelect: (materialId: LiveMaterialId) => void;
  side?: 'left' | 'right';
  storageKey: string;
}) {
  const gt = useGT();
  return (
    <StudioSidebar
      className={`shader-library-sidebar shader-library-sidebar-${side} min-h-0`}
      kind='library'
      label={gt('shader library')}
      side={side}
      storageKey={storageKey}
    >
      <ShaderLibraryBrowser
        activeMaterialId={activeMaterialId}
        onClose={onClose}
        onSelect={onSelect}
      />
    </StudioSidebar>
  );
}

export { ShaderLibraryBrowser, ShaderLibraryButton };
export default ShaderLibrarySidebar;
