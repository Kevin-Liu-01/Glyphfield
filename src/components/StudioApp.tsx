'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { T, useGT } from 'gt-next';
import { useTheme } from 'next-themes';
import {
  BookOpen,
  Box,
  Check,
  Copy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  Grid3X3,
  Monitor,
  Moon,
  PanelTopClose,
  Plus,
  Rocket,
  Save,
  Search,
  Settings2,
  Sun,
  Trash2,
  X,
} from 'lucide-react';

import { useThemeOverride } from '@/components/AppThemeProvider';
import BrandFontFaces from '@/components/BrandFontFaces';
import GitHubStarButton from '@/components/GitHubStarButton';
import SidebarDitherPanel from '@/components/SidebarDitherPanel';
import { StudioExportProgressProvider } from '@/components/StudioExportProgress';
import { STUDIO_TOOL_ICONS } from '@/components/StudioToolHeader';
import ThemeAwareBrandMark from '@/components/ThemeAwareBrandMark';
import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
import { useMountEffect } from '@/hooks/useMountEffect';
import { usePersistentState } from '@/hooks/usePersistentState';
import {
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
  getProjectTabDensity,
  getProjectTabScrollCues,
  reorderProjectTabs,
  STUDIO_CATEGORIES,
  STUDIO_TOOLS,
  type ProjectTabPlacement,
  type StudioToolId,
} from '@/lib/studioCatalog';

const AnimationStudio = dynamic(() => import('@/components/AnimationStudio'), {
  loading: StudioWorkspaceLoading,
  ssr: false,
});
const BrandSettingsStudio = dynamic(() => import('@/components/BrandSettingsStudio'), {
  loading: StudioWorkspaceLoading,
});
const LottieStudio = dynamic(() => import('@/components/LottieStudio'), {
  loading: StudioWorkspaceLoading,
  ssr: false,
});
const StudioToolWorkspace = dynamic(() => import('@/components/StudioToolWorkspace'), {
  loading: StudioWorkspaceLoading,
});

function StudioWorkspaceLoading() {
  return (
    <div aria-busy='true' aria-label='Loading Studio tool' className='studio-workspace-loading'>
      <span />
    </div>
  );
}

const PROJECTS_STORAGE_KEY = 'glyphfield-projects-v1';
const ACTIVE_PROJECT_STORAGE_KEY = 'glyphfield-active-project-v1';
const ACTIVE_TOOL_STORAGE_KEY = 'glyphfield-active-tool-v2';
const ACTIVE_FOLDER_STORAGE_KEY = 'glyphfield-active-folder-v1';
const OPEN_TABS_STORAGE_KEY = 'glyphfield-open-tabs-v1';
const APPEARANCE_STORAGE_KEY = 'glyphfield-appearance-v1';
const LEGACY_PROJECTS_STORAGE_KEYS = [
  'gt-studio-identities-v2',
  'gt-studio-identities-v1',
] as const;
const LEGACY_SURFACE_TOOL_MODES = {
  backgrounds: 'background',
  logo: 'logo',
} as const;
const RETAINED_WORKSPACE_TOOL_IDS = new Set<StudioToolId>(['animation', 'material']);
const MATERIAL_TOOL = STUDIO_TOOLS.find(({ id }) => id === 'material');
const EMPTY_TOOL_IDS: StudioToolId[] = [];

type ProjectFolderId = 'all' | 'templates' | 'local' | 'examples';

type ProjectTabDragState = {
  originOrder: string[];
  placement: ProjectTabPlacement;
  pointerOffsetX: number;
  previewOrder: string[];
  sourceId: string;
  targetId: string;
};

type StudioAppearance = {
  accent: 'neutral' | 'violet' | 'teal' | 'lime';
  canvas: 'dots' | 'grid' | 'plain';
  corners: 'rounded' | 'square';
  density: 'compact' | 'comfortable';
  font: 'switzer' | 'be-vietnam-pro' | 'schibsted-grotesk' | 'rethink-sans';
  motion: 'full' | 'reduced';
  theme: 'light' | 'dark' | 'system';
};

const DEFAULT_APPEARANCE: StudioAppearance = {
  accent: 'neutral',
  canvas: 'dots',
  corners: 'rounded',
  density: 'comfortable',
  font: 'switzer',
  motion: 'full',
  theme: 'system',
};

type ResolvedTheme = 'light' | 'dark';

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
}: {
  activeIdentityId: string;
  activeFolderId: ProjectFolderId;
  folderCounts: Record<ProjectFolderId, number>;
  identities: BrandIdentity[];
  onOpenProject: (identityId: string) => void;
  onSelect: (folderId: ProjectFolderId) => void;
  openIdentityIds: string[];
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
                    <ThemeAwareBrandMark className='size-[19px]' identity={identity} />
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
              <strong><T>Corners</T></strong>
              <small><T>Shape of Studio controls and panels</T></small>
            </div>
            <div className='appearance-segments'>
              {(['rounded', 'square'] as const).map((corners) => (
                <button
                  aria-pressed={appearance.corners === corners}
                  key={corners}
                  onClick={() => onChange({ corners })}
                  type='button'
                >
                  {corners === 'rounded' ? <T>Rounded</T> : <T>Square</T>}
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
                { label: 'Helvetica Neue', value: 'switzer' },
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
            const Icon = STUDIO_TOOL_ICONS[tool.id];
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
  const setThemeOverride = useThemeOverride();
  const {
    setTheme: setProviderTheme,
    systemTheme,
  } = useTheme();
  const [activeToolId, setActiveToolId] = useState<StudioToolId>('identity');
  const [retainedWorkspaces, setRetainedWorkspaces] = useState<{
    identityId: string;
    toolIds: StudioToolId[];
  }>({ identityId: STARTER_BRAND_IDENTITY.id, toolIds: [] });
  const [identities, setIdentities] = useState<BrandIdentity[]>(() =>
    hydrateBrandIdentities(null)
  );
  const [pendingIdentities, setPendingIdentities] = useState<Record<string, BrandIdentity>>({});
  const [identitiesReady, setIdentitiesReady] = useState(false);
  const [activeIdentityId, setActiveIdentityId] = useState(STARTER_BRAND_IDENTITY.id);
  const [activeFolderId, setActiveFolderId] = useState<ProjectFolderId>('all');
  const [query, setQuery] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const projectTabDragRef = useRef<ProjectTabDragState | null>(null);
  const projectTabFrameRef = useRef<number | null>(null);
  const projectTabSelectionRef = useRef<HTMLSpanElement>(null);
  const projectTabPointerDragRef = useRef<{
    centers: number[];
    moved: boolean;
    originOrder: string[];
    pendingClientX: number;
    pointerId: number;
    sourceIndex: number;
    sourceId: string;
    startX: number;
    startY: number;
    tabs: HTMLElement[];
  } | null>(null);
  const suppressProjectTabClickRef = useRef<string | null>(null);
  const [reorderControlsIdentityId, setReorderControlsIdentityId] = useState<string | null>(
    null
  );
  const [tabOrderAnnouncement, setTabOrderAnnouncement] = useState('');
  const projectTabsScrollRef = useRef<HTMLDivElement>(null);
  const workspaceDirectionRef = useRef<'backward' | 'forward'>('forward');
  const [tabScrollState, setTabScrollState] = useState({
    availableWidth: 0,
    canScrollLeft: false,
    canScrollRight: false,
    viewportWidth: 0,
  });
  const [openIdentityIds, setOpenIdentityIds] = usePersistentState<string[]>(
    OPEN_TABS_STORAGE_KEY,
    [STARTER_BRAND_IDENTITY.id, GT_BRAND_IDENTITY.id]
  );
  const [appearance, setAppearance] = usePersistentState<StudioAppearance>(
    APPEARANCE_STORAGE_KEY,
    DEFAULT_APPEARANCE
  );
  const [themeReady, setThemeReady] = useState(false);
  const resolvedAppearance = { ...DEFAULT_APPEARANCE, ...appearance };
  const resolvedTheme: ResolvedTheme =
    resolvedAppearance.theme === 'system'
      ? themeReady && systemTheme === 'dark'
        ? 'dark'
        : 'light'
      : resolvedAppearance.theme;

  useEffect(() => setThemeReady(true), []);

  useEffect(() => {
    setProviderTheme(resolvedAppearance.theme);
    setThemeOverride(resolvedTheme);

    return () => setThemeOverride(undefined);
  }, [resolvedAppearance.theme, resolvedTheme, setProviderTheme, setThemeOverride]);
  const filteredTools = useMemo(() => filterStudioTools(STUDIO_TOOLS, query), [query]);
  const activeTool = STUDIO_TOOLS.find(({ id }) => id === activeToolId);
  const resolvedIdentities = useMemo(
    () => identities.map((identity) => pendingIdentities[identity.id] ?? identity),
    [identities, pendingIdentities]
  );
  const activeIdentity =
    resolvedIdentities.find(({ id }) => id === activeIdentityId) ?? resolvedIdentities[0];
  const retainedWorkspaceToolIds = retainedWorkspaces.identityId === activeIdentity?.id
    ? retainedWorkspaces.toolIds
    : EMPTY_TOOL_IDS;
  const activeIdentityHasPendingChanges = Boolean(
    activeIdentity && pendingIdentities[activeIdentity.id]
  );
  const identityById = useMemo(
    () => new Map(resolvedIdentities.map((identity) => [identity.id, identity])),
    [resolvedIdentities]
  );
  const visibleIdentities = useMemo(
    () =>
      openIdentityIds
        .map((identityId) => identityById.get(identityId))
        .filter(
          (identity): identity is BrandIdentity =>
            identity !== undefined && identityBelongsToFolder(identity, activeFolderId)
        ),
    [activeFolderId, identityById, openIdentityIds]
  );
  const projectTabDensity = getProjectTabDensity(
    visibleIdentities.length,
    tabScrollState.availableWidth,
    tabScrollState.viewportWidth
  );
  const activeProjectTabIndex = visibleIdentities.findIndex(
    ({ id }) => id === activeIdentity?.id
  );
  const activeIdentityIsOpen = openIdentityIds.includes(activeIdentity?.id ?? '');
  const folderCounts = useMemo(
    () =>
      Object.fromEntries(
        PROJECT_FOLDERS.map((folder) => [
          folder.id,
          resolvedIdentities.filter((identity) => identityBelongsToFolder(identity, folder.id)).length,
        ])
      ) as Record<ProjectFolderId, number>,
    [resolvedIdentities]
  );

  useEffect(() => {
    if (!identitiesReady || !activeIdentity) return;
    const identityId = activeIdentity.id;
    const warmWorkspaces = () => {
      startTransition(() => {
        setRetainedWorkspaces((current) => {
          if (
            current.identityId === identityId
            && RETAINED_WORKSPACE_TOOL_IDS.size === current.toolIds.length
            && current.toolIds.every((toolId) => RETAINED_WORKSPACE_TOOL_IDS.has(toolId))
          ) {
            return current;
          }
          return {
            identityId,
            toolIds: Array.from(RETAINED_WORKSPACE_TOOL_IDS),
          };
        });
      });
    };
    if (typeof window.requestIdleCallback === 'function') {
      const idleCallback = window.requestIdleCallback(warmWorkspaces, { timeout: 1_500 });
      return () => window.cancelIdleCallback(idleCallback);
    }
    const warmTimer = window.setTimeout(warmWorkspaces, 700);
    return () => window.clearTimeout(warmTimer);
  }, [activeIdentity?.id, identitiesReady]);

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
      const launchParameters = new URLSearchParams(window.location.search);
      const requestedTool = launchParameters.get('tool');
      const requestedProjectId = launchParameters.get('project');
      const requestedFolderValue = launchParameters.get('folder');
      const requestedFolderId =
        requestedFolderValue && isProjectFolderId(requestedFolderValue)
          ? requestedFolderValue
          : null;
      const storedActiveIdentity =
        window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) ??
        window.localStorage.getItem('gt-studio-active-identity-v2');
      const storedActiveTool = requestedTool
        ?? window.localStorage.getItem(ACTIVE_TOOL_STORAGE_KEY);
      const storedActiveFolder = window.localStorage.getItem(ACTIVE_FOLDER_STORAGE_KEY);
      const requestedProject = nextIdentities.find(({ id }) => id === requestedProjectId);
      const requestedFolderProject = requestedFolderId
        ? nextIdentities.find((identity) => identityBelongsToFolder(identity, requestedFolderId))
        : undefined;
      const nextActiveIdentity =
        requestedProject ??
        requestedFolderProject ??
        nextIdentities.find(({ id }) => id === storedActiveIdentity) ??
        nextIdentities[0];
      setIdentities(nextIdentities);
      const hasStoredTabs = window.localStorage.getItem(OPEN_TABS_STORAGE_KEY) !== null;
      if (!hasStoredTabs || requestedProject || requestedFolderProject) {
        setOpenIdentityIds((current) => {
          const initialIds = hasStoredTabs
            ? current
            : [
                STARTER_BRAND_IDENTITY.id,
                GT_BRAND_IDENTITY.id,
              ];
          return nextActiveIdentity && !initialIds.includes(nextActiveIdentity.id)
            ? [...initialIds, nextActiveIdentity.id]
            : initialIds;
        });
      }
      if (nextActiveIdentity) {
        setActiveIdentityId(nextActiveIdentity.id);
        if (requestedProject || requestedFolderProject) {
          window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, nextActiveIdentity.id);
        }
      }
      if (storedActiveTool === 'logo-shader') {
        setActiveToolId('material');
      } else if (storedActiveTool && storedActiveTool in LEGACY_SURFACE_TOOL_MODES) {
        window.localStorage.setItem(
          `glyphfield-draft-v1:${nextActiveIdentity.id}:surface:mode-v2`,
          JSON.stringify(
            LEGACY_SURFACE_TOOL_MODES[
              storedActiveTool as keyof typeof LEGACY_SURFACE_TOOL_MODES
            ]
          )
        );
        setActiveToolId('surface');
      } else if (
        storedActiveTool === 'surface' &&
        window.localStorage.getItem(
          `glyphfield-draft-v1:${nextActiveIdentity.id}:surface:mode`
        ) === JSON.stringify('material')
      ) {
        setActiveToolId('material');
      } else if (storedActiveTool && STUDIO_TOOLS.some(({ id }) => id === storedActiveTool)) {
        setActiveToolId(storedActiveTool as StudioToolId);
      }
      if (
        requestedFolderId &&
        nextActiveIdentity &&
        identityBelongsToFolder(nextActiveIdentity, requestedFolderId)
      ) {
        setActiveFolderId(requestedFolderId);
        window.localStorage.setItem(ACTIVE_FOLDER_STORAGE_KEY, requestedFolderId);
      } else if (requestedProject?.kind === 'example') {
        setActiveFolderId('examples');
        window.localStorage.setItem(ACTIVE_FOLDER_STORAGE_KEY, 'examples');
      } else if (
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
    const rail = projectTabsScrollRef.current;
    if (!rail) return;

    let animationFrame = 0;
    const updateScrollState = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const scrollCues = getProjectTabScrollCues(
          rail.scrollLeft,
          rail.clientWidth,
          rail.scrollWidth
        );
        const nextState = {
          availableWidth: rail.clientWidth,
          ...scrollCues,
          viewportWidth: window.innerWidth,
        };
        setTabScrollState((current) =>
          current.availableWidth === nextState.availableWidth &&
          current.canScrollLeft === nextState.canScrollLeft &&
          current.canScrollRight === nextState.canScrollRight &&
          current.viewportWidth === nextState.viewportWidth
            ? current
            : nextState
        );
      });
    };

    const resizeObserver = new ResizeObserver(updateScrollState);
    const mutationObserver = new MutationObserver(updateScrollState);
    resizeObserver.observe(rail);
    const tabList = rail.querySelector<HTMLElement>('.project-tabs-tablist');
    const addButton = rail.querySelector<HTMLElement>('.project-tab-add');
    if (tabList) resizeObserver.observe(tabList);
    if (addButton) resizeObserver.observe(addButton);
    mutationObserver.observe(rail, { childList: true, subtree: true });
    rail.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      rail.removeEventListener('scroll', updateScrollState);
    };
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
    const retainActiveWorkspace = toolId !== activeToolId
      && RETAINED_WORKSPACE_TOOL_IDS.has(activeToolId);
    if (toolId !== activeToolId) {
      const currentIndex = STUDIO_TOOLS.findIndex(({ id }) => id === activeToolId);
      const nextIndex = STUDIO_TOOLS.findIndex(({ id }) => id === toolId);
      workspaceDirectionRef.current = nextIndex < currentIndex ? 'backward' : 'forward';
    }
    startTransition(() => {
      if (retainActiveWorkspace) {
        setRetainedWorkspaces((current) => {
          const identityId = activeIdentity?.id ?? STARTER_BRAND_IDENTITY.id;
          const toolIds = current.identityId === identityId ? current.toolIds : [];
          return toolIds.includes(activeToolId)
            ? current
            : { identityId, toolIds: [...toolIds, activeToolId] };
        });
      }
      setActiveToolId(toolId);
    });
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
    if (identityId !== activeIdentity?.id) {
      const currentIndex = openIdentityIds.indexOf(activeIdentity?.id ?? '');
      const nextIndex = openIdentityIds.indexOf(identityId);
      workspaceDirectionRef.current =
        nextIndex >= 0 && nextIndex < currentIndex ? 'backward' : 'forward';
    }
    setOpenIdentityIds((current) =>
      current.includes(identityId) ? current : [...current, identityId]
    );
    setActiveIdentityId(identityId);
    window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, identityId);
    window.requestAnimationFrame(() => {
      projectTabsScrollRef.current
        ?.querySelector<HTMLElement>(
          `[data-project-id="${CSS.escape(identityId)}"]`
        )
        ?.scrollIntoView({
          behavior: resolvedAppearance.motion === 'reduced' ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
    });
  }

  function scrollProjectTabs(direction: -1 | 1) {
    const rail = projectTabsScrollRef.current;
    if (!rail) return;
    rail.scrollBy({
      behavior: resolvedAppearance.motion === 'reduced' ? 'auto' : 'smooth',
      left: direction * Math.max(180, rail.clientWidth * 0.64),
    });
  }

  function closeIdentity(identityId: string) {
    const closingIndex = visibleIdentities.findIndex(({ id }) => id === identityId);
    const nextOpenIdentityIds = openIdentityIds.filter((id) => id !== identityId);
    setOpenIdentityIds(nextOpenIdentityIds);
    if (reorderControlsIdentityId === identityId) setReorderControlsIdentityId(null);

    if (identityId !== activeIdentity?.id) return;
    const folderCandidates = nextOpenIdentityIds
      .map((id) => identityById.get(id))
      .filter(
        (identity): identity is BrandIdentity =>
          identity !== undefined && identityBelongsToFolder(identity, activeFolderId)
      );
    const nextIdentity =
      folderCandidates[Math.min(Math.max(0, closingIndex), folderCandidates.length - 1)] ??
      nextOpenIdentityIds
        .map((id) => identityById.get(id))
        .find((identity): identity is BrandIdentity => identity !== undefined);
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
    const currentIdentity = resolvedIdentities.find((identity) => identity.id === identityId);
    if (!currentIdentity) return;
    const trimmedWords = name.trim().split(/\s+/).filter(Boolean);
    const shortName = trimmedWords
      .map((word) => word[0])
      .join('')
      .slice(0, 3)
      .toLocaleUpperCase();
    updateIdentity({
      ...currentIdentity,
      assets: currentIdentity.assets.some(({ label }) =>
        label.startsWith('Generated pixel mark')
      )
        ? updateGeneratedPixelAssets(
            currentIdentity.assets,
            shortName || currentIdentity.shortName,
            currentIdentity.id
          )
        : currentIdentity.assets,
      name,
      shortName: shortName || currentIdentity.shortName,
    });
  }

  const updateIdentity = useCallback((nextIdentity: BrandIdentity) => {
    setPendingIdentities((current) => ({
      ...current,
      [nextIdentity.id]: nextIdentity,
    }));
  }, []);

  function saveIdentityChanges(identityId: string) {
    const pendingIdentity = pendingIdentities[identityId];
    if (!pendingIdentity) return;
    commitIdentities(
      identities.map((identity) =>
        identity.id === identityId ? pendingIdentity : identity
      )
    );
    setPendingIdentities((current) => {
      const nextPendingIdentities = { ...current };
      delete nextPendingIdentities[identityId];
      return nextPendingIdentities;
    });
  }

  function ignoreIdentityChanges(identityId: string) {
    setPendingIdentities((current) => {
      const nextPendingIdentities = { ...current };
      delete nextPendingIdentities[identityId];
      return nextPendingIdentities;
    });
  }

  function removeIdentity() {
    if (!activeIdentity || activeIdentity.builtIn) return;
    const nextIdentities = identities.filter(({ id }) => id !== activeIdentity.id);
    commitIdentities(nextIdentities);
    ignoreIdentityChanges(activeIdentity.id);
    setOpenIdentityIds((current) => current.filter((id) => id !== activeIdentity.id));
    setActiveFolderId('all');
    window.localStorage.setItem(ACTIVE_FOLDER_STORAGE_KEY, 'all');
    selectIdentity(STARTER_BRAND_IDENTITY.id);
  }

  function renderProjectMark(identity: BrandIdentity, selected: boolean) {
    return (
      <ThemeAwareBrandMark
        className='project-tab-mark'
        identity={identity}
        inverse={selected}
      />
    );
  }

  function announceProjectTabMove(identityId: string, position: number, total: number) {
    const identity = identityById.get(identityId);
    if (!identity) return;
    setTabOrderAnnouncement(
      gt('Moved {name} to position {position} of {total}.', {
        name: identity.name,
        position,
        total,
      })
    );
  }

  function commitProjectTabReorder(
    sourceId: string,
    targetId: string,
    placement: ProjectTabPlacement
  ) {
    if (sourceId === targetId) return;
    const visibleIdentityIds = visibleIdentities.map(({ id }) => id);
    const reorderedVisibleIds = reorderProjectTabs(
      visibleIdentityIds,
      sourceId,
      targetId,
      placement
    );
    const nextPosition = reorderedVisibleIds.indexOf(sourceId);
    if (nextPosition < 0) return;

    setOpenIdentityIds((current) =>
      reorderProjectTabs(current, sourceId, targetId, placement)
    );
    announceProjectTabMove(sourceId, nextPosition + 1, reorderedVisibleIds.length);
  }

  function moveProjectTab(identityId: string, direction: -1 | 1) {
    const currentIndex = visibleIdentities.findIndex(({ id }) => id === identityId);
    const targetIdentity = visibleIdentities[currentIndex + direction];
    if (currentIndex < 0 || !targetIdentity) return;
    commitProjectTabReorder(
      identityId,
      targetIdentity.id,
      direction < 0 ? 'before' : 'after'
    );
  }

  function handleProjectTabPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    identityId: string
  ) {
    if (event.button !== 0) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('.project-tab-close, .project-tab-reorder-controls')
    ) {
      return;
    }
    projectTabPointerDragRef.current = {
      centers: [],
      moved: false,
      originOrder: [],
      pendingClientX: event.clientX,
      pointerId: event.pointerId,
      sourceIndex: -1,
      sourceId: identityId,
      startX: event.clientX,
      startY: event.clientY,
      tabs: [],
    };
  }

  function clearProjectTabDrag() {
    if (projectTabFrameRef.current !== null) {
      window.cancelAnimationFrame(projectTabFrameRef.current);
      projectTabFrameRef.current = null;
    }
    const pointerDrag = projectTabPointerDragRef.current;
    pointerDrag?.tabs.forEach((tab) => {
      delete tab.dataset.dragging;
      delete tab.dataset.shifting;
      tab.style.removeProperty('transform');
    });
    const selection = projectTabSelectionRef.current;
    if (selection) {
      selection.style.transform = `translate3d(calc(${activeProjectTabIndex} * (var(--project-tab-width) + var(--project-tab-gap))), 0, 0)`;
    }
    projectTabDragRef.current = null;
    projectTabPointerDragRef.current = null;
  }

  function applyProjectTabDragFrame(
    pointerDrag: NonNullable<typeof projectTabPointerDragRef.current>
  ) {
    projectTabFrameRef.current = null;
    if (projectTabPointerDragRef.current !== pointerDrag || !pointerDrag.moved) return;
    const clientX = pointerDrag.pendingClientX;
    const firstCenter = pointerDrag.centers[0] ?? clientX;
    const lastCenter = pointerDrag.centers.at(-1) ?? clientX;
    const minimumOffset = firstCenter - pointerDrag.centers[pointerDrag.sourceIndex];
    const maximumOffset = lastCenter - pointerDrag.centers[pointerDrag.sourceIndex];
    const pointerOffsetX = Math.min(
      maximumOffset,
      Math.max(minimumOffset, clientX - pointerDrag.startX)
    );
    const draggedCenter =
      pointerDrag.centers[pointerDrag.sourceIndex] + pointerOffsetX;
    const remainingTabs = pointerDrag.originOrder
      .map((id, index) => ({ center: pointerDrag.centers[index], id }))
      .filter(({ id }) => id !== pointerDrag.sourceId);
    const previewIndex = remainingTabs.filter(({ center }) => center < draggedCenter).length;
    const previewOrder = remainingTabs.map(({ id }) => id);
    previewOrder.splice(previewIndex, 0, pointerDrag.sourceId);

    const orderChanged = previewIndex !== pointerDrag.sourceIndex;
    const targetId = orderChanged
      ? previewIndex < pointerDrag.sourceIndex
        ? remainingTabs[previewIndex]?.id ?? pointerDrag.sourceId
        : remainingTabs[previewIndex - 1]?.id ?? pointerDrag.sourceId
      : pointerDrag.sourceId;
    const placement: ProjectTabPlacement =
      previewIndex < pointerDrag.sourceIndex ? 'before' : 'after';
    const nextDrag: ProjectTabDragState = {
      originOrder: pointerDrag.originOrder,
      placement,
      pointerOffsetX,
      previewOrder,
      sourceId: pointerDrag.sourceId,
      targetId,
    };
    projectTabDragRef.current = nextDrag;

    pointerDrag.tabs.forEach((tab, originIndex) => {
      const identityId = pointerDrag.originOrder[originIndex];
      if (identityId === pointerDrag.sourceId) {
        tab.dataset.dragging = 'true';
        delete tab.dataset.shifting;
        tab.style.transform = `translate3d(${pointerOffsetX}px, 0, 0)`;
        return;
      }
      const destinationIndex = previewOrder.indexOf(identityId);
      const slotOffset = destinationIndex - originIndex;
      if (slotOffset === 0) {
        delete tab.dataset.shifting;
        tab.style.removeProperty('transform');
        return;
      }
      tab.dataset.shifting = 'true';
      tab.style.transform = `translate3d(calc(${slotOffset} * (var(--project-tab-width) + var(--project-tab-gap))), 0, 0)`;
    });

    const selection = projectTabSelectionRef.current;
    if (selection) {
      const selectedIdentityId = activeIdentity?.id ?? '';
      const activeIndex = pointerDrag.originOrder.indexOf(selectedIdentityId);
      const selectionIndex = selectedIdentityId === pointerDrag.sourceId
        ? activeIndex
        : previewOrder.indexOf(selectedIdentityId);
      const selectionOffset = selectedIdentityId === pointerDrag.sourceId
        ? ` + ${pointerOffsetX}px`
        : '';
      selection.style.transform = `translate3d(calc(${selectionIndex} * (var(--project-tab-width) + var(--project-tab-gap))${selectionOffset}), 0, 0)`;
    }
  }

  function handleProjectTabPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointerDrag = projectTabPointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    if (!pointerDrag.moved) {
      const distance = Math.hypot(
        event.clientX - pointerDrag.startX,
        event.clientY - pointerDrag.startY
      );
      if (distance <= 5) return;
      const tabs = Array.from(event.currentTarget.parentElement?.children ?? []).filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && Boolean(element.dataset.projectId)
      );
      const sourceIndex = tabs.findIndex(
        ({ dataset }) => dataset.projectId === pointerDrag.sourceId
      );
      const bounds = tabs.map((tab) => tab.getBoundingClientRect());
      if (sourceIndex < 0 || !bounds[sourceIndex]) {
        clearProjectTabDrag();
        return;
      }
      pointerDrag.centers = bounds.map(({ left, width }) => left + width / 2);
      pointerDrag.moved = true;
      pointerDrag.originOrder = tabs.map(({ dataset }) => dataset.projectId ?? '');
      pointerDrag.sourceIndex = sourceIndex;
      pointerDrag.tabs = tabs;
      event.currentTarget.setPointerCapture(event.pointerId);
      setReorderControlsIdentityId(null);
    }
    event.preventDefault();
    pointerDrag.pendingClientX = event.clientX;
    if (projectTabFrameRef.current === null) {
      projectTabFrameRef.current = window.requestAnimationFrame(() => {
        applyProjectTabDragFrame(pointerDrag);
      });
    }
  }

  function handleProjectTabPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const pointerDrag = projectTabPointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    if (projectTabFrameRef.current !== null) {
      window.cancelAnimationFrame(projectTabFrameRef.current);
      projectTabFrameRef.current = null;
      pointerDrag.pendingClientX = event.clientX;
      applyProjectTabDragFrame(pointerDrag);
    }
    const currentDrag = projectTabDragRef.current;
    if (pointerDrag.moved) {
      suppressProjectTabClickRef.current = pointerDrag.sourceId;
      window.setTimeout(() => {
        if (suppressProjectTabClickRef.current === pointerDrag.sourceId) {
          suppressProjectTabClickRef.current = null;
        }
      }, 80);
    }
    clearProjectTabDrag();
    if (
      pointerDrag.moved &&
      currentDrag &&
      currentDrag.sourceId !== currentDrag.targetId
    ) {
      commitProjectTabReorder(
        currentDrag.sourceId,
        currentDrag.targetId,
        currentDrag.placement
      );
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleProjectTabPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const pointerDrag = projectTabPointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    clearProjectTabDrag();
  }

  function openProjectTabMoveControls(identityId: string) {
    setReorderControlsIdentityId(identityId);
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(
          `#project-tab-reorder-${CSS.escape(identityId)} button:not(:disabled)`
        )
        ?.focus();
    });
  }

  function renderProjectTab(identity: BrandIdentity) {
    const selected = identity.id === activeIdentity?.id;
    const visibleIndex = visibleIdentities.findIndex(({ id }) => id === identity.id);
    const reorderControlsOpen = reorderControlsIdentityId === identity.id;
    return (
      <div
        aria-selected={selected}
        className={`project-tab relative flex items-center gap-2 border border-b-0 py-0 pr-1.5 pl-3 text-sm ${
          selected
            ? 'border-border bg-background text-foreground'
            : 'border-border/65 bg-muted/25 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
        }`}
        data-project-id={identity.id}
        key={identity.id}
        onClickCapture={(event) => {
          if (suppressProjectTabClickRef.current !== identity.id) return;
          event.preventDefault();
          event.stopPropagation();
          suppressProjectTabClickRef.current = null;
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          openProjectTabMoveControls(identity.id);
        }}
        onKeyDown={(event) => {
          if (event.altKey && event.key === 'ArrowLeft') {
            event.preventDefault();
            moveProjectTab(identity.id, -1);
          } else if (event.altKey && event.key === 'ArrowRight') {
            event.preventDefault();
            moveProjectTab(identity.id, 1);
          } else if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
            event.preventDefault();
            openProjectTabMoveControls(identity.id);
          }
        }}
        onLostPointerCapture={(event) => {
          if (projectTabPointerDragRef.current?.pointerId === event.pointerId) {
            clearProjectTabDrag();
          }
        }}
        onPointerCancel={handleProjectTabPointerCancel}
        onPointerDown={(event) => handleProjectTabPointerDown(event, identity.id)}
        onPointerMove={handleProjectTabPointerMove}
        onPointerUp={handleProjectTabPointerEnd}
        role='tab'
        title={identity.name}
      >
        {selected && identity.kind === 'custom' ? (
          <div className='project-tab-editor flex min-w-0 flex-1 items-center gap-2'>
            {renderProjectMark(identity, selected)}
            <span className='project-tab-separator font-mono text-muted-foreground' aria-hidden='true'>/</span>
            <input
              aria-label={gt('Project name')}
              className='project-tab-name min-w-0 flex-1 bg-transparent font-medium outline-none'
              id={`project-tab-trigger-${identity.id}`}
              onChange={(event) => renameIdentity(identity.id, event.target.value)}
              value={identity.name}
            />
          </div>
        ) : (
          <button
            aria-label={gt('Open {name} project', { name: identity.name })}
            aria-keyshortcuts='Alt+ArrowLeft Alt+ArrowRight Shift+F10'
            className='flex min-w-0 flex-1 items-center gap-2 text-left'
            id={`project-tab-trigger-${identity.id}`}
            onClick={() => {
              setReorderControlsIdentityId(null);
              selectIdentity(identity.id);
            }}
            type='button'
          >
            {renderProjectMark(identity, selected)}
            <span className='project-tab-separator font-mono text-muted-foreground' aria-hidden='true'>/</span>
            <span className={`project-tab-name truncate ${selected ? 'font-medium text-foreground' : ''}`}>
              {identity.name}
            </span>
          </button>
        )}
        {reorderControlsOpen ? (
          <div
            aria-label={gt('Move {name} tab', { name: identity.name })}
            className='project-tab-reorder-controls'
            id={`project-tab-reorder-${identity.id}`}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setReorderControlsIdentityId(null);
                window.requestAnimationFrame(() => {
                  document
                    .getElementById(`project-tab-trigger-${identity.id}`)
                    ?.focus();
                });
              }
            }}
            role='menu'
          >
            <button
              aria-label={gt('Move {name} tab left', { name: identity.name })}
              disabled={visibleIndex <= 0}
              onClick={() => {
                moveProjectTab(identity.id, -1);
                setReorderControlsIdentityId(null);
              }}
              role='menuitem'
              title={gt('Move tab left')}
              type='button'
            >
              <ChevronLeft aria-hidden='true' />
            </button>
            <button
              aria-label={gt('Move {name} tab right', { name: identity.name })}
              disabled={visibleIndex < 0 || visibleIndex >= visibleIdentities.length - 1}
              onClick={() => {
                moveProjectTab(identity.id, 1);
                setReorderControlsIdentityId(null);
              }}
              role='menuitem'
              title={gt('Move tab right')}
              type='button'
            >
              <ChevronRight aria-hidden='true' />
            </button>
          </div>
        ) : null}
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
    <StudioExportProgressProvider>
    <main
      className='studio-app h-dvh overflow-hidden bg-background text-foreground'
      data-studio-accent={resolvedAppearance.accent}
      data-studio-canvas={resolvedAppearance.canvas}
      data-studio-corners={resolvedAppearance.corners}
      data-studio-density={resolvedAppearance.density}
      data-studio-font={resolvedAppearance.font}
      data-studio-motion={resolvedAppearance.motion}
      data-theme={resolvedAppearance.theme}
      data-resolved-theme={resolvedTheme}
    >
      <BrandFontFaces identity={activeIdentity} />
      <header className='app-navbar studio-app-header border-b border-border bg-background'>
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
            className='studio-command-launcher flex h-9 min-w-0 flex-1 max-w-xl items-center gap-2 border border-input bg-background px-3 text-left hover:border-foreground'
            onClick={() => {
              setQuery('');
              setCommandOpen(true);
            }}
            type='button'
          >
            <Search className='size-4 shrink-0 text-muted-foreground' aria-hidden='true' />
            <span className='min-w-0 flex-1 truncate text-sm text-muted-foreground'><T>Search Studio tools…</T></span>
            <kbd className='hidden border border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground sm:inline'>⌘K</kbd>
          </button>
          <div className='studio-appearance-toolbar ml-auto flex shrink-0 items-center gap-1.5'>
            <GitHubStarButton className='studio-github-star-button' />
            <Button asChild size='icon-sm' title={gt('Documentation')} variant='outline'>
              <Link aria-label={gt('Open documentation')} href='/docs'>
                <BookOpen aria-hidden='true' />
              </Link>
            </Button>
            <AppearanceMenu
              appearance={resolvedAppearance}
              onChange={(patch) => {
                if (patch.theme) setProviderTheme(patch.theme);
                setAppearance((current) => ({
                  ...DEFAULT_APPEARANCE,
                  ...current,
                  ...patch,
                }));
              }}
            />
            <Button
              aria-label={
                resolvedTheme === 'light'
                  ? gt('Switch to dark mode')
                  : gt('Switch to light mode')
              }
              onClick={() => {
                const nextTheme = resolvedTheme === 'light' ? 'dark' : 'light';
                setProviderTheme(nextTheme);
                setAppearance((current) => ({
                  ...DEFAULT_APPEARANCE,
                  ...current,
                  theme: nextTheme,
                }));
              }}
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
        <SidebarDitherPanel />
        <div
          className='app-navbar project-tabs flex min-w-0 items-end gap-2 px-2'
          data-tab-density={projectTabDensity}
        >
          <div className='project-tabs-rail min-w-0 flex-1 self-stretch'>
            <button
              aria-label={gt('Scroll project tabs left')}
              className='project-tabs-scroll-cue project-tabs-scroll-cue--left'
              data-visible={tabScrollState.canScrollLeft ? 'true' : 'false'}
              disabled={!tabScrollState.canScrollLeft}
              onClick={() => scrollProjectTabs(-1)}
              type='button'
            >
              <ChevronLeft aria-hidden='true' />
            </button>
            <div
              className='project-tabs-scroll studio-scroll-area flex min-w-0 items-end gap-2 overflow-x-auto self-stretch'
              ref={projectTabsScrollRef}
            >
              <div className='project-tabs-tablist flex shrink-0 items-end gap-1.5 self-stretch' role='tablist' aria-label={gt('Brand projects')}>
                {activeProjectTabIndex >= 0 ? (
                  <span
                    aria-hidden='true'
                    className='project-tab-selection'
                    ref={projectTabSelectionRef}
                    style={{
                      transform: `translate3d(calc(${activeProjectTabIndex} * (var(--project-tab-width) + var(--project-tab-gap))), 0, 0)`,
                    }}
                  />
                ) : null}
                {visibleIdentities.map(renderProjectTab)}
              </div>
              <span aria-live='polite' className='sr-only'>
                {tabOrderAnnouncement}
              </span>
              {visibleIdentities.length === 0 ? (
                <span className='mb-2 shrink-0 px-2 text-xs text-muted-foreground'>
                  <T>No brands in this folder</T>
                </span>
              ) : null}
              <Button aria-label={gt('Add brand project')} className='project-tab-add mb-1.5 shrink-0' disabled={!identitiesReady} onClick={addIdentity} size='icon-sm' type='button' variant='outline'>
                <Plus aria-hidden='true' />
              </Button>
            </div>
            <button
              aria-label={gt('Scroll project tabs right')}
              className='project-tabs-scroll-cue project-tabs-scroll-cue--right'
              data-visible={tabScrollState.canScrollRight ? 'true' : 'false'}
              disabled={!tabScrollState.canScrollRight}
              onClick={() => scrollProjectTabs(1)}
              type='button'
            >
              <ChevronRight aria-hidden='true' />
            </button>
          </div>
          <div className='project-tabs-actions ml-auto flex h-8 shrink-0 self-center items-center gap-1.5 border-l border-border pl-2'>
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
              identities={resolvedIdentities}
              onOpenProject={selectIdentity}
              onSelect={selectProjectFolder}
              openIdentityIds={openIdentityIds}
            />
          </div>
        </div>
      </div>

      <div className='studio-app-body'>
        <aside className='app-navbar studio-nav flex min-h-0 flex-col border-r border-border bg-background'>
          <nav aria-label={gt('Studio help')} className='studio-sidebar-help'>
            <Button asChild className='h-9 flex-1 justify-start px-2.5' variant='ghost'>
              <Link href='/docs'><BookOpen aria-hidden='true' /><T>Docs</T></Link>
            </Button>
            <Button asChild className='h-9 flex-1 justify-start px-2.5' variant='ghost'>
              <Link href='/docs/getting-started'><Rocket aria-hidden='true' /><T>Quickstart</T></Link>
            </Button>
          </nav>
          <div className='studio-sidebar-scroll studio-scroll-area min-h-0 flex-1 overflow-y-auto px-2 py-3'>
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
                      const Icon = STUDIO_TOOL_ICONS[tool.id];
                      const selected = activeToolId === tool.id;
                      return (
                        <Button
                          className='h-9 w-full justify-start border-0 px-2.5'
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
          <div
            className='studio-workspace-view'
            data-motion-direction={workspaceDirectionRef.current}
            key={`${activeIdentity.id}-${activeIdentityIsOpen ? 'open' : 'closed'}`}
          >
            {!activeIdentityIsOpen ? (
              <div className='studio-closed-projects-empty'>
                <Folder aria-hidden='true' />
                <div>
                  <h2><T>No project tab open</T></h2>
                  <p><T>Your brands and every saved draft are still available in the project folder menu.</T></p>
                </div>
              </div>
            ) : (
              <>
                {activeToolId === 'animation' || retainedWorkspaceToolIds.includes('animation') ? (
                  <div
                    aria-hidden={activeToolId !== 'animation'}
                    className='studio-workspace-panel'
                    hidden={activeToolId !== 'animation'}
                    inert={activeToolId !== 'animation'}
                  >
                    <AnimationStudio
                      embedded
                      identity={activeIdentity}
                    />
                  </div>
                ) : null}
                {MATERIAL_TOOL && (
                  activeToolId === 'material' || retainedWorkspaceToolIds.includes('material')
                ) ? (
                  <div
                    aria-hidden={activeToolId !== 'material'}
                    className='studio-workspace-panel'
                    hidden={activeToolId !== 'material'}
                    inert={activeToolId !== 'material'}
                  >
                    <StudioToolWorkspace
                      hasPendingIdentityChanges={activeIdentityHasPendingChanges}
                      identity={activeIdentity}
                      onIdentityChange={updateIdentity}
                      tool={MATERIAL_TOOL}
                    />
                  </div>
                ) : null}
                {activeToolId === 'animation' || activeToolId === 'material' ? null : (
                  <div
                    className='studio-workspace-panel'
                    key={`${activeIdentity.id}-${activeTool.id}`}
                  >
                    {activeToolId === 'identity' ? (
                      <BrandSettingsStudio
                        hasPendingChanges={activeIdentityHasPendingChanges}
                        identity={activeIdentity}
                        onChange={updateIdentity}
                        tool={activeTool}
                      />
                    ) : activeToolId === 'lottie' ? (
                      <LottieStudio identity={activeIdentity} />
                    ) : (
                      <StudioToolWorkspace
                        hasPendingIdentityChanges={activeIdentityHasPendingChanges}
                        identity={activeIdentity}
                        onIdentityChange={updateIdentity}
                        tool={activeTool}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
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
      {activeIdentityHasPendingChanges ? (
        <div aria-live='polite' className='studio-save-toast' role='status'>
          <div className='studio-save-toast-copy'>
            <strong><T>Save these brand changes?</T></strong>
            <span><T>Apply them across every design, or ignore this draft.</T></span>
          </div>
          <Button
            onClick={() => ignoreIdentityChanges(activeIdentity.id)}
            size='sm'
            type='button'
            variant='ghost'
          >
            <T>Ignore</T>
          </Button>
          <Button
            onClick={() => saveIdentityChanges(activeIdentity.id)}
            size='sm'
            type='button'
          >
            <Save aria-hidden='true' />
            <T>Save changes</T>
          </Button>
        </div>
      ) : null}
    </main>
    </StudioExportProgressProvider>
  );
}
