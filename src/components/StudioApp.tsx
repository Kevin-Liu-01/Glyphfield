'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { T, useGT } from 'gt-next';
import {
  Aperture,
  Blend,
  BookOpen,
  Box,
  Braces,
  Component,
  Copy,
  ChevronDown,
  Folder,
  Image as ImageIcon,
  LayoutGrid,
  MonitorPlay,
  Palette,
  PanelsTopLeft,
  Plus,
  Search,
  ScanLine,
  Shapes,
  Sparkles,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from 'lucide-react';

import AnimationStudio from '@/components/AnimationStudio';
import StudioToolWorkspace from '@/components/StudioToolWorkspace';
import { Button } from '@/components/ui/Button';
import { useMountEffect } from '@/hooks/useMountEffect';
import {
  brandAssetPath,
  createBrandIdentity,
  duplicateBrandIdentity,
  hydrateBrandIdentities,
  STARTER_BRAND_IDENTITY,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { PRODUCT_BRAND } from '@/lib/productBrand';
import {
  filterStudioTools,
  STUDIO_CATEGORIES,
  STUDIO_TOOLS,
  type StudioToolId,
} from '@/lib/studioCatalog';

const TOOL_ICONS: Record<StudioToolId, LucideIcon> = {
  animation: Blend,
  backgrounds: ScanLine,
  blog: BookOpen,
  'brand-elements': LayoutGrid,
  buttons: Component,
  colors: Palette,
  'design-board': PanelsTopLeft,
  logo: Aperture,
  'logo-shader': Sparkles,
  opengraph: ImageIcon,
  partnership: Shapes,
  slides: MonitorPlay,
  terminal: Braces,
  typography: Type,
};

const PROJECTS_STORAGE_KEY = 'glyphfield-projects-v1';
const ACTIVE_PROJECT_STORAGE_KEY = 'glyphfield-active-project-v1';
const LEGACY_PROJECTS_STORAGE_KEYS = [
  'gt-studio-identities-v2',
  'gt-studio-identities-v1',
] as const;

type ProjectFolderId = 'all' | 'templates' | 'local' | 'examples';

const PROJECT_FOLDERS: readonly { id: ProjectFolderId; label: string }[] = [
  { id: 'all', label: 'All projects' },
  { id: 'templates', label: 'Templates' },
  { id: 'local', label: 'My brands' },
  { id: 'examples', label: 'Examples' },
];

function identityBelongsToFolder(identity: BrandIdentity, folderId: ProjectFolderId): boolean {
  if (folderId === 'templates') return identity.kind === 'template';
  if (folderId === 'local') return identity.kind === 'custom';
  if (folderId === 'examples') return identity.kind === 'example';
  return true;
}

export default function StudioApp() {
  const gt = useGT();
  const [activeToolId, setActiveToolId] = useState<StudioToolId>('brand-elements');
  const [identities, setIdentities] = useState<BrandIdentity[]>(() =>
    hydrateBrandIdentities(null)
  );
  const [identitiesReady, setIdentitiesReady] = useState(false);
  const [activeIdentityId, setActiveIdentityId] = useState(STARTER_BRAND_IDENTITY.id);
  const [activeFolderId, setActiveFolderId] = useState<ProjectFolderId>('all');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const filteredTools = useMemo(() => filterStudioTools(STUDIO_TOOLS, query), [query]);
  const activeTool = STUDIO_TOOLS.find(({ id }) => id === activeToolId);
  const activeIdentity =
    identities.find(({ id }) => id === activeIdentityId) ?? identities[0];
  const visibleIdentities = useMemo(
    () => identities.filter((identity) => identityBelongsToFolder(identity, activeFolderId)),
    [activeFolderId, identities]
  );
  const folderCounts = useMemo(
    () =>
      Object.fromEntries(
        PROJECT_FOLDERS.map((folder) => [
          folder.id,
          identities.filter((identity) => identityBelongsToFolder(identity, folder.id)).length,
        ])
      ) as Record<ProjectFolderId, number>,
    [identities]
  );

  useMountEffect(() => {
    try {
      const storedIdentities =
        window.localStorage.getItem(PROJECTS_STORAGE_KEY) ??
        LEGACY_PROJECTS_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(
          (value) => value !== null
        );
      const nextIdentities = hydrateBrandIdentities(
        storedIdentities ? JSON.parse(storedIdentities) : null
      );
      const storedActiveIdentity =
        window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) ??
        window.localStorage.getItem('gt-studio-active-identity-v2');
      setIdentities(nextIdentities);
      if (storedActiveIdentity && nextIdentities.some(({ id }) => id === storedActiveIdentity)) {
        setActiveIdentityId(storedActiveIdentity);
      }
    } catch {
      setIdentities(hydrateBrandIdentities(null));
      setActiveIdentityId(STARTER_BRAND_IDENTITY.id);
    } finally {
      setIdentitiesReady(true);
    }
  });

  useMountEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const isEditing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
      const isCommandK =
        (event.metaKey || event.ctrlKey) &&
        (event.code === 'KeyK' || event.key.toLocaleLowerCase() === 'k');

      if (isCommandK) {
        event.preventDefault();
        event.stopPropagation();
        searchRef.current?.focus({ preventScroll: true });
        searchRef.current?.select();
        return;
      }

      if (!isEditing && event.key === '/') {
        event.preventDefault();
        event.stopPropagation();
        searchRef.current?.focus({ preventScroll: true });
      }
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  });

  function selectTool(toolId: StudioToolId) {
    setActiveToolId(toolId);
    setQuery('');
  }

  function commitIdentities(nextIdentities: BrandIdentity[]) {
    setIdentities(nextIdentities);
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(nextIdentities));
  }

  function selectIdentity(identityId: string) {
    setActiveIdentityId(identityId);
    window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, identityId);
  }

  function addIdentity() {
    const customCount = identities.filter(({ kind }) => kind === 'custom').length;
    const identity = createBrandIdentity(`Brand ${customCount + 1}`);
    commitIdentities([...identities, identity]);
    setActiveFolderId('local');
    selectIdentity(identity.id);
  }

  function copyIdentity() {
    if (!activeIdentity) return;
    const identity = duplicateBrandIdentity(activeIdentity);
    commitIdentities([...identities, identity]);
    setActiveFolderId('local');
    selectIdentity(identity.id);
  }

  function selectProjectFolder(folderId: ProjectFolderId) {
    setActiveFolderId(folderId);
    if (activeIdentity && identityBelongsToFolder(activeIdentity, folderId)) return;
    const nextIdentity = identities.find((identity) => identityBelongsToFolder(identity, folderId));
    if (nextIdentity) selectIdentity(nextIdentity.id);
  }

  function renameIdentity(identityId: string, name: string) {
    const trimmedWords = name.trim().split(/\s+/).filter(Boolean);
    const shortName = trimmedWords
      .map((word) => word[0])
      .join('')
      .slice(0, 3)
      .toLocaleUpperCase();
    commitIdentities(
      identities.map((identity) =>
        identity.id === identityId
          ? { ...identity, name, shortName: shortName || identity.shortName }
          : identity
      )
    );
  }

  function removeIdentity() {
    if (!activeIdentity || activeIdentity.builtIn) return;
    const nextIdentities = identities.filter(({ id }) => id !== activeIdentity.id);
    commitIdentities(nextIdentities);
    setActiveFolderId('all');
    selectIdentity(STARTER_BRAND_IDENTITY.id);
  }

  function renderProjectMark(identity: BrandIdentity) {
    const markPath = brandAssetPath(identity, 'mark-dark');

    if (markPath) {
      return (
        <span className='project-tab-mark' aria-hidden='true'>
          <Image alt='' className='size-full object-contain' height={20} src={markPath} width={20} />
        </span>
      );
    }

    return (
      <span className='project-tab-mark project-tab-monogram' aria-hidden='true'>
        {identity.shortName.slice(0, 2)}
      </span>
    );
  }

  function renderProjectTab(identity: BrandIdentity) {
    const selected = identity.id === activeIdentity?.id;
    return (
      <div
        aria-selected={selected}
        className={`project-tab relative flex min-w-40 max-w-64 items-center gap-2 rounded-t-[5px] border border-b-0 px-3 text-sm ${
          selected
            ? 'border-border bg-background text-foreground'
            : 'border-border/65 bg-muted/25 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
        }`}
        key={identity.id}
        role='tab'
      >
        {selected && identity.kind === 'custom' ? (
          <div className='flex min-w-0 flex-1 items-center gap-2'>
            {renderProjectMark(identity)}
            <span className='font-mono text-muted-foreground' aria-hidden='true'>/</span>
            <input
              aria-label={gt('Project name')}
              className='min-w-0 flex-1 bg-transparent font-medium outline-none'
              onChange={(event) => renameIdentity(identity.id, event.target.value)}
              value={identity.name}
            />
          </div>
        ) : (
          <button
            aria-label={gt('Open {name} project', { name: identity.name })}
            className='flex min-w-0 flex-1 items-center gap-2 text-left'
            onClick={() => selectIdentity(identity.id)}
            type='button'
          >
            {renderProjectMark(identity)}
            <span className='font-mono text-muted-foreground' aria-hidden='true'>/</span>
            <span className={`truncate ${selected ? 'font-medium text-foreground' : ''}`}>
              {identity.name}
            </span>
          </button>
        )}
      </div>
    );
  }

  if (!activeTool || !activeIdentity) {
    return null;
  }

  return (
    <main className='studio-app h-dvh overflow-hidden bg-background text-foreground'>
      <header className='studio-app-header border-b border-border bg-background'>
        <Link
          className='flex min-w-0 items-center gap-2.5 border-r border-border px-3.5'
          href='/'
        >
          <Image
            alt={gt('Glyphfield mark')}
            className='size-7 object-contain'
            height={28}
            priority
            src={PRODUCT_BRAND.markPath}
            width={28}
          />
          <p className='truncate text-sm font-semibold tracking-tight'>{PRODUCT_BRAND.name}</p>
        </Link>

        <div className='flex min-w-0 items-center gap-2 px-3'>
          <select
            aria-label={gt('Active Studio tool')}
            className='studio-mobile-tool h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm outline-none'
            onChange={(event) => selectTool(event.target.value as StudioToolId)}
            value={activeToolId}
          >
            {STUDIO_TOOLS.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {gt(tool.name)}
              </option>
            ))}
          </select>
          <label className='flex h-9 w-full max-w-xl items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:border-foreground'>
            <Search className='size-4 shrink-0 text-muted-foreground' aria-hidden='true' />
            <input
              aria-label={gt('Search Studio tools')}
              aria-keyshortcuts='Meta+K Control+K /'
              className='min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground'
              onChange={(event) => setQuery(event.target.value)}
              placeholder={gt('Search Studio tools…')}
              ref={searchRef}
              value={query}
            />
            {query ? (
              <Button
                aria-label={gt('Clear search')}
                className='size-6'
                onClick={() => setQuery('')}
                size='icon-xs'
                type='button'
                variant='ghost'
              >
                <X aria-hidden='true' />
              </Button>
            ) : (
              <kbd className='hidden rounded-md border border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground sm:inline'>
                ⌘K
              </kbd>
            )}
          </label>
        </div>

      </header>

      <div className='project-tabs-shell border-b border-border bg-background'>
        <div className='project-dither-panel' aria-hidden='true'>
          <span className='project-dither-field' />
          <span className='project-dither-sweep' />
          <span className='project-dither-symbols'>
            <span>G</span>
            <span>ϟ</span>
            <span>@</span>
            <span>{'{ }'}</span>
          </span>
        </div>
        <div className='project-tabs flex min-w-0 items-end gap-2 overflow-x-auto px-2 pt-1.5'>
          <label className='project-folder-picker mb-1 flex h-8 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-muted-foreground hover:bg-muted/45 hover:text-foreground'>
            <Folder className='size-3.5 shrink-0' aria-hidden='true' />
            <select
              aria-label={gt('Project folder')}
              className='min-w-24 appearance-none bg-transparent pr-4 font-mono text-[11px] text-foreground outline-none'
              onChange={(event) => selectProjectFolder(event.target.value as ProjectFolderId)}
              value={activeFolderId}
            >
              {PROJECT_FOLDERS.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {gt(folder.label)} ({folderCounts[folder.id]})
                </option>
              ))}
            </select>
            <ChevronDown className='-ml-5 size-3 shrink-0 pointer-events-none' aria-hidden='true' />
          </label>
          <div className='flex shrink-0 items-end gap-1.5 self-stretch' role='tablist' aria-label={gt('Brand projects')}>
            {visibleIdentities.map(renderProjectTab)}
          </div>
          {visibleIdentities.length === 0 ? (
            <span className='mb-2 shrink-0 px-2 text-xs text-muted-foreground'>
              <T>No brands in this folder</T>
            </span>
          ) : null}
          <Button aria-label={gt('Add brand project')} className='mb-1 shrink-0' disabled={!identitiesReady} onClick={addIdentity} size='icon-xs' type='button' variant='ghost'>
            <Plus aria-hidden='true' />
          </Button>
          <div className='mb-1 ml-auto flex h-8 shrink-0 items-center gap-1 border-l border-border pl-2'>
            <Button aria-label={gt('Duplicate active project')} disabled={!identitiesReady} onClick={copyIdentity} size='icon-xs' title={gt('Duplicate project')} type='button' variant='ghost'>
              <Copy aria-hidden='true' />
            </Button>
            {!activeIdentity.builtIn ? (
              <Button aria-label={gt('Delete active project')} onClick={removeIdentity} size='icon-xs' title={gt('Delete project')} type='button' variant='ghost'>
                <Trash2 aria-hidden='true' />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className='studio-app-body'>
        <aside className='studio-nav flex min-h-0 flex-col border-r border-border bg-background'>
          <div className='min-h-0 flex-1 overflow-y-auto px-2 py-3'>
            {STUDIO_CATEGORIES.map((category) => {
              const tools = filteredTools.filter((tool) => tool.category === category);
              if (tools.length === 0) return null;

              return (
                <section className='flex flex-col gap-1 py-2' key={category}>
                  <h2 className='px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground'>
                    {gt(category)}
                  </h2>
                  <div className='flex flex-col gap-0.5'>
                    {tools.map((tool) => {
                      const Icon = TOOL_ICONS[tool.id];
                      const selected = activeToolId === tool.id;
                      return (
                        <Button
                          className='h-9 w-full justify-start rounded-md border-0 px-2.5'
                          key={tool.id}
                          onClick={() => selectTool(tool.id)}
                          title={gt(tool.description)}
                          type='button'
                          variant={selected ? 'default' : 'ghost'}
                        >
                          <Icon aria-hidden='true' />
                          <span className='min-w-0 flex-1 truncate text-left'>{gt(tool.name)}</span>
                        </Button>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {filteredTools.length === 0 ? (
              <div className='flex flex-col gap-2 px-4 py-8'>
                <Box className='size-5 text-muted-foreground' aria-hidden='true' />
                <p className='text-sm font-medium'>
                  <T>No Studio tool found</T>
                </p>
                <p className='text-sm leading-5 text-muted-foreground'>
                  <T>Try “email,” “logo,” “ASCII,” or “lanyard.”</T>
                </p>
              </div>
            ) : null}
          </div>
        </aside>

        <section className='studio-workspace min-w-0 overflow-hidden bg-background'>
          {activeToolId === 'animation' ? (
            <AnimationStudio embedded identity={activeIdentity} key={activeIdentity.id} />
          ) : (
            <StudioToolWorkspace identity={activeIdentity} key={`${activeIdentity.id}-${activeTool.id}`} tool={activeTool} />
          )}
        </section>
      </div>
    </main>
  );
}
