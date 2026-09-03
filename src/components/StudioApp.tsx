'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  useCallback,
  useDeferredValue,
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
} from '@/components/ui/SolidIcons';

import { useThemeOverride } from '@/components/AppThemeProvider';
import BrandFontFaces from '@/components/BrandFontFaces';
import GitHubStarButton from '@/components/GitHubStarButton';
import SidebarDitherPanel from '@/components/SidebarDitherPanel';
import StudioCommandPalette from '@/components/StudioCommandPalette';
import { StudioExportProgressProvider } from '@/components/StudioExportProgress';
import { STUDIO_TOOL_ICONS } from '@/components/StudioToolIcons';
import ThemeAwareBrandMark from '@/components/ThemeAwareBrandMark';
import { Button } from '@/components/ui/Button';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import StudioContextMenu, {
  contextMenuPositionFromElement,
  contextMenuPositionFromEvent,
  type StudioContextMenuPosition,
} from '@/components/ui/StudioContextMenu';
import StudioSelect from '@/components/ui/StudioSelect';
import { useHydrated, useMountEffect } from '@/hooks/useMountEffect';
import { useDismissibleMenu } from '@/hooks/useDismissibleMenu';
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
  type StudioTool,
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
type ProjectFolderId = 'all' | 'templates' | 'local' | 'examples';

type ProjectTabDragState = {
  originOrder: string[];
  placement: ProjectTabPlacement;
  pointerOffsetX: number;
  previewOrder: string[];
  sourceId: string;
  targetId: string;
};

type ProjectTabMenuState = {
  identityId: string;
  position: StudioContextMenuPosition;
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

function resolveStudioTheme(
  requestedTheme: StudioAppearance['theme'],
  systemTheme: string | undefined,
  themeReady: boolean
): ResolvedTheme {
  if (requestedTheme !== 'system') return requestedTheme;
  return themeReady && systemTheme === 'dark' ? 'dark' : 'light';
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

function readStoredIdentities(): BrandIdentity[] {
  const stored = window.localStorage.getItem(PROJECTS_STORAGE_KEY)
    ?? LEGACY_PROJECTS_STORAGE_KEYS
      .map((key) => window.localStorage.getItem(key))
      .find((value) => value !== null);
  return hydrateBrandIdentities(stored ? JSON.parse(stored) : null);
}

function resolveStoredStudioTool(storedTool: string | null, identityId: string): StudioToolId | null {
  if (storedTool === 'logo-shader' || storedTool === 'surface') return 'material';
  if (storedTool && storedTool in LEGACY_SURFACE_TOOL_MODES) {
    window.localStorage.setItem(
      `glyphfield-draft-v1:${identityId}:surface:mode-v2`,
      JSON.stringify(LEGACY_SURFACE_TOOL_MODES[storedTool as keyof typeof LEGACY_SURFACE_TOOL_MODES])
    );
    return 'material';
  }
  return storedTool && STUDIO_TOOLS.some(({ id }) => id === storedTool)
    ? storedTool as StudioToolId
    : null;
}

function resolveLaunchFolder(
  activeIdentity: BrandIdentity,
  requestedFolderId: ProjectFolderId | null,
  requestedProject: BrandIdentity | undefined,
  storedFolder: string | null
): { folderId: ProjectFolderId; persist: boolean } {
  if (requestedFolderId && identityBelongsToFolder(activeIdentity, requestedFolderId)) {
    return { folderId: requestedFolderId, persist: true };
  }
  if (requestedProject?.kind === 'example') return { folderId: 'examples', persist: true };
  if (
    storedFolder
    && isProjectFolderId(storedFolder)
    && identityBelongsToFolder(activeIdentity, storedFolder)
  ) return { folderId: storedFolder, persist: false };
  return { folderId: 'all', persist: false };
}

function loadStudioLaunchState() {
  const identities = readStoredIdentities();
  const parameters = new URLSearchParams(window.location.search);
  const requestedTool = parameters.get('tool');
  const requestedProjectId = parameters.get('project');
  const requestedFolderValue = parameters.get('folder');
  const requestedFolderId = requestedFolderValue && isProjectFolderId(requestedFolderValue)
    ? requestedFolderValue
    : null;
  const requestedProject = identities.find(({ id }) => id === requestedProjectId);
  const requestedFolderProject = requestedFolderId
    ? identities.find((identity) => identityBelongsToFolder(identity, requestedFolderId))
    : undefined;
  const storedIdentityId = window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY)
    ?? window.localStorage.getItem('gt-studio-active-identity-v2');
  const activeIdentity = requestedProject
    ?? requestedFolderProject
    ?? identities.find(({ id }) => id === storedIdentityId)
    ?? identities[0]
    ?? STARTER_BRAND_IDENTITY;
  return {
    activeIdentity,
    folder: resolveLaunchFolder(
      activeIdentity,
      requestedFolderId,
      requestedProject,
      window.localStorage.getItem(ACTIVE_FOLDER_STORAGE_KEY)
    ),
    hasStoredTabs: window.localStorage.getItem(OPEN_TABS_STORAGE_KEY) !== null,
    identities,
    requestedSelection: Boolean(requestedProject || requestedFolderProject),
    toolId: resolveStoredStudioTool(requestedTool, activeIdentity.id)
      ?? resolveStoredStudioTool(
        window.localStorage.getItem(ACTIVE_TOOL_STORAGE_KEY),
        activeIdentity.id
      ),
  };
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
  const openIdentityIdSet = useMemo(() => new Set(openIdentityIds), [openIdentityIds]);

  useDismissibleMenu(menuRef, () => setOpen(false), '[data-radix-popper-content-wrapper]');

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
              const isOpen = openIdentityIdSet.has(identity.id);
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

  useDismissibleMenu(menuRef, () => setOpen(false), '[data-radix-popper-content-wrapper]');

  return (
    <div className='appearance-menu' ref={menuRef}>
      <Button
        aria-expanded={open}
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
        <div aria-label={gt('Visual customization')} className='appearance-popover' role='region'>
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
              <StudioCheckbox
                checked={appearance.density === 'compact'}
                onChange={(event) => onChange({ density: event.target.checked ? 'compact' : 'comfortable' })}
                variant='switch'
              />
            </label>
            <label>
              <span>
                <strong><T>Reduce motion</T></strong>
                <small><T>Pause decorative effects</T></small>
              </span>
              <StudioCheckbox
                checked={appearance.motion === 'reduced'}
                onChange={(event) => onChange({ motion: event.target.checked ? 'reduced' : 'full' })}
                variant='switch'
              />
            </label>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ProjectTabContextMenu({
  activeIdentityId,
  identity,
  menu,
  onClose,
  onCloseOthers,
  onCloseTab,
  onDuplicate,
  onMove,
  onOpen,
  openCount,
  tabCount,
  tabIndex,
}: {
  activeIdentityId: string;
  identity: BrandIdentity | null;
  menu: ProjectTabMenuState | null;
  onClose: () => void;
  onCloseOthers: (identityId: string) => void;
  onCloseTab: (identityId: string) => void;
  onDuplicate: (identityId: string) => void;
  onMove: (identityId: string, direction: -1 | 1) => void;
  onOpen: (identityId: string) => void;
  openCount: number;
  tabCount: number;
  tabIndex: number;
}) {
  const gt = useGT();
  return (
    <StudioContextMenu
      detail={identity ? (identity.kind === 'custom' ? gt('My brand') : gt(identity.kind)) : undefined}
      label={identity?.name ?? gt('Project')}
      onClose={onClose}
      position={menu?.position ?? null}
      sections={identity ? [
        {
          items: [
            {
              checked: identity.id === activeIdentityId,
              icon: <ThemeAwareBrandMark className='size-[14px]' identity={identity} />,
              id: 'open-project',
              label: gt('Open project'),
              onSelect: () => onOpen(identity.id),
            },
            {
              icon: <Copy aria-hidden='true' />,
              id: 'duplicate-project',
              label: gt('Duplicate project'),
              onSelect: () => onDuplicate(identity.id),
            },
          ],
        },
        {
          label: gt('Tab order'),
          items: [
            {
              disabled: tabIndex <= 0,
              icon: <ChevronLeft aria-hidden='true' />,
              id: 'move-left',
              label: gt('Move tab left'),
              onSelect: () => onMove(identity.id, -1),
              shortcut: '⌥←',
            },
            {
              disabled: tabIndex < 0 || tabIndex >= tabCount - 1,
              icon: <ChevronRight aria-hidden='true' />,
              id: 'move-right',
              label: gt('Move tab right'),
              onSelect: () => onMove(identity.id, 1),
              shortcut: '⌥→',
            },
          ],
        },
        {
          items: [
            {
              icon: <X aria-hidden='true' />,
              id: 'close-tab',
              label: gt('Close tab'),
              onSelect: () => onCloseTab(identity.id),
            },
            {
              disabled: openCount <= 1,
              icon: <PanelTopClose aria-hidden='true' />,
              id: 'close-others',
              label: gt('Close other tabs'),
              onSelect: () => onCloseOthers(identity.id),
            },
          ],
        },
      ] : []}
    />
  );
}

function ProjectTabMark({ identity, selected }: { identity: BrandIdentity; selected: boolean }) {
  return (
    <ThemeAwareBrandMark
      className='project-tab-mark'
      identity={identity}
      inverse={selected}
    />
  );
}

const PERSISTENT_LAB_TOOL_IDS = ['material'] as const satisfies readonly StudioToolId[];

function isPersistentLabTool(toolId: StudioToolId): toolId is typeof PERSISTENT_LAB_TOOL_IDS[number] {
  return PERSISTENT_LAB_TOOL_IDS.includes(toolId as typeof PERSISTENT_LAB_TOOL_IDS[number]);
}

function StudioWorkspacePanels({
  activeIdentity,
  activeTool,
  activeToolId,
  hasPendingIdentityChanges,
  onIdentityChange,
  onIdentitySave,
}: {
  activeIdentity: BrandIdentity;
  activeTool: StudioTool;
  activeToolId: StudioToolId;
  hasPendingIdentityChanges: boolean;
  onIdentityChange: (identity: BrandIdentity) => void;
  onIdentitySave: (identity: BrandIdentity) => void;
}) {
  const deferredActiveToolId = useDeferredValue(activeToolId);
  if (isPersistentLabTool(activeToolId)) {
    return (
      <div className='studio-workspace-panel studio-workspace-panel--persistent-labs'>
        {PERSISTENT_LAB_TOOL_IDS.map((toolId) => {
          const tool = STUDIO_TOOLS.find((candidate) => candidate.id === toolId);
          if (!tool) return null;
          const active = activeToolId === toolId;
          const renderActive = deferredActiveToolId === toolId;
          return (
            <div
              aria-hidden={!active}
              className='studio-workspace-layer'
              data-active={active ? 'true' : 'false'}
              inert={!active}
              key={`${activeIdentity.id}-${toolId}`}
            >
              <StudioToolWorkspace
                active={renderActive}
                hasPendingIdentityChanges={hasPendingIdentityChanges}
                identity={activeIdentity}
                onIdentityChange={onIdentityChange}
                onIdentitySave={onIdentitySave}
                tool={tool}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className='studio-workspace-panel'
      key={`${activeIdentity.id}-${activeTool.id}`}
    >
      {activeToolId === 'animation' ? (
          <AnimationStudio embedded identity={activeIdentity} />
      ) : activeToolId === 'identity' ? (
        <BrandSettingsStudio
          hasPendingChanges={hasPendingIdentityChanges}
          identity={activeIdentity}
          onChange={onIdentityChange}
          tool={activeTool}
        />
      ) : activeToolId === 'lottie' ? (
        <LottieStudio identity={activeIdentity} />
      ) : (
        <StudioToolWorkspace
          hasPendingIdentityChanges={hasPendingIdentityChanges}
          identity={activeIdentity}
          onIdentityChange={onIdentityChange}
          onIdentitySave={onIdentitySave}
          tool={activeTool}
        />
      )}
    </div>
  );
}

function ClosedProjectNotice() {
  return (
    <div className='studio-closed-projects-empty'>
      <Folder aria-hidden='true' />
      <div>
        <h2><T>No project tab open</T></h2>
        <p><T>Your brands and every saved draft are still available in the project folder menu.</T></p>
      </div>
    </div>
  );
}

function StudioSaveToast({
  identityId,
  onIgnore,
  onSave,
  visible,
}: {
  identityId: string;
  onIgnore: (identityId: string) => void;
  onSave: (identityId: string) => void;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div aria-live='polite' className='studio-save-toast' role='status'>
      <div className='studio-save-toast-copy'>
        <strong><T>Save these brand changes?</T></strong>
        <span><T>Apply them across every design, or ignore this draft.</T></span>
      </div>
      <Button onClick={() => onIgnore(identityId)} size='sm' type='button' variant='ghost'>
        <T>Ignore</T>
      </Button>
      <Button onClick={() => onSave(identityId)} size='sm' type='button'>
        <Save aria-hidden='true' />
        <T>Save changes</T>
      </Button>
    </div>
  );
}

function StudioAppHeader({
  activeToolId,
  appearance,
  onAppearanceChange,
  onCommandOpen,
  onThemeChange,
  onToolSelect,
  resolvedTheme,
}: {
  activeToolId: StudioToolId;
  appearance: StudioAppearance;
  onAppearanceChange: (patch: Partial<StudioAppearance>) => void;
  onCommandOpen: () => void;
  onThemeChange: (theme: ResolvedTheme) => void;
  onToolSelect: (toolId: StudioToolId) => void;
  resolvedTheme: ResolvedTheme;
}) {
  const gt = useGT();
  const alternateTheme = resolvedTheme === 'light' ? 'dark' : 'light';
  const alternateThemeLabel = resolvedTheme === 'light' ? gt('Dark mode') : gt('Light mode');

  return (
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
          onValueChange={(value) => onToolSelect(value as StudioToolId)}
          options={STUDIO_TOOLS.map((tool) => ({ label: gt(tool.name), value: tool.id }))}
          value={activeToolId}
        />
        <button
          aria-haspopup='dialog'
          aria-keyshortcuts='Meta+K Control+K /'
          className='studio-command-launcher flex h-9 min-w-0 flex-1 max-w-xl items-center gap-2 border border-input bg-background px-3 text-left hover:border-foreground'
          onClick={onCommandOpen}
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
          <AppearanceMenu appearance={appearance} onChange={onAppearanceChange} />
          <Button
            aria-label={gt('Switch to {theme} mode', { theme: alternateTheme })}
            onClick={() => onThemeChange(alternateTheme)}
            size='icon-sm'
            title={alternateThemeLabel}
            type='button'
            variant='outline'
          >
            {alternateTheme === 'dark' ? <Moon aria-hidden='true' /> : <Sun aria-hidden='true' />}
          </Button>
        </div>
      </div>
    </header>
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
  const [projectTabMenu, setProjectTabMenu] = useState<ProjectTabMenuState | null>(null);
  const [tabOrderAnnouncement, setTabOrderAnnouncement] = useState('');
  const projectTabsScrollRef = useRef<HTMLDivElement>(null);
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
  const themeReady = useHydrated();
  const resolvedAppearance = { ...DEFAULT_APPEARANCE, ...appearance };
  const resolvedTheme = resolveStudioTheme(
    resolvedAppearance.theme,
    systemTheme,
    themeReady
  );

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
  const openIdentityIdSet = useMemo(() => new Set(openIdentityIds), [openIdentityIds]);
  const activeIdentityIsOpen = openIdentityIdSet.has(activeIdentity?.id ?? '');
  const projectTabMenuIdentity = projectTabMenu
    ? identityById.get(projectTabMenu.identityId) ?? null
    : null;
  const projectTabMenuIndex = projectTabMenuIdentity
    ? visibleIdentities.findIndex(({ id }) => id === projectTabMenuIdentity.id)
    : -1;
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

  useMountEffect(() => {
    try {
      const launch = loadStudioLaunchState();
      setIdentities(launch.identities);
      if (!launch.hasStoredTabs || launch.requestedSelection) {
        setOpenIdentityIds((current) => {
          const initialIds = launch.hasStoredTabs
            ? current
            : [
                STARTER_BRAND_IDENTITY.id,
                GT_BRAND_IDENTITY.id,
              ];
          return !initialIds.includes(launch.activeIdentity.id)
            ? [...initialIds, launch.activeIdentity.id]
            : initialIds;
        });
      }
      setActiveIdentityId(launch.activeIdentity.id);
      if (launch.requestedSelection) {
        window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, launch.activeIdentity.id);
      }
      if (launch.toolId) setActiveToolId(launch.toolId);
      setActiveFolderId(launch.folder.folderId);
      if (launch.folder.persist) {
        window.localStorage.setItem(ACTIVE_FOLDER_STORAGE_KEY, launch.folder.folderId);
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
    setActiveToolId(toolId);
    setQuery('');
    window.localStorage.setItem(ACTIVE_TOOL_STORAGE_KEY, toolId);
  }

  function closeCommandPalette() {
    setCommandOpen(false);
    setQuery('');
  }

  const commitIdentities = useCallback((nextIdentities: BrandIdentity[]) => {
    setIdentities(nextIdentities);
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(nextIdentities));
  }, []);

  function selectIdentity(identityId: string) {
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
    if (projectTabMenu?.identityId === identityId) setProjectTabMenu(null);

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

  function activateCreatedIdentity(identity: BrandIdentity) {
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

  function addIdentity() {
    const customCount = identities.filter(({ kind }) => kind === 'custom').length;
    activateCreatedIdentity(createBrandIdentity(`Brand ${customCount + 1}`));
  }

  function copyIdentityById(identityId: string) {
    const identity = identityById.get(identityId);
    if (!identity) return;
    activateCreatedIdentity(duplicateBrandIdentity(identity));
  }

  function copyIdentity() {
    if (activeIdentity) copyIdentityById(activeIdentity.id);
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

  const saveIdentityImmediately = useCallback((nextIdentity: BrandIdentity) => {
    commitIdentities(
      identities.map((identity) => identity.id === nextIdentity.id ? nextIdentity : identity)
    );
    setPendingIdentities((current) => {
      if (!current[nextIdentity.id]) return current;
      const nextPendingIdentities = { ...current };
      delete nextPendingIdentities[nextIdentity.id];
      return nextPendingIdentities;
    });
  }, [commitIdentities, identities]);

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
      target.closest('.project-tab-close')
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
    const remainingTabs = pointerDrag.originOrder.reduce<Array<{ center: number; id: string }>>(
      (tabs, id, index) => {
        if (id !== pointerDrag.sourceId) tabs.push({ center: pointerDrag.centers[index] ?? 0, id });
        return tabs;
      },
      []
    );
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
      setProjectTabMenu(null);
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

  function openProjectTabContext(
    identityId: string,
    position: StudioContextMenuPosition
  ) {
    setProjectTabMenu({
      identityId,
      position: {
        ...position,
        anchor: document.getElementById(`project-tab-trigger-${identityId}`),
      },
    });
  }

  function renderProjectTab(identity: BrandIdentity) {
    const selected = identity.id === activeIdentity?.id;
    return (
      <div
        aria-label={identity.name}
        className={`project-tab relative flex items-center gap-2 border border-b-0 py-0 pr-1.5 pl-3 text-sm ${
          selected
            ? 'border-border bg-background text-foreground'
            : 'border-border/65 bg-muted/25 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
        }`}
        data-project-id={identity.id}
        data-selected={selected ? 'true' : 'false'}
        data-studio-context-trigger='project-tab'
        key={identity.id}
        onClickCapture={(event) => {
          if (suppressProjectTabClickRef.current !== identity.id) return;
          event.preventDefault();
          event.stopPropagation();
          suppressProjectTabClickRef.current = null;
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          openProjectTabContext(identity.id, contextMenuPositionFromEvent(event));
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
            openProjectTabContext(identity.id, contextMenuPositionFromElement(event.currentTarget));
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
        role='group'
        title={identity.name}
      >
        {selected && identity.kind === 'custom' ? (
          <div className='project-tab-editor flex min-w-0 flex-1 items-center gap-2'>
            <ProjectTabMark identity={identity} selected={selected} />
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
            aria-current={selected ? 'page' : undefined}
            aria-label={gt('Open {name} project', { name: identity.name })}
            aria-keyshortcuts='Alt+ArrowLeft Alt+ArrowRight Shift+F10'
            className='flex min-w-0 flex-1 items-center gap-2 text-left'
            id={`project-tab-trigger-${identity.id}`}
            onClick={() => {
              setProjectTabMenu(null);
              selectIdentity(identity.id);
            }}
            type='button'
          >
            <ProjectTabMark identity={identity} selected={selected} />
            <span className='project-tab-separator font-mono text-muted-foreground' aria-hidden='true'>/</span>
            <span className={`project-tab-name truncate ${selected ? 'font-medium text-foreground' : ''}`}>
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
      <StudioAppHeader
        activeToolId={activeToolId}
        appearance={resolvedAppearance}
        onAppearanceChange={(patch) => {
          if (patch.theme) setProviderTheme(patch.theme);
          setAppearance((current) => ({
            ...DEFAULT_APPEARANCE,
            ...current,
            ...patch,
          }));
        }}
        onCommandOpen={() => {
          setQuery('');
          setCommandOpen(true);
        }}
        onThemeChange={(theme) => {
          setProviderTheme(theme);
          setAppearance((current) => ({
            ...DEFAULT_APPEARANCE,
            ...current,
            theme,
          }));
        }}
        onToolSelect={selectTool}
        resolvedTheme={resolvedTheme}
      />

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
              <nav className='project-tabs-tablist flex shrink-0 items-end gap-1.5 self-stretch' aria-label={gt('Brand projects')}>
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
              </nav>
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
      <ProjectTabContextMenu
        activeIdentityId={activeIdentity.id}
        identity={projectTabMenuIdentity}
        menu={projectTabMenu}
        onClose={() => setProjectTabMenu(null)}
        onCloseOthers={(identityId) => {
          setOpenIdentityIds([identityId]);
          selectIdentity(identityId);
        }}
        onCloseTab={closeIdentity}
        onDuplicate={copyIdentityById}
        onMove={moveProjectTab}
        onOpen={selectIdentity}
        openCount={openIdentityIds.length}
        tabCount={visibleIdentities.length}
        tabIndex={projectTabMenuIndex}
      />

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
            key={`${activeIdentity.id}-${activeIdentityIsOpen ? 'open' : 'closed'}`}
          >
            {!activeIdentityIsOpen ? (
              <ClosedProjectNotice />
            ) : (
              <StudioWorkspacePanels
                activeIdentity={activeIdentity}
                activeTool={activeTool}
                activeToolId={activeToolId}
                hasPendingIdentityChanges={activeIdentityHasPendingChanges}
                onIdentityChange={updateIdentity}
                onIdentitySave={saveIdentityImmediately}
              />
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
      <StudioSaveToast
        identityId={activeIdentity.id}
        onIgnore={ignoreIdentityChanges}
        onSave={saveIdentityChanges}
        visible={activeIdentityHasPendingChanges}
      />
    </main>
    </StudioExportProgressProvider>
  );
}
