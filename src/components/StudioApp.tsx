'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { T, useGT } from 'gt-next';
import {
  Aperture,
  Blend,
  BookOpen,
  Box,
  Braces,
  Check,
  Component,
  Copy,
  ChevronDown,
  Folder,
  Grid3X3,
  Image as ImageIcon,
  LayoutGrid,
  Monitor,
  Moon,
  MonitorPlay,
  Palette,
  PanelTopClose,
  PanelsTopLeft,
  Plus,
  Search,
  ScanLine,
  Settings2,
  Shapes,
  Sparkles,
  Sun,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from 'lucide-react';

import AnimationStudio from '@/components/AnimationStudio';
import StudioToolWorkspace from '@/components/StudioToolWorkspace';
import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
import { useMountEffect } from '@/hooks/useMountEffect';
import { usePersistentState } from '@/hooks/usePersistentState';
import {
  brandAssetPath,
  createBrandIdentity,
  duplicateBrandIdentity,
  GT_BRAND_IDENTITY,
  hydrateBrandIdentities,
  STARTER_BRAND_IDENTITY,
  updateGeneratedPixelAssets,
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
  identity: Settings2,
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
const ACTIVE_TOOL_STORAGE_KEY = 'glyphfield-active-tool-v1';
const ACTIVE_FOLDER_STORAGE_KEY = 'glyphfield-active-folder-v1';
const OPEN_TABS_STORAGE_KEY = 'glyphfield-open-tabs-v1';
const APPEARANCE_STORAGE_KEY = 'glyphfield-appearance-v1';
const LEGACY_PROJECTS_STORAGE_KEYS = [
  'gt-studio-identities-v2',
  'gt-studio-identities-v1',
] as const;

type ProjectFolderId = 'all' | 'templates' | 'local' | 'examples';

type StudioAppearance = {
  accent: 'neutral' | 'violet' | 'teal' | 'lime';
  canvas: 'dots' | 'grid' | 'plain';
  density: 'compact' | 'comfortable';
  font: 'switzer' | 'be-vietnam-pro' | 'schibsted-grotesk' | 'rethink-sans';
  motion: 'full' | 'reduced';
  theme: 'light' | 'dark' | 'system';
};

const DEFAULT_APPEARANCE: StudioAppearance = {
  accent: 'neutral',
  canvas: 'dots',
  density: 'comfortable',
  font: 'switzer',
  motion: 'full',
  theme: 'system',
};

type ResolvedTheme = 'light' | 'dark';

function subscribeToSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSystemThemeSnapshot(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getServerThemeSnapshot(): boolean {
  return false;
}

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

function isProjectFolderId(value: string): value is ProjectFolderId {
  return PROJECT_FOLDERS.some(({ id }) => id === value);
}

function ProjectFolderMenu({
  activeIdentityId,
  activeFolderId,
  folderCounts,
  identities,
  onOpenProject,
  onSelect,
  openIdentityIds,
  theme,
}: {
  activeIdentityId: string;
  activeFolderId: ProjectFolderId;
  folderCounts: Record<ProjectFolderId, number>;
  identities: BrandIdentity[];
  onOpenProject: (identityId: string) => void;
  onSelect: (folderId: ProjectFolderId) => void;
  openIdentityIds: string[];
  theme: ResolvedTheme;
}) {
  const gt = useGT();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeFolder = PROJECT_FOLDERS.find(({ id }) => id === activeFolderId)!;
  const folderProjects = identities.filter((identity) =>
    identityBelongsToFolder(identity, activeFolderId)
  );

  useMountEffect(() => {
    function closeMenu(event: PointerEvent) {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-radix-popper-content-wrapper]')
      ) {
        return;
      }
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  });

  return (
    <div className='project-folder-menu' ref={menuRef}>
      <Button
        aria-expanded={open}
        aria-haspopup='menu'
        className='project-folder-trigger h-8 gap-2 px-2.5'
        onClick={() => setOpen((current) => !current)}
        type='button'
        variant='outline'
      >
        <Folder aria-hidden='true' />
        <span>{gt(activeFolder.label)}</span>
        <span className='project-folder-count'>{folderCounts[activeFolder.id]}</span>
        <ChevronDown aria-hidden='true' className={open ? 'rotate-180' : ''} />
      </Button>
      {open ? (
        <div className='project-folder-popover' role='menu'>
          <div className='project-folder-popover-heading'>
            <span><T>Project folders</T></span>
            <span>{folderCounts.all} <T>total</T></span>
          </div>
          {PROJECT_FOLDERS.map((folder) => (
            <button
              aria-checked={activeFolderId === folder.id}
              className='project-folder-option'
              key={folder.id}
              onClick={() => {
                onSelect(folder.id);
              }}
              role='menuitemradio'
              type='button'
            >
              <span className='project-folder-option-icon'>
                {folder.id === 'all' ? <Grid3X3 aria-hidden='true' /> : <Folder aria-hidden='true' />}
              </span>
              <span>
                <strong>{gt(folder.label)}</strong>
                <small>{folderCounts[folder.id]} {folderCounts[folder.id] === 1 ? gt('brand') : gt('brands')}</small>
              </span>
              {activeFolderId === folder.id ? <Check aria-hidden='true' /> : null}
            </button>
          ))}
          <div className='project-folder-popover-heading project-folder-projects-heading'>
            <span><T>Projects</T></span>
            <span><T>Click to open</T></span>
          </div>
          <div className='project-folder-projects'>
            {folderProjects.map((identity) => {
              const darkMark = brandAssetPath(identity, 'mark-dark');
              const lightMark = brandAssetPath(identity, 'mark-light');
              const markPath = theme === 'dark' ? lightMark ?? darkMark : darkMark ?? lightMark;
              const invertFallback = theme === 'dark' && !lightMark && Boolean(darkMark);
              const isOpen = openIdentityIds.includes(identity.id);
              const isActive = identity.id === activeIdentityId;

              return (
                <button
                  aria-current={isActive ? 'page' : undefined}
                  className='project-folder-project'
                  key={identity.id}
                  onClick={() => {
                    onOpenProject(identity.id);
                    setOpen(false);
                  }}
                  role='menuitem'
                  type='button'
                >
                  <span className='project-folder-project-mark' aria-hidden='true'>
                    {markPath ? (
                      <Image
                        alt=''
                        height={22}
                        src={markPath}
                        style={{ filter: invertFallback ? 'invert(1)' : undefined }}
                        width={22}
                      />
                    ) : (
                      identity.shortName.slice(0, 2)
                    )}
                  </span>
                  <span>
                    <strong>{identity.name}</strong>
                    <small>{identity.kind === 'custom' ? <T>My brand</T> : gt(identity.kind)}</small>
                  </span>
                  <span className='project-folder-project-state' title={isOpen ? gt('Tab open') : gt('Open tab')}>
                    {isOpen ? <Check aria-hidden='true' /> : <Plus aria-hidden='true' />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AppearanceMenu({
  appearance,
  onChange,
}: {
  appearance: StudioAppearance;
  onChange: (patch: Partial<StudioAppearance>) => void;
}) {
  const gt = useGT();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useMountEffect(() => {
    function closeMenu(event: PointerEvent) {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-radix-popper-content-wrapper]')
      ) {
        return;
      }
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  });

  return (
    <div className='appearance-menu' ref={menuRef}>
      <Button
        aria-expanded={open}
        aria-haspopup='dialog'
        aria-label={gt('Visual customization')}
        onClick={() => setOpen((current) => !current)}
        size='icon-sm'
        title={gt('Visual customization')}
        type='button'
        variant='outline'
      >
        <Settings2 aria-hidden='true' />
      </Button>
      {open ? (
        <div aria-label={gt('Visual customization')} className='appearance-popover' role='dialog'>
          <div className='appearance-popover-header'>
            <span>
              <Settings2 aria-hidden='true' />
              <T>Visual settings</T>
            </span>
            <button onClick={() => setOpen(false)} type='button'>
              <X aria-hidden='true' />
              <span className='sr-only'><T>Close</T></span>
            </button>
          </div>

          <section className='appearance-section'>
            <div>
              <strong><T>Theme</T></strong>
              <small><T>Studio chrome and controls</T></small>
            </div>
            <div className='appearance-segments appearance-segments--three'>
              {(['light', 'dark', 'system'] as const).map((theme) => (
                <button
                  aria-pressed={appearance.theme === theme}
                  key={theme}
                  onClick={() => onChange({ theme })}
                  type='button'
                >
                  {theme === 'light' ? (
                    <Sun aria-hidden='true' />
                  ) : theme === 'dark' ? (
                    <Moon aria-hidden='true' />
                  ) : (
                    <Monitor aria-hidden='true' />
                  )}
                  {theme === 'light' ? <T>Light</T> : theme === 'dark' ? <T>Dark</T> : <T>Auto</T>}
                </button>
              ))}
            </div>
          </section>

          <section className='appearance-section'>
            <div>
              <strong><T>Accent</T></strong>
              <small><T>Selection and focus color</T></small>
            </div>
            <div className='appearance-swatches' role='group' aria-label={gt('Accent color')}>
              {(['neutral', 'violet', 'teal', 'lime'] as const).map((accent) => (
                <button
                  aria-label={gt('{accent} accent', { accent })}
                  aria-pressed={appearance.accent === accent}
                  className={`appearance-swatch appearance-swatch--${accent}`}
                  key={accent}
                  onClick={() => onChange({ accent })}
                  type='button'
                >
                  {appearance.accent === accent ? <Check aria-hidden='true' /> : null}
                </button>
              ))}
            </div>
          </section>

          <section className='appearance-section'>
            <div>
              <strong><T>Canvas</T></strong>
              <small><T>Workspace construction field</T></small>
            </div>
            <div className='appearance-segments appearance-segments--three'>
              {(['dots', 'grid', 'plain'] as const).map((canvas) => (
                <button
                  aria-pressed={appearance.canvas === canvas}
                  key={canvas}
                  onClick={() => onChange({ canvas })}
                  type='button'
                >
                  {gt(canvas)}
                </button>
              ))}
            </div>
          </section>

          <section className='appearance-section'>
            <div>
              <strong><T>Studio font</T></strong>
              <small><T>Interface typography</T></small>
            </div>
            <StudioSelect
              ariaLabel={gt('Studio font')}
              onValueChange={(font) =>
                onChange({ font: font as StudioAppearance['font'] })
              }
              options={[
                { label: 'Switzer', value: 'switzer' },
                { label: 'Be Vietnam Pro', value: 'be-vietnam-pro' },
                { label: 'Schibsted Grotesk', value: 'schibsted-grotesk' },
                { label: 'Rethink Sans', value: 'rethink-sans' },
              ]}
              value={appearance.font}
            />
          </section>

          <section className='appearance-section appearance-section--split'>
            <label>
              <span>
                <strong><T>Compact UI</T></strong>
                <small><T>Tighter navigation</T></small>
              </span>
              <input
                checked={appearance.density === 'compact'}
                onChange={(event) => onChange({ density: event.target.checked ? 'compact' : 'comfortable' })}
                type='checkbox'
              />
            </label>
            <label>
              <span>
                <strong><T>Reduce motion</T></strong>
                <small><T>Pause decorative effects</T></small>
              </span>
              <input
                checked={appearance.motion === 'reduced'}
                onChange={(event) => onChange({ motion: event.target.checked ? 'reduced' : 'full' })}
                type='checkbox'
              />
            </label>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function StudioCommandPalette({
  activeToolId,
  onClose,
  onSelect,
  query,
  setQuery,
  tools,
}: {
  activeToolId: StudioToolId;
  onClose: () => void;
  onSelect: (toolId: StudioToolId) => void;
  query: string;
  setQuery: (query: string) => void;
  tools: ReturnType<typeof filterStudioTools>;
}) {
  const gt = useGT();
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useMountEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  });

  function selectResult(toolId: StudioToolId) {
    onSelect(toolId);
    onClose();
  }

  return (
    <div
      className='studio-command-overlay'
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-label={gt('Search Studio tools')}
        aria-modal='true'
        className='studio-command-dialog'
        role='dialog'
      >
        <header className='studio-command-search'>
          <Search aria-hidden='true' />
          <input
            aria-activedescendant={tools[activeIndex] ? `studio-command-${tools[activeIndex].id}` : undefined}
            aria-controls='studio-command-results'
            aria-expanded='true'
            aria-label={gt('Search Studio tools')}
            autoComplete='off'
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (tools.length > 0) {
                  setActiveIndex((current) => Math.min(current + 1, tools.length - 1));
                }
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((current) => Math.max(current - 1, 0));
              } else if (event.key === 'Enter' && tools[activeIndex]) {
                event.preventDefault();
                selectResult(tools[activeIndex].id);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder={gt('Search email, logos, motion, slides…')}
            ref={inputRef}
            role='combobox'
            value={query}
          />
          <kbd>ESC</kbd>
        </header>

        <div className='studio-command-heading'>
          <span><T>Studio tools</T></span>
          <span>{tools.length} {tools.length === 1 ? <T>result</T> : <T>results</T>}</span>
        </div>

        <div className='studio-command-results' id='studio-command-results' role='listbox'>
          {tools.map((tool, index) => {
            const Icon = TOOL_ICONS[tool.id];
            const selected = index === activeIndex;
            return (
              <button
                aria-selected={selected}
                className='studio-command-result'
                data-active-tool={tool.id === activeToolId ? 'true' : undefined}
                id={`studio-command-${tool.id}`}
                key={tool.id}
                onClick={() => selectResult(tool.id)}
                onMouseEnter={() => setActiveIndex(index)}
                role='option'
                type='button'
              >
                <span className='studio-command-result-icon'><Icon aria-hidden='true' /></span>
                <span className='studio-command-result-copy'>
                  <strong>{gt(tool.name)}</strong>
                  <small>{gt(tool.description)}</small>
                </span>
                <span className='studio-command-result-meta'>
                  <span>{gt(tool.category)}</span>
                  <kbd>{tool.shortcut}</kbd>
                </span>
              </button>
            );
          })}
          {tools.length === 0 ? (
            <div className='studio-command-empty'>
              <Search aria-hidden='true' />
              <strong><T>No tool found</T></strong>
              <span><T>Try “email,” “logo,” “shader,” or “slides.”</T></span>
            </div>
          ) : null}
        </div>

        <footer className='studio-command-footer'>
          <span><kbd>↑</kbd><kbd>↓</kbd><T>Navigate</T></span>
          <span><kbd>↵</kbd><T>Open tool</T></span>
          <span className='ml-auto'><T>Search every Studio surface</T></span>
        </footer>
      </section>
    </div>
  );
}

export default function StudioApp() {
  const gt = useGT();
  const systemDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemThemeSnapshot,
    getServerThemeSnapshot
  );
  const [activeToolId, setActiveToolId] = useState<StudioToolId>('brand-elements');
  const [identities, setIdentities] = useState<BrandIdentity[]>(() =>
    hydrateBrandIdentities(null)
  );
  const [identitiesReady, setIdentitiesReady] = useState(false);
  const [activeIdentityId, setActiveIdentityId] = useState(STARTER_BRAND_IDENTITY.id);
  const [activeFolderId, setActiveFolderId] = useState<ProjectFolderId>('all');
  const [query, setQuery] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [openIdentityIds, setOpenIdentityIds] = usePersistentState<string[]>(
    OPEN_TABS_STORAGE_KEY,
    [STARTER_BRAND_IDENTITY.id, GT_BRAND_IDENTITY.id]
  );
  const [appearance, setAppearance] = usePersistentState<StudioAppearance>(
    APPEARANCE_STORAGE_KEY,
    DEFAULT_APPEARANCE
  );
  const resolvedAppearance = { ...DEFAULT_APPEARANCE, ...appearance };
  const resolvedTheme: ResolvedTheme =
    resolvedAppearance.theme === 'system'
      ? systemDark
        ? 'dark'
        : 'light'
      : resolvedAppearance.theme;
  const filteredTools = useMemo(() => filterStudioTools(STUDIO_TOOLS, query), [query]);
  const activeTool = STUDIO_TOOLS.find(({ id }) => id === activeToolId);
  const activeIdentity =
    identities.find(({ id }) => id === activeIdentityId) ?? identities[0];
  const visibleIdentities = useMemo(
    () =>
      identities.filter(
        (identity) =>
          openIdentityIds.includes(identity.id) &&
          identityBelongsToFolder(identity, activeFolderId)
      ),
    [activeFolderId, identities, openIdentityIds]
  );
  const activeIdentityIsOpen = openIdentityIds.includes(activeIdentity?.id ?? '');
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
      const storedActiveTool = window.localStorage.getItem(ACTIVE_TOOL_STORAGE_KEY);
      const storedActiveFolder = window.localStorage.getItem(ACTIVE_FOLDER_STORAGE_KEY);
      const nextActiveIdentity =
        nextIdentities.find(({ id }) => id === storedActiveIdentity) ?? nextIdentities[0];
      setIdentities(nextIdentities);
      if (window.localStorage.getItem(OPEN_TABS_STORAGE_KEY) === null) {
        setOpenIdentityIds([
          STARTER_BRAND_IDENTITY.id,
          GT_BRAND_IDENTITY.id,
          ...(nextActiveIdentity &&
          nextActiveIdentity.id !== STARTER_BRAND_IDENTITY.id &&
          nextActiveIdentity.id !== GT_BRAND_IDENTITY.id
            ? [nextActiveIdentity.id]
            : []),
        ]);
      }
      if (nextActiveIdentity) setActiveIdentityId(nextActiveIdentity.id);
      if (storedActiveTool && STUDIO_TOOLS.some(({ id }) => id === storedActiveTool)) {
        setActiveToolId(storedActiveTool as StudioToolId);
      }
      if (
        storedActiveFolder &&
        isProjectFolderId(storedActiveFolder) &&
        nextActiveIdentity &&
        identityBelongsToFolder(nextActiveIdentity, storedActiveFolder)
      ) {
        setActiveFolderId(storedActiveFolder);
      } else {
        setActiveFolderId('all');
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
        setQuery('');
        setCommandOpen(true);
        return;
      }

      if (!isEditing && event.key === '/') {
        event.preventDefault();
        event.stopPropagation();
        setQuery('');
        setCommandOpen(true);
      }
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  });

  function selectTool(toolId: StudioToolId) {
    setActiveToolId(toolId);
    setQuery('');
    window.localStorage.setItem(ACTIVE_TOOL_STORAGE_KEY, toolId);
  }

  function closeCommandPalette() {
    setCommandOpen(false);
    setQuery('');
  }

  function commitIdentities(nextIdentities: BrandIdentity[]) {
    setIdentities(nextIdentities);
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(nextIdentities));
  }

  function selectIdentity(identityId: string) {
    setOpenIdentityIds((current) =>
      current.includes(identityId) ? current : [...current, identityId]
    );
    setActiveIdentityId(identityId);
    window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, identityId);
  }

  function closeIdentity(identityId: string) {
    const closingIndex = visibleIdentities.findIndex(({ id }) => id === identityId);
    const nextOpenIdentityIds = openIdentityIds.filter((id) => id !== identityId);
    setOpenIdentityIds(nextOpenIdentityIds);

    if (identityId !== activeIdentity?.id) return;
    const folderCandidates = identities.filter(
      (identity) =>
        nextOpenIdentityIds.includes(identity.id) &&
        identityBelongsToFolder(identity, activeFolderId)
    );
    const nextIdentity =
      folderCandidates[Math.min(Math.max(0, closingIndex), folderCandidates.length - 1)] ??
      identities.find(({ id }) => nextOpenIdentityIds.includes(id));
    if (nextIdentity) selectIdentity(nextIdentity.id);
  }

  function addIdentity() {
    const customCount = identities.filter(({ kind }) => kind === 'custom').length;
    const identity = createBrandIdentity(`Brand ${customCount + 1}`);
    const exampleIndex = identities.findIndex(({ kind }) => kind === 'example');
    const nextIdentities =
      exampleIndex < 0
        ? [...identities, identity]
        : [...identities.slice(0, exampleIndex), identity, ...identities.slice(exampleIndex)];
    commitIdentities(nextIdentities);
    setActiveFolderId('all');
    window.localStorage.setItem(ACTIVE_FOLDER_STORAGE_KEY, 'all');
    selectIdentity(identity.id);
  }

  function copyIdentity() {
    if (!activeIdentity) return;
    const identity = duplicateBrandIdentity(activeIdentity);
    const exampleIndex = identities.findIndex(({ kind }) => kind === 'example');
    const nextIdentities =
      exampleIndex < 0
        ? [...identities, identity]
        : [...identities.slice(0, exampleIndex), identity, ...identities.slice(exampleIndex)];
    commitIdentities(nextIdentities);
    setActiveFolderId('all');
    window.localStorage.setItem(ACTIVE_FOLDER_STORAGE_KEY, 'all');
    selectIdentity(identity.id);
  }

  function closeOtherIdentities() {
    if (!activeIdentity) return;
    setOpenIdentityIds([activeIdentity.id]);
    setActiveFolderId('all');
    window.localStorage.setItem(ACTIVE_FOLDER_STORAGE_KEY, 'all');
  }

  function selectProjectFolder(folderId: ProjectFolderId) {
    setActiveFolderId(folderId);
    window.localStorage.setItem(ACTIVE_FOLDER_STORAGE_KEY, folderId);
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
          ? {
              ...identity,
              assets: identity.assets.some(({ label }) =>
                label.startsWith('Generated pixel mark')
              )
                ? updateGeneratedPixelAssets(
                    identity.assets,
                    shortName || identity.shortName,
                    identity.id
                  )
                : identity.assets,
              name,
              shortName: shortName || identity.shortName,
            }
          : identity
      )
    );
  }

  function updateIdentity(nextIdentity: BrandIdentity) {
    commitIdentities(
      identities.map((identity) =>
        identity.id === nextIdentity.id ? nextIdentity : identity
      )
    );
  }

  function removeIdentity() {
    if (!activeIdentity || activeIdentity.builtIn) return;
    const nextIdentities = identities.filter(({ id }) => id !== activeIdentity.id);
    commitIdentities(nextIdentities);
    setOpenIdentityIds((current) => current.filter((id) => id !== activeIdentity.id));
    setActiveFolderId('all');
    window.localStorage.setItem(ACTIVE_FOLDER_STORAGE_KEY, 'all');
    selectIdentity(STARTER_BRAND_IDENTITY.id);
  }

  function renderProjectMark(identity: BrandIdentity) {
    const darkMark = brandAssetPath(identity, 'mark-dark');
    const lightMark = brandAssetPath(identity, 'mark-light');
    const markPath = resolvedTheme === 'dark' ? lightMark ?? darkMark : darkMark ?? lightMark;
    const invertFallback = resolvedTheme === 'dark' && !lightMark && Boolean(darkMark);

    if (markPath) {
      return (
        <span className='project-tab-mark' aria-hidden='true'>
          <Image
            alt=''
            className='size-full object-contain'
            height={20}
            src={markPath}
            style={{ filter: invertFallback ? 'invert(1)' : undefined }}
            width={20}
          />
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
        className={`project-tab relative flex min-w-40 max-w-64 items-center gap-2 rounded-t-[5px] border border-b-0 py-0 pr-1.5 pl-3 text-sm ${
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
        <button
          aria-label={gt('Close {name} tab', { name: identity.name })}
          className='project-tab-close'
          onClick={() => closeIdentity(identity.id)}
          title={gt('Close tab')}
          type='button'
        >
          <X aria-hidden='true' />
        </button>
      </div>
    );
  }

  if (!activeTool || !activeIdentity) {
    return null;
  }

  return (
    <main
      className='studio-app h-dvh overflow-hidden bg-background text-foreground'
      data-studio-accent={resolvedAppearance.accent}
      data-studio-canvas={resolvedAppearance.canvas}
      data-studio-density={resolvedAppearance.density}
      data-studio-font={resolvedAppearance.font}
      data-studio-motion={resolvedAppearance.motion}
      data-theme={resolvedAppearance.theme}
      data-resolved-theme={resolvedTheme}
    >
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

        <div className='studio-search-bar flex min-w-0 items-center gap-2 px-3'>
          <StudioSelect
            ariaLabel={gt('Active Studio tool')}
            className='studio-mobile-tool min-w-0'
            onValueChange={(value) => selectTool(value as StudioToolId)}
            options={STUDIO_TOOLS.map((tool) => ({ label: gt(tool.name), value: tool.id }))}
            value={activeToolId}
          />
          <button
            aria-haspopup='dialog'
            aria-keyshortcuts='Meta+K Control+K /'
            className='studio-command-launcher flex h-9 min-w-0 flex-1 max-w-xl items-center gap-2 rounded-md border border-input bg-background px-3 text-left hover:border-foreground'
            onClick={() => {
              setQuery('');
              setCommandOpen(true);
            }}
            type='button'
          >
            <Search className='size-4 shrink-0 text-muted-foreground' aria-hidden='true' />
            <span className='min-w-0 flex-1 truncate text-sm text-muted-foreground'><T>Search Studio tools…</T></span>
            <kbd className='hidden rounded-md border border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground sm:inline'>⌘K</kbd>
          </button>
          <div className='studio-appearance-toolbar ml-auto flex shrink-0 items-center gap-1.5'>
            <Button asChild size='icon-sm' title={gt('Documentation')} variant='outline'>
              <Link aria-label={gt('Open documentation')} href='/docs'>
                <BookOpen aria-hidden='true' />
              </Link>
            </Button>
            <AppearanceMenu
              appearance={resolvedAppearance}
              onChange={(patch) =>
                setAppearance((current) => ({
                  ...DEFAULT_APPEARANCE,
                  ...current,
                  ...patch,
                }))
              }
            />
            <Button
              aria-label={
                resolvedTheme === 'light'
                  ? gt('Switch to dark mode')
                  : gt('Switch to light mode')
              }
              onClick={() =>
                setAppearance((current) => ({
                  ...DEFAULT_APPEARANCE,
                  ...current,
                  theme: resolvedTheme === 'light' ? 'dark' : 'light',
                }))
              }
              size='icon-sm'
              title={
                resolvedTheme === 'light'
                  ? gt('Dark mode')
                  : gt('Light mode')
              }
              type='button'
              variant='outline'
            >
              {resolvedTheme === 'light' ? (
                <Moon aria-hidden='true' />
              ) : (
                <Sun aria-hidden='true' />
              )}
            </Button>
          </div>
        </div>

      </header>

      <div className='project-tabs-shell bg-background'>
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
        <div className='project-tabs flex min-w-0 items-end gap-2 px-2 pt-2'>
          <div className='project-tabs-scroll flex min-w-0 flex-1 items-end gap-2 overflow-x-auto self-stretch'>
            <div className='flex shrink-0 items-end gap-1.5 self-stretch' role='tablist' aria-label={gt('Brand projects')}>
              {visibleIdentities.map(renderProjectTab)}
            </div>
            {visibleIdentities.length === 0 ? (
              <span className='mb-2 shrink-0 px-2 text-xs text-muted-foreground'>
                <T>No brands in this folder</T>
              </span>
            ) : null}
            <Button aria-label={gt('Add brand project')} className='mb-1.5 shrink-0' disabled={!identitiesReady} onClick={addIdentity} size='icon-sm' type='button' variant='outline'>
              <Plus aria-hidden='true' />
            </Button>
          </div>
          <div className='project-tabs-actions mb-1.5 ml-auto flex h-8 shrink-0 items-center gap-1.5 border-l border-border pl-2'>
            <Button aria-label={gt('Duplicate active project')} className='project-action-button' disabled={!identitiesReady} onClick={copyIdentity} size='sm' title={gt('Duplicate project')} type='button' variant='outline'>
              <Copy aria-hidden='true' />
              <span className='project-action-label'><T>Duplicate</T></span>
            </Button>
            <Button aria-label={gt('Close other project tabs')} className='project-action-button' disabled={openIdentityIds.length <= 1} onClick={closeOtherIdentities} size='sm' title={gt('Close other tabs')} type='button' variant='outline'>
              <PanelTopClose aria-hidden='true' />
              <span className='project-action-label'><T>Close others</T></span>
            </Button>
            {!activeIdentity.builtIn ? (
              <Button aria-label={gt('Delete active project')} onClick={removeIdentity} size='icon-sm' title={gt('Delete project')} type='button' variant='ghost'>
                <Trash2 aria-hidden='true' />
              </Button>
            ) : null}
            <ProjectFolderMenu
              activeIdentityId={activeIdentity.id}
              activeFolderId={activeFolderId}
              folderCounts={folderCounts}
              identities={identities}
              onOpenProject={selectIdentity}
              onSelect={selectProjectFolder}
              openIdentityIds={openIdentityIds}
              theme={resolvedTheme}
            />
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
          {!activeIdentityIsOpen ? (
            <div className='studio-closed-projects-empty'>
              <Folder aria-hidden='true' />
              <div>
                <h2><T>No project tab open</T></h2>
                <p><T>Your brands and every saved draft are still available in the project folder menu.</T></p>
              </div>
            </div>
          ) : activeToolId === 'animation' ? (
            <AnimationStudio embedded identity={activeIdentity} key={activeIdentity.id} />
          ) : (
            <StudioToolWorkspace identity={activeIdentity} key={`${activeIdentity.id}-${activeTool.id}`} onIdentityChange={updateIdentity} tool={activeTool} />
          )}
        </section>
      </div>
      {commandOpen ? (
        <StudioCommandPalette
          activeToolId={activeToolId}
          onClose={closeCommandPalette}
          onSelect={selectTool}
          query={query}
          setQuery={setQuery}
          tools={filteredTools}
        />
      ) : null}
    </main>
  );
}
