'use client';

import { Check, ChevronDown, Copy, GitFork, History, Plus, Save, Trash2 } from '@/components/ui/SolidIcons';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/Button';
import type { CanvasDocumentAutosaveState } from '@/hooks/useCanvasDocumentAutosave';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { usePersistentState } from '@/hooks/usePersistentState';
import { canvasSourceContentRevision } from '@/lib/canvasDocument';
import {
  activeSavedDesignStorageKey,
  createSavedDesign,
  deleteSavedDesign as deleteSavedDesignFromStore,
  loadSavedDesigns,
  renameSavedDesign,
  saveSavedDesign,
  savedDesignStorageKey,
  uniqueDesignName,
  updateSavedDesign,
  type SavedDesign,
  type SavedDesignOrigin,
} from '@/lib/savedDesigns';

import styles from './DesignVersionControls.module.css';

function designId(): string {
  return `design-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

function designDate(isoDate: string): string {
  const [date = isoDate] = isoDate.split('T');
  return date;
}

function designVersionStatus(
  activeDesign: SavedDesign | null,
  dirty: boolean,
  autosaveState: CanvasDocumentAutosaveState,
  saving: boolean,
  renaming: boolean,
  opening: boolean
): { busy: boolean; label: string } {
  if (opening) return { busy: true, label: 'Opening' };
  if (saving) return { busy: true, label: 'Saving' };
  if (renaming) return { busy: false, label: 'Saving name' };
  if (activeDesign) return { busy: false, label: dirty ? 'Unsaved changes' : 'Saved' };
  const labels = {
    error: 'Autosave failed',
    loading: 'Loading autosave',
    preparing: 'Preparing assets',
    saved: 'Autosaved',
    saving: 'Autosaving',
  } as const;
  return { busy: false, label: labels[autosaveState] };
}

function savedRevisionMatches(activeDesign: SavedDesign | null, currentRevision: string): boolean {
  if (!activeDesign) return false;
  return (activeDesign.revision ?? activeDesign.source) === currentRevision;
}

function comparableCanvasRevision(
  source: string | null,
  toolId: string,
  enabled: boolean
): number | null {
  if (!enabled || source === null) return null;
  return canvasSourceContentRevision(source, {
    omitMetadataKeys: toolId === 'animation' ? ['peaks'] : [],
  });
}

function DesignVersionsSurface({
  anchorRef,
  children,
  layout,
  onDismiss,
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  layout: 'panel' | 'toolbar';
  onDismiss: () => void;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const enteredRef = useRef(false);
  const dismissRef = useCommittedRef(onDismiss);
  const [placement, setPlacement] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (layout === 'panel') return;
    const position = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const bounds = anchor.getBoundingClientRect();
      const padding = 12;
      const width = Math.min(360, window.innerWidth - padding * 2);
      const below = Math.max(0, window.innerHeight - bounds.bottom - padding - 10);
      const above = Math.max(0, bounds.top - padding - 10);
      const placeBelow = below >= 300 || below >= above;
      const maxHeight = Math.max(80, placeBelow ? below : above);
      setPlacement({
        left: Math.max(padding, Math.min(bounds.right - width, window.innerWidth - width - padding)),
        maxHeight,
        top: placeBelow ? bounds.bottom + 10 : undefined,
        bottom: placeBelow ? undefined : window.innerHeight - bounds.top + 10,
        width,
      });
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [anchorRef, layout]);

  useLayoutEffect(() => {
    if (!placement || enteredRef.current) return;
    enteredRef.current = true;
    const firstControl = surfaceRef.current?.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)');
    const target = firstControl ?? surfaceRef.current?.querySelector<HTMLElement>('[role="region"]');
    target?.focus({ preventScroll: true });
  }, [placement]);

  useEffect(() => {
    const commitFocusedName = () => {
      if (document.activeElement instanceof HTMLElement && surfaceRef.current?.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    };
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || surfaceRef.current?.contains(target)) return;
      commitFocusedName();
      dismissRef.current();
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      // Commit an in-progress name before removing its focused field.
      commitFocusedName();
      dismissRef.current();
      anchorRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus({ preventScroll: true });
    };
    // Retained editors hide their own DOM, but a body portal lives outside those
    // inert layers. Watch both tool and project owners so keyboard/API navigation
    // cannot leave this editor's checkpoints over the next workspace.
    const owners = [
      anchorRef.current?.closest<HTMLElement>('.studio-workspace-layer'),
      anchorRef.current?.closest<HTMLElement>('.studio-project-workspace-layer'),
    ].filter((owner): owner is HTMLElement => Boolean(owner));
    const dismissInactiveOwner = () => {
      if (owners.every((owner) => owner.dataset.active !== 'false')) return;
      commitFocusedName();
      dismissRef.current();
    };
    const activityObserver = new MutationObserver(dismissInactiveOwner);
    owners.forEach((owner) => activityObserver.observe(owner, { attributeFilter: ['data-active'], attributes: true }));
    dismissInactiveOwner();
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      activityObserver.disconnect();
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [anchorRef, dismissRef]);

  const surface = (
    <div
      className={styles.surface}
      data-layout={layout}
      ref={surfaceRef}
      style={layout === 'toolbar' ? placement ?? { visibility: 'hidden' } : undefined}
    >
      {children}
    </div>
  );
  return layout === 'panel' ? surface : createPortal(surface, document.body);
}

function DesignVersionsPopover({
  activeDesign,
  activeId,
  designs,
  error,
  loading,
  onClone,
  onDelete,
  onNormalizeName,
  onOpen,
  onRename,
  saving,
  sortedDesigns,
  collectionLabel,
  defaultName,
  itemLabel,
  workspaceLabel,
}: {
  activeDesign: SavedDesign | null;
  activeId: string | null;
  designs: readonly SavedDesign[];
  error: string;
  loading: boolean;
  onClone: (design: SavedDesign) => void;
  onDelete: (design: SavedDesign) => void;
  onNormalizeName: (design: SavedDesign) => void;
  onOpen: (design: SavedDesign) => Promise<void>;
  onRename: (design: SavedDesign, name: string) => void;
  saving: boolean;
  sortedDesigns: readonly SavedDesign[];
  collectionLabel: string;
  defaultName: string;
  itemLabel: string;
  workspaceLabel: string;
}) {
  return (
    <div aria-label={`${workspaceLabel} ${collectionLabel.toLocaleLowerCase()}`} className={styles.popover} role='region' tabIndex={-1}>
      <header className={styles.popoverHeader}>
        <div><strong>{collectionLabel}</strong><span>{designs.length} stored in this browser</span></div>
        <span className={styles.workspace}>{workspaceLabel}</span>
      </header>

      {activeDesign ? (
        <label className={styles.nameField}>
          <span>Current {itemLabel} name</span>
          <input
            aria-label={`Current ${itemLabel} name`}
            disabled={saving}
            onBlur={() => onNormalizeName(activeDesign)}
            onChange={(event) => onRename(activeDesign, event.target.value)}
            value={activeDesign.name}
          />
        </label>
      ) : (
        <div className={styles.unsavedCallout}>
          <Save aria-hidden='true' />
          <span><strong>Current {itemLabel} is autosaved</strong><small>Save it as a named {itemLabel} whenever you want a checkpoint.</small></span>
        </div>
      )}

      <div className={styles.list}>
        {loading ? <p className={styles.empty}>Loading {collectionLabel.toLocaleLowerCase()}…</p> : sortedDesigns.length ? sortedDesigns.map((design) => (
          <div className={styles.designRow} data-active={design.id === activeId ? 'true' : 'false'} key={design.id}>
            <button className={styles.openDesign} disabled={saving} onClick={() => void onOpen(design)} type='button'>
              <span><strong>{design.name || defaultName}</strong><small>{design.origin} · {designDate(design.updatedAt)}</small></span>
              {design.id === activeId ? <Check aria-label={`Current ${itemLabel}`} /> : null}
            </button>
            <button aria-label={`Clone ${design.name}`} disabled={saving} onClick={() => onClone(design)} title='Clone this design' type='button'><Copy aria-hidden='true' /></button>
            <button aria-label={`Delete ${design.name}`} disabled={saving} onClick={() => onDelete(design)} title='Delete saved design' type='button'><Trash2 aria-hidden='true' /></button>
          </div>
        )) : <p className={styles.empty}>{collectionLabel} will appear here.</p>}
      </div>
      {error ? <p className={styles.error} role='alert'>{error}</p> : null}
    </div>
  );
}

function DesignVersionTrigger({
  activeDesign,
  autosaveState,
  dirty,
  onToggle,
  open,
  visibleState,
  collectionLabel,
  draftLabel,
}: {
  activeDesign: SavedDesign | null;
  autosaveState: CanvasDocumentAutosaveState;
  dirty: boolean;
  onToggle: () => void;
  open: boolean;
  visibleState: string;
  collectionLabel: string;
  draftLabel: string;
}) {
  const stateIsDirty = activeDesign ? dirty : autosaveState === 'error';
  return (
    <button
      aria-expanded={open}
      className={styles.trigger}
      onClick={onToggle}
      title={`Open ${collectionLabel.toLocaleLowerCase()}`}
      type='button'
    >
      <History aria-hidden='true' />
      <span className={styles.currentName}>{activeDesign?.name ?? draftLabel}</span>
      <span aria-label={visibleState} className={styles.stateDot} data-dirty={String(stateIsDirty)} />
      <ChevronDown aria-hidden='true' />
    </button>
  );
}

function DesignVersionActions({
  dirty,
  disabled,
  onClone,
  onFork,
  onNew,
  onSave,
  saving,
  itemLabel,
}: {
  dirty: boolean;
  disabled: boolean;
  onClone: () => void;
  onFork: () => void;
  onNew?: () => void;
  onSave: () => void;
  saving: boolean;
  itemLabel: string;
}) {
  const itemTitle = itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1);
  return (
    <div className={styles.actions}>
      {onNew ? (
        <Button aria-label={`New ${itemLabel}`} disabled={disabled} onClick={onNew} size='sm' type='button' variant='outline'>
          <Plus aria-hidden='true' />
          <span className={styles.actionLabel}>New</span>
        </Button>
      ) : null}
      <Button
        aria-label={dirty ? `Save ${itemLabel}` : `${itemTitle} saved`}
        disabled={disabled || !dirty}
        onClick={() => void onSave()}
        size='sm'
        title={dirty ? `Save ${itemLabel}` : `${itemTitle} saved`}
        type='button'
        variant={dirty ? 'default' : 'outline'}
      >
        {dirty ? <Save aria-hidden='true' /> : <Check aria-hidden='true' />}
        <span className={styles.actionLabel}>{saving ? 'Saving' : dirty ? 'Save' : 'Saved'}</span>
      </Button>
      <Button aria-label={`Fork ${itemLabel}`} disabled={disabled} onClick={() => void onFork()} size='icon-sm' title={`Fork into a linked ${itemLabel}`} type='button' variant='outline'>
        <GitFork aria-hidden='true' />
      </Button>
      <Button aria-label={`Clone ${itemLabel}`} disabled={disabled} onClick={() => void onClone()} size='icon-sm' title='Clone as an independent copy' type='button' variant='outline'>
        <Copy aria-hidden='true' />
      </Button>
    </div>
  );
}

export type DesignVersionControlsProps = {
  autosaveState?: CanvasDocumentAutosaveState;
  collectionLabel?: string;
  defaultName?: string;
  draftLabel?: string;
  identityId: string;
  itemLabel?: string;
  layout?: 'panel' | 'toolbar';
  onNew?: () => Promise<void> | void;
  onOpen: (source: string) => Promise<void> | void;
  prepareSource?: () => Promise<string | { source: string; revision: string }>;
  revision?: string;
  source: string | null | (() => string | null);
  toolId: string;
  workspaceLabel: string;
};

type DesignVersionState = {
  actions: ComponentProps<typeof DesignVersionActions>;
  layout: 'panel' | 'toolbar';
  notice: string;
  onDismiss: () => void;
  open: boolean;
  popover: ComponentProps<typeof DesignVersionsPopover>;
  rootRef: RefObject<HTMLDivElement | null>;
  trigger: ComponentProps<typeof DesignVersionTrigger>;
};

const DesignVersionContext = createContext<DesignVersionState | null>(null);

function useDesignVersionState(): DesignVersionState {
  const state = useContext(DesignVersionContext);
  if (!state) throw new Error('Design version controls require a DesignVersionProvider.');
  return state;
}

/** One checkpoint owner may place history and file actions in separate toolbars. */
export function DesignVersionProvider({
  autosaveState = 'saved',
  children,
  collectionLabel = 'Saved designs',
  defaultName = 'Untitled design',
  draftLabel = 'Autosaved draft',
  identityId,
  itemLabel = 'design',
  layout = 'toolbar',
  onNew,
  onOpen,
  prepareSource,
  revision,
  source,
  toolId,
  workspaceLabel,
}: DesignVersionControlsProps & { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const savePendingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const renameRequestRef = useRef(0);
  const workspaceStorageKey = savedDesignStorageKey(identityId, toolId);
  const workspaceKeyRef = useRef(workspaceStorageKey);
  useLayoutEffect(() => {
    workspaceKeyRef.current = workspaceStorageKey;
    return () => { workspaceKeyRef.current = ''; };
  }, [workspaceStorageKey]);
  const [activeId, setActiveId] = usePersistentState<string | null>(
    activeSavedDesignStorageKey(identityId, toolId),
    null
  );
  const activeDesign = designs.find(({ id }) => id === activeId) ?? null;
  const currentSource = typeof source === 'function' ? source() : source;
  const sourceReady = currentSource !== null;
  const currentRevision = revision ?? currentSource ?? '';
  const revisionsMatch = savedRevisionMatches(activeDesign, currentRevision);
  const compareCanvasContent = Boolean(activeDesign && !revisionsMatch && currentSource !== null);
  const currentContentRevision = useMemo(
    () => comparableCanvasRevision(currentSource, toolId, compareCanvasContent),
    [compareCanvasContent, currentSource, toolId]
  );
  const activeContentRevision = useMemo(
    () => comparableCanvasRevision(activeDesign?.source ?? null, toolId, compareCanvasContent),
    [activeDesign, compareCanvasContent, toolId]
  );
  const sameCanvasContent = currentContentRevision !== null
    && activeContentRevision !== null
    && currentContentRevision === activeContentRevision;
  const dirty = activeDesign
    ? !revisionsMatch && !sameCanvasContent
    : true;
  const { busy, label: visibleState } = designVersionStatus(activeDesign, dirty, autosaveState, saving, renaming, opening);
  const sortedDesigns = useMemo(
    () => [...designs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [designs]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void loadSavedDesigns(workspaceStorageKey).then((storedDesigns) => {
      if (!active) return;
      setDesigns(storedDesigns);
      setLoading(false);
    }).catch((loadError) => {
      if (!active) return;
      setLoading(false);
      setError(loadError instanceof Error ? loadError.message : 'Saved designs could not be loaded.');
    });
    return () => {
      active = false;
    };
  }, [workspaceStorageKey]);

  function announce(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 1_800);
  }

  async function readCurrentSource(): Promise<{ source: string; revision: string }> {
    const value = prepareSource ? await prepareSource() : typeof source === 'function' ? source() : source;
    if (workspaceKeyRef.current !== workspaceStorageKey) throw new Error('The workspace changed before this design could be saved.');
    if (value === null) throw new Error('Portable source is still being prepared.');
    return typeof value === 'string' ? { source: value, revision: currentRevision } : value;
  }

  async function createDesign(
    name: string,
    origin: SavedDesignOrigin,
    designSource?: string,
    parentId?: string,
    designRevision = currentRevision,
    activate = true
  ): Promise<SavedDesign | null> {
    if (savePendingRef.current) return null;
    savePendingRef.current = true;
    setSaving(true);
    try {
      const prepared = designSource === undefined ? await readCurrentSource() : { source: designSource, revision: designRevision };
      const design = createSavedDesign({
        designs,
        id: designId(),
        name,
        now: new Date().toISOString(),
        origin,
        parentId,
        revision: prepared.revision,
        source: prepared.source,
      });
      await saveSavedDesign(workspaceStorageKey, design);
      if (workspaceKeyRef.current !== workspaceStorageKey) return null;
      setDesigns((current) => [design, ...current.filter(({ id }) => id !== design.id)]);
      if (activate) setActiveId(design.id);
      setError('');
      announce(origin === 'fork' ? 'Fork created' : origin === 'clone' ? 'Clone created' : 'Design saved');
      return design;
    } catch (saveError) {
      if (workspaceKeyRef.current !== workspaceStorageKey) return null;
      setError(saveError instanceof Error ? saveError.message : 'This design could not be saved.');
      setOpen(true);
      return null;
    } finally {
      savePendingRef.current = false;
      setSaving(false);
    }
  }

  async function saveDesign(): Promise<boolean> {
    if (!activeDesign) {
      return Boolean(await createDesign(defaultName, 'saved'));
    }
    if (savePendingRef.current) return false;
    savePendingRef.current = true;
    setSaving(true);
    try {
      const prepared = await readCurrentSource();
      const now = new Date().toISOString();
      const savedDesign: SavedDesign = {
        ...activeDesign,
        revision: prepared.revision,
        source: prepared.source,
        updatedAt: now,
      };
      await saveSavedDesign(workspaceStorageKey, savedDesign);
      if (workspaceKeyRef.current !== workspaceStorageKey) return false;
      setDesigns((current) => updateSavedDesign(current, activeDesign.id, {
        revision: prepared.revision,
        source: prepared.source,
        updatedAt: now,
      }));
      setError('');
      announce('Changes saved');
      return true;
    } catch (saveError) {
      if (workspaceKeyRef.current !== workspaceStorageKey) return false;
      setError(saveError instanceof Error ? saveError.message : 'These changes could not be saved.');
      setOpen(true);
      return false;
    } finally {
      savePendingRef.current = false;
      setSaving(false);
    }
  }

  async function forkDesign() {
    await createDesign(
      `${activeDesign?.name ?? defaultName} · Fork`,
      'fork',
      undefined,
      activeDesign?.id
    );
  }

  async function cloneDesign(
    design = activeDesign,
    designSource?: string,
    designRevision?: string,
    activate = true
  ) {
    return createDesign(
      `${design?.name ?? defaultName} · Copy`,
      'clone',
      designSource,
      undefined,
      designRevision,
      activate
    );
  }

  async function startNewDesign() {
    if (!onNew) return;
    const preserved = activeDesign
      ? (!dirty || await saveDesign())
      : Boolean(await createDesign(defaultName, 'saved'));
    if (!preserved) return;
    setOpening(true);
    try {
      await onNew();
      setActiveId(null);
      setOpen(false);
      setError('');
      announce(`New ${itemLabel} ready`);
    } catch (newError) {
      setError(newError instanceof Error ? newError.message : `A new ${itemLabel} could not be created.`);
      setOpen(true);
    } finally {
      setOpening(false);
    }
  }

  async function cloneStoredDesign(design: SavedDesign) {
    if (busy) return;
    setOpening(true);
    const clone = await cloneDesign(
      design,
      design.source,
      design.revision ?? design.source,
      false
    );
    if (!clone) {
      setOpening(false);
      return;
    }
    try {
      await onOpen(clone.source);
      setActiveId(clone.id);
      setOpen(false);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'This clone could not be opened.');
    } finally {
      setOpening(false);
    }
  }

  async function openDesign(design: SavedDesign) {
    if (busy) return;
    setOpening(true);
    try {
      await onOpen(design.source);
      setActiveId(design.id);
      setOpen(false);
      setError('');
      announce(`${design.name} opened`);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'This design could not be opened.');
    } finally {
      setOpening(false);
    }
  }

  function renameDesign(design: SavedDesign, name: string) {
    setDesigns(updateSavedDesign(designs, design.id, { name }));
  }

  async function normalizeDesignName(design: SavedDesign) {
    const otherDesigns = designs.filter(({ id }) => id !== design.id);
    const name = uniqueDesignName(otherDesigns, design.name);
    const requestId = ++renameRequestRef.current;
    setDesigns((current) => updateSavedDesign(current, design.id, { name }));
    // Blur fires before a neighboring button's click. Naming must not disable
    // Save/Fork/Clone and swallow the user's next action.
    setRenaming(true);
    try {
      await renameSavedDesign(workspaceStorageKey, design.id, name);
      if (requestId !== renameRequestRef.current) return;
      setError('');
    } catch (saveError) {
      if (requestId !== renameRequestRef.current) return;
      setError(saveError instanceof Error ? saveError.message : 'This design name could not be saved.');
      setOpen(true);
    } finally {
      if (requestId === renameRequestRef.current) setRenaming(false);
    }
  }

  async function deleteDesign(design: SavedDesign) {
    setSaving(true);
    try {
      await deleteSavedDesignFromStore(workspaceStorageKey, design.id);
      setDesigns((current) => current.filter(({ id }) => id !== design.id));
      if (activeId === design.id) setActiveId(null);
      setError('');
      announce(`${design.name} removed`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'This design could not be removed.');
      setOpen(true);
    } finally {
      setSaving(false);
    }
  }

  const state: DesignVersionState = {
    actions: {
      dirty, disabled: loading || busy || !sourceReady,
      onClone: () => { void cloneDesign(); },
      onFork: () => { void forkDesign(); },
      onNew: onNew ? () => { void startNewDesign(); } : undefined,
      onSave: () => { void saveDesign(); },
      saving, itemLabel,
    },
    layout, notice, open, rootRef,
    onDismiss: () => setOpen(false),
    popover: {
      activeDesign, activeId, designs, error, loading,
      onClone: (design) => { void cloneStoredDesign(design); },
      onDelete: (design) => { void deleteDesign(design); },
      onNormalizeName: (design) => { void normalizeDesignName(design); },
      onOpen: openDesign, onRename: renameDesign, saving: busy, sortedDesigns,
      collectionLabel, defaultName, itemLabel, workspaceLabel,
    },
    trigger: {
      activeDesign, autosaveState, dirty, onToggle: () => setOpen((current) => !current),
      open, visibleState, collectionLabel, draftLabel,
    },
  };
  // Context updates only subscribed controls. Stable workspace children do not
  // rerender when a checkpoint opens, is renamed, or finishes saving.
  return <DesignVersionContext.Provider value={state}>{children}</DesignVersionContext.Provider>;
}

function DesignVersionHistoryContent({ children, layout, state }: {
  children?: ReactNode;
  layout: 'panel' | 'toolbar';
  state: DesignVersionState;
}) {
  return <>
    <DesignVersionTrigger {...state.trigger} />
    {children}
    {state.open ? (
      <DesignVersionsSurface anchorRef={state.rootRef} layout={layout} onDismiss={state.onDismiss}>
        <DesignVersionsPopover {...state.popover} />
      </DesignVersionsSurface>
    ) : null}
    <span aria-live='polite' className='sr-only'>{state.notice}</span>
  </>;
}

export function DesignVersionHistory({ className = '', layout }: {
  className?: string;
  layout?: 'panel' | 'toolbar';
}) {
  const state = useDesignVersionState();
  const resolvedLayout = layout ?? state.layout;
  return (
    <div className={`${styles.root} ${className}`.trim()} data-layout={resolvedLayout}
      ref={state.rootRef} data-design-version-controls data-design-version-history>
      <DesignVersionHistoryContent layout={resolvedLayout} state={state} />
    </div>
  );
}

export function DesignVersionFileActions() {
  const state = useDesignVersionState();
  return <DesignVersionActions {...state.actions} />;
}

function CombinedDesignVersionControls() {
  const state = useDesignVersionState();
  return (
    <div className={styles.root} data-layout={state.layout} ref={state.rootRef} data-design-version-controls>
      <DesignVersionHistoryContent layout={state.layout} state={state}>
        <DesignVersionFileActions />
      </DesignVersionHistoryContent>
    </div>
  );
}

export default function DesignVersionControls(props: DesignVersionControlsProps) {
  return <DesignVersionProvider {...props}><CombinedDesignVersionControls /></DesignVersionProvider>;
}
