'use client';

import { Check, ChevronDown, Copy, GitFork, History, Plus, Save, Trash2 } from '@/components/ui/SolidIcons';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import type { CanvasDocumentAutosaveState } from '@/hooks/useCanvasDocumentAutosave';
import { useDismissibleMenu } from '@/hooks/useDismissibleMenu';
import { usePersistentState } from '@/hooks/usePersistentState';
import { canvasSourceContentRevision } from '@/lib/canvasDocument';
import {
  activeSavedDesignStorageKey,
  createSavedDesign,
  deleteSavedDesign as deleteSavedDesignFromStore,
  loadSavedDesigns,
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

function visibleDesignState(
  activeDesign: SavedDesign | null,
  dirty: boolean,
  autosaveState: CanvasDocumentAutosaveState
): string {
  if (activeDesign) return dirty ? 'Unsaved changes' : 'Saved';
  const labels = {
    error: 'Autosave failed',
    loading: 'Loading autosave',
    preparing: 'Preparing assets',
    saved: 'Autosaved',
    saving: 'Autosaving',
  } as const;
  return labels[autosaveState];
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
    <div aria-label={`${workspaceLabel} ${collectionLabel.toLocaleLowerCase()}`} className={styles.popover} role='region'>
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
            <button className={styles.openDesign} onClick={() => void onOpen(design)} type='button'>
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

export default function DesignVersionControls({
  autosaveState = 'saved',
  collectionLabel = 'Saved designs',
  defaultName = 'Untitled design',
  draftLabel = 'Autosaved draft',
  identityId,
  itemLabel = 'design',
  layout = 'toolbar',
  onNew,
  onOpen,
  revision,
  source,
  toolId,
  workspaceLabel,
}: {
  autosaveState?: CanvasDocumentAutosaveState;
  collectionLabel?: string;
  defaultName?: string;
  draftLabel?: string;
  identityId: string;
  itemLabel?: string;
  layout?: 'panel' | 'toolbar';
  onNew?: () => Promise<void> | void;
  onOpen: (source: string) => Promise<void> | void;
  revision?: string;
  source: string | null | (() => string | null);
  toolId: string;
  workspaceLabel: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const workspaceStorageKey = savedDesignStorageKey(identityId, toolId);
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
  const visibleState = visibleDesignState(activeDesign, dirty, autosaveState);
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

  useDismissibleMenu(rootRef, () => setOpen(false));

  function announce(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 1_800);
  }

  function readCurrentSource(): string {
    const value = typeof source === 'function' ? source() : source;
    if (value === null) throw new Error('Portable source is still being prepared.');
    return value;
  }

  async function createDesign(
    name: string,
    origin: SavedDesignOrigin,
    designSource?: string,
    parentId?: string,
    designRevision = currentRevision
  ): Promise<SavedDesign | null> {
    let resolvedSource: string;
    try {
      resolvedSource = designSource ?? readCurrentSource();
    } catch (sourceError) {
      setError(sourceError instanceof Error ? sourceError.message : 'Portable source is not ready.');
      setOpen(true);
      return null;
    }
    const now = new Date().toISOString();
    const design = createSavedDesign({
      designs,
      id: designId(),
      name,
      now,
      origin,
      parentId,
      revision: designRevision,
      source: resolvedSource,
    });
    setSaving(true);
    try {
      await saveSavedDesign(workspaceStorageKey, design);
      setDesigns((current) => [design, ...current.filter(({ id }) => id !== design.id)]);
      setActiveId(design.id);
      setError('');
      announce(origin === 'fork' ? 'Fork created' : origin === 'clone' ? 'Clone created' : 'Design saved');
      return design;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'This design could not be saved.');
      setOpen(true);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveDesign(): Promise<boolean> {
    if (!activeDesign) {
      return Boolean(await createDesign(defaultName, 'saved'));
    }
    let latestSource: string;
    try {
      latestSource = readCurrentSource();
    } catch (sourceError) {
      setError(sourceError instanceof Error ? sourceError.message : 'Portable source is not ready.');
      setOpen(true);
      return false;
    }
    const now = new Date().toISOString();
    const savedDesign: SavedDesign = {
      ...activeDesign,
      revision: currentRevision,
      source: latestSource,
      updatedAt: now,
    };
    setSaving(true);
    try {
      await saveSavedDesign(workspaceStorageKey, savedDesign);
      setDesigns((current) => updateSavedDesign(current, activeDesign.id, {
        revision: currentRevision,
        source: latestSource,
        updatedAt: now,
      }));
      setError('');
      announce('Changes saved');
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'These changes could not be saved.');
      setOpen(true);
      return false;
    } finally {
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
    designRevision?: string
  ) {
    return createDesign(
      `${design?.name ?? defaultName} · Copy`,
      'clone',
      designSource,
      undefined,
      designRevision
    );
  }

  async function startNewDesign() {
    if (!onNew) return;
    const preserved = activeDesign
      ? (!dirty || await saveDesign())
      : Boolean(await createDesign(defaultName, 'saved'));
    if (!preserved) return;
    try {
      await onNew();
      setActiveId(null);
      setOpen(false);
      setError('');
      announce(`New ${itemLabel} ready`);
    } catch (newError) {
      setError(newError instanceof Error ? newError.message : `A new ${itemLabel} could not be created.`);
      setOpen(true);
    }
  }

  async function cloneStoredDesign(design: SavedDesign) {
    const clone = await cloneDesign(
      design,
      design.source,
      design.revision ?? design.source
    );
    if (!clone) return;
    try {
      await onOpen(clone.source);
      setOpen(false);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'This clone could not be opened.');
    }
  }

  async function openDesign(design: SavedDesign) {
    try {
      await onOpen(design.source);
      setActiveId(design.id);
      setOpen(false);
      setError('');
      announce(`${design.name} opened`);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'This design could not be opened.');
    }
  }

  function renameDesign(design: SavedDesign, name: string) {
    setDesigns(updateSavedDesign(designs, design.id, { name }));
  }

  async function normalizeDesignName(design: SavedDesign) {
    const otherDesigns = designs.filter(({ id }) => id !== design.id);
    const name = uniqueDesignName(otherDesigns, design.name);
    const renamedDesign = { ...design, name };
    setSaving(true);
    try {
      await saveSavedDesign(workspaceStorageKey, renamedDesign);
      setDesigns((current) => updateSavedDesign(current, design.id, { name }));
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'This design name could not be saved.');
      setOpen(true);
    } finally {
      setSaving(false);
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

  return (
    <div className={styles.root} data-layout={layout} ref={rootRef} data-design-version-controls>
      <DesignVersionTrigger
        activeDesign={activeDesign}
        autosaveState={autosaveState}
        dirty={dirty}
        onToggle={() => setOpen((current) => !current)}
        open={open}
        visibleState={visibleState}
        collectionLabel={collectionLabel}
        draftLabel={draftLabel}
      />

      <DesignVersionActions
        dirty={dirty}
        disabled={loading || saving || !sourceReady}
        onClone={() => { void cloneDesign(); }}
        onFork={() => { void forkDesign(); }}
        onNew={onNew ? () => { void startNewDesign(); } : undefined}
        onSave={() => { void saveDesign(); }}
        saving={saving}
        itemLabel={itemLabel}
      />

      {open ? (
        <DesignVersionsPopover
          activeDesign={activeDesign}
          activeId={activeId}
          designs={designs}
          error={error}
          loading={loading}
          onClone={(design) => { void cloneStoredDesign(design); }}
          onDelete={(design) => { void deleteDesign(design); }}
          onNormalizeName={(design) => { void normalizeDesignName(design); }}
          onOpen={openDesign}
          onRename={renameDesign}
          saving={saving}
          sortedDesigns={sortedDesigns}
          collectionLabel={collectionLabel}
          defaultName={defaultName}
          itemLabel={itemLabel}
          workspaceLabel={workspaceLabel}
        />
      ) : null}
      <span aria-live='polite' className='sr-only'>{notice}</span>
    </div>
  );
}
