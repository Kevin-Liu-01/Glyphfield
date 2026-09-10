'use client';

import { Books, Check, ChevronDown, CloudArrowUp, CloudCheck, CloudWarning, Copy, FilePenLine, GitFork, Plus, Save, Trash2, X } from '@/components/ui/SolidIcons';
import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode, type RefObject } from 'react';
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
    const firstControl = surfaceRef.current?.querySelector<HTMLElement>('button[aria-current="true"]:not(:disabled)')
      ?? surfaceRef.current?.querySelector<HTMLElement>('[data-design-version-open]:not(:disabled), button:not(:disabled)');
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

function SavedDesignRow({
  active, defaultName, design, itemLabel, onClone, onDelete, onOpen, onRename, saving,
}: {
  active: boolean;
  defaultName: string;
  design: SavedDesign;
  itemLabel: string;
  onClone: (design: SavedDesign) => void;
  onDelete: (design: SavedDesign) => void;
  onOpen: (design: SavedDesign) => void;
  onRename: (design: SavedDesign, name: string) => void;
  saving: boolean;
}) {
  const [mode, setMode] = useState<'browse' | 'rename' | 'delete'>('browse');
  const [draft, setDraft] = useState(design.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const editingRef = useRef(false);
  const returnFocusRef = useRef<'rename' | 'delete' | null>(null);

  useLayoutEffect(() => {
    if (mode === 'rename') {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    } else if (mode === 'delete') {
      cancelDeleteRef.current?.focus({ preventScroll: true });
    } else if (returnFocusRef.current) {
      const target = returnFocusRef.current === 'rename' ? renameRef : deleteRef;
      target.current?.focus({ preventScroll: true });
      returnFocusRef.current = null;
    }
  }, [mode]);

  function finishRename(commit: boolean, restoreFocus = true) {
    if (!editingRef.current) return;
    editingRef.current = false;
    returnFocusRef.current = restoreFocus ? 'rename' : null;
    setMode('browse');
    if (commit && draft !== design.name) onRename(design, draft);
  }

  function cancelDelete() {
    returnFocusRef.current = 'delete';
    setMode('browse');
  }

  return (
    <div
      className={styles.designRow}
      data-active={String(active)}
      data-mode={mode}
      onBlur={(event) => {
        if (mode === 'rename' && !event.currentTarget.contains(event.relatedTarget as Node | null)) finishRename(true, false);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || mode === 'browse') return;
        event.preventDefault();
        event.stopPropagation();
        if (mode === 'rename') finishRename(false);
        else cancelDelete();
      }}
    >
      {mode === 'rename' ? (
        <>
          <input
            aria-label={`${active ? 'Current' : 'Saved'} ${itemLabel} name`}
            className={styles.nameInput}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) return;
              event.preventDefault();
              event.stopPropagation();
              finishRename(true);
            }}
            ref={inputRef}
            value={draft}
          />
          <div className={styles.rowActions}>
            {/* Safari does not focus clicked buttons: keep input focus until
                the explicit action decides whether to commit or cancel. */}
            <button aria-label='Save name' disabled={saving} onClick={() => finishRename(true)} onPointerDown={(event) => event.preventDefault()} title='Save name' type='button'><Check aria-hidden='true' /></button>
            <button aria-label='Cancel rename' onClick={() => finishRename(false)} onPointerDown={(event) => event.preventDefault()} title='Cancel rename' type='button'><X aria-hidden='true' /></button>
          </div>
        </>
      ) : (
        <>
          <button aria-current={active ? 'true' : undefined} className={styles.openDesign} data-design-version-open disabled={saving || mode === 'delete'} onClick={() => onOpen(design)} type='button'>
            <strong>{design.name || defaultName}</strong>
            <span className={styles.rowMetadata}>
              {active ? <span className={styles.currentBadge}>Current</span> : null}
              <span>{designDate(design.updatedAt)}</span>
            </span>
          </button>
          {mode === 'browse' ? <div className={styles.rowActions}>
            <button aria-label={`Rename ${design.name}`} disabled={saving} onClick={() => { setDraft(design.name); editingRef.current = true; setMode('rename'); }} ref={renameRef} title='Rename' type='button'><FilePenLine aria-hidden='true' /></button>
            <button aria-label={`Clone ${design.name}`} disabled={saving} onClick={() => onClone(design)} title={`Clone ${itemLabel}`} type='button'><Copy aria-hidden='true' /></button>
            <button aria-label={`Delete ${design.name}`} disabled={saving} onClick={() => setMode('delete')} ref={deleteRef} title={`Delete saved ${itemLabel}`} type='button'><Trash2 aria-hidden='true' /></button>
          </div> : <div className={styles.deleteConfirmation}>
            <span>Delete this checkpoint?</span>
            <button aria-label='Cancel deletion' disabled={saving} onClick={cancelDelete} ref={cancelDeleteRef} type='button'>Cancel</button>
            <button aria-label={`Confirm delete ${design.name}`} className={styles.deleteButton} disabled={saving} onClick={() => onDelete(design)} type='button'>Delete</button>
          </div>}
        </>
      )}
    </div>
  );
}

function DesignVersionsPopover({
  activeDesign,
  activeId,
  designs,
  dirty,
  error,
  loading,
  onClone,
  onDelete,
  onDismiss,
  onOpen,
  onRename,
  onSave,
  saveDisabled,
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
  dirty: boolean;
  error: string;
  loading: boolean;
  onClone: (design: SavedDesign) => void;
  onDelete: (design: SavedDesign) => void;
  onDismiss: () => void;
  onOpen: (design: SavedDesign) => Promise<void>;
  onRename: (design: SavedDesign, name: string) => void;
  onSave: () => void;
  saveDisabled: boolean;
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
        <strong>{collectionLabel}</strong>
        <span className={styles.count}>{designs.length}</span>
      </header>

      {!activeDesign && !loading ? (
        <div className={styles.unsavedCallout}>
          <span><strong>Autosaved draft</strong><small>Keep a named checkpoint.</small></span>
          <button aria-label={`Save ${itemLabel} checkpoint`} disabled={saveDisabled} onClick={onSave} type='button'><Plus aria-hidden='true' />Save checkpoint</button>
        </div>
      ) : null}

      <div className={`${styles.list} studio-scroll-area`}>
        {loading ? <p className={styles.empty}>Loading {collectionLabel.toLocaleLowerCase()}…</p> : sortedDesigns.length ? sortedDesigns.map((design) => (
          <SavedDesignRow
            active={design.id === activeId}
            defaultName={defaultName}
            design={design}
            itemLabel={itemLabel}
            key={design.id}
            onClone={onClone}
            onDelete={onDelete}
            onOpen={(selected) => { if (selected.id === activeId) onDismiss(); else void onOpen(selected); }}
            onRename={onRename}
            saving={saving}
          />
        )) : <p className={styles.empty}>{collectionLabel} will appear here.</p>}
      </div>
      <footer className={styles.popoverFooter}>
        <span>Saved in this browser</span>
        {activeDesign && dirty ? <button aria-label={`Save ${itemLabel} changes`} disabled={saveDisabled} onClick={onSave} type='button'><Save aria-hidden='true' />Save changes</button> : null}
      </footer>
      {error ? <p className={styles.error} role='alert'>{error}</p> : null}
    </div>
  );
}

function DesignVersionTrigger({
  activeDesign,
  autosaveState,
  compact = false,
  dirty,
  onToggle,
  open,
  visibleState,
  collectionLabel,
  draftLabel,
  descriptionId,
}: {
  activeDesign: SavedDesign | null;
  autosaveState: CanvasDocumentAutosaveState;
  compact?: boolean;
  dirty: boolean;
  onToggle: () => void;
  open: boolean;
  visibleState: string;
  collectionLabel: string;
  draftLabel: string;
  descriptionId?: string;
}) {
  const stateIsDirty = activeDesign ? dirty : autosaveState === 'error';
  return (
    <button
      aria-label={compact ? collectionLabel : `${collectionLabel}: ${activeDesign?.name ?? draftLabel}`}
      aria-describedby={descriptionId}
      aria-expanded={open}
      className={styles.trigger}
      data-compact={compact || undefined}
      data-dirty={String(stateIsDirty)}
      data-state={visibleState}
      onClick={onToggle}
      title={`Open ${collectionLabel.toLocaleLowerCase()}`}
      type='button'
    >
      <Books aria-hidden='true' />
      {compact ? null : <>
        <span className={styles.currentName}>{activeDesign?.name ?? draftLabel}</span>
        <ChevronDown aria-hidden='true' />
      </>}
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
  const controlsDisabled = loading || busy || !sourceReady;
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
      dirty, disabled: controlsDisabled,
      onClone: () => { void cloneDesign(); },
      onFork: () => { void forkDesign(); },
      onNew: onNew ? () => { void startNewDesign(); } : undefined,
      onSave: () => { void saveDesign(); },
      saving, itemLabel,
    },
    layout, notice, open, rootRef,
    onDismiss: () => setOpen(false),
    popover: {
      activeDesign, activeId, designs, dirty, error, loading,
      onClone: (design) => { void cloneStoredDesign(design); },
      onDelete: (design) => { void deleteDesign(design); },
      onDismiss: () => {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus({ preventScroll: true });
      },
      onOpen: openDesign,
      onRename: (design, name) => { void normalizeDesignName({ ...design, name }); },
      onSave: () => { void saveDesign(); },
      saveDisabled: controlsDisabled,
      saving: busy, sortedDesigns,
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

function DesignVersionOverlay({ layout, state }: {
  layout: 'panel' | 'toolbar';
  state: DesignVersionState;
}) {
  return <>
    {state.open ? (
      <DesignVersionsSurface anchorRef={state.rootRef} layout={layout} onDismiss={state.onDismiss}>
        <DesignVersionsPopover {...state.popover} />
      </DesignVersionsSurface>
    ) : null}
    <span aria-live='polite' className='sr-only'>{state.notice}</span>
  </>;
}

function DesignVersionHistoryContent({ compact, layout, state }: {
  compact?: boolean;
  layout: 'panel' | 'toolbar';
  state: DesignVersionState;
}) {
  return <>
    <DesignVersionTrigger {...state.trigger} compact={compact} />
    <DesignVersionOverlay layout={layout} state={state} />
  </>;
}

export function DesignVersionHistory({ className = '', compact = false, layout }: {
  className?: string;
  compact?: boolean;
  layout?: 'panel' | 'toolbar';
}) {
  const state = useDesignVersionState();
  const resolvedLayout = layout ?? state.layout;
  return (
    <div className={`${styles.root} ${className}`.trim()} data-layout={resolvedLayout}
      ref={state.rootRef} data-design-version-controls data-design-version-history>
      <DesignVersionHistoryContent compact={compact} layout={resolvedLayout} state={state} />
    </div>
  );
}

export function DesignVersionFileActions() {
  const state = useDesignVersionState();
  return <DesignVersionActions {...state.actions} />;
}

/** Read-only save state for the shared header-owned design file controls. */
export function DesignVersionStatus({ className = '', compact = false, id }: { className?: string; compact?: boolean; id?: string }) {
  const state = useDesignVersionState();
  const { activeDesign, autosaveState, draftLabel, visibleState } = state.trigger;
  const name = activeDesign?.name ?? draftLabel;
  const error = state.popover.error;
  const label = error ? 'Save failed' : visibleState;
  const pending = !error && autosaveState !== 'error' && label !== 'Autosaved' && label !== 'Saved';
  const StatusIcon = error || autosaveState === 'error'
    ? CloudWarning
    : pending
      ? CloudArrowUp
      : CloudCheck;
  return <span aria-label={`${name}: ${label}`} className={`${styles.status} ${className}`.trim()}
    id={id} data-compact={compact || undefined}
    data-design-version-status data-error={Boolean(error) || autosaveState === 'error' || undefined}
    data-pending={pending || undefined}
    role='status' title={error || `${name}: ${label}`}>
    <StatusIcon aria-hidden='true' />
    <small className={compact ? 'sr-only' : undefined}>{label}</small>
  </span>;
}

/** Autosave, checkpoint actions, and the saved-design library share one header cluster. */
export function DesignVersionHeaderControls() {
  const state = useDesignVersionState();
  const statusId = useId();
  return (
    <div className={`${styles.root} ${styles.headerControls}`} data-design-version-controls
      data-design-version-header-controls data-design-version-history data-layout='toolbar' ref={state.rootRef}>
      <DesignVersionActions {...state.actions} />
      <DesignVersionTrigger {...state.trigger} descriptionId={statusId} />
      <DesignVersionStatus compact id={statusId} />
      <DesignVersionOverlay layout='toolbar' state={state} />
    </div>
  );
}

function CombinedDesignVersionControls() {
  const state = useDesignVersionState();
  return (
    <div className={styles.root} data-layout={state.layout} ref={state.rootRef} data-design-version-controls>
      <DesignVersionTrigger {...state.trigger} />
      <DesignVersionFileActions />
      <DesignVersionOverlay layout={state.layout} state={state} />
    </div>
  );
}

export default function DesignVersionControls(props: DesignVersionControlsProps) {
  return <DesignVersionProvider {...props}><CombinedDesignVersionControls /></DesignVersionProvider>;
}
