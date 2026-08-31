'use client';

import { Check, ChevronDown, Copy, GitFork, History, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { useMountEffect } from '@/hooks/useMountEffect';
import { usePersistentState } from '@/hooks/usePersistentState';
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

export default function DesignVersionControls({
  autosaveState = 'saved',
  identityId,
  onOpen,
  revision,
  source,
  toolId,
  workspaceLabel,
}: {
  autosaveState?: 'error' | 'loading' | 'saved' | 'saving';
  identityId: string;
  onOpen: (source: string) => void;
  revision?: string;
  source: string | (() => string);
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
  const currentRevision = revision
    ?? (typeof source === 'function' ? source() : source);
  const dirty = activeDesign
    ? (activeDesign.revision ?? activeDesign.source) !== currentRevision
    : true;
  const visibleState = activeDesign
    ? dirty ? 'Unsaved changes' : 'Saved'
    : autosaveState === 'error'
      ? 'Autosave failed'
      : autosaveState === 'loading'
        ? 'Loading autosave'
        : autosaveState === 'saving'
          ? 'Autosaving'
          : 'Autosaved';
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

  useMountEffect(() => {
    function closeMenu(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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

  function announce(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 1_800);
  }

  async function createDesign(
    name: string,
    origin: SavedDesignOrigin,
    designSource = typeof source === 'function' ? source() : source,
    parentId?: string
  ): Promise<SavedDesign | null> {
    const now = new Date().toISOString();
    const design = createSavedDesign({
      designs,
      id: designId(),
      name,
      now,
      origin,
      parentId,
      revision: currentRevision,
      source: designSource,
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

  async function saveDesign() {
    if (!activeDesign) {
      await createDesign('Untitled design', 'saved');
      return;
    }
    const now = new Date().toISOString();
    const latestSource = typeof source === 'function' ? source() : source;
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
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'These changes could not be saved.');
      setOpen(true);
    } finally {
      setSaving(false);
    }
  }

  async function forkDesign() {
    await createDesign(
      `${activeDesign?.name ?? 'Untitled design'} · Fork`,
      'fork',
      typeof source === 'function' ? source() : source,
      activeDesign?.id
    );
  }

  async function cloneDesign(
    design = activeDesign,
    designSource = typeof source === 'function' ? source() : source
  ) {
    return createDesign(`${design?.name ?? 'Untitled design'} · Copy`, 'clone', designSource);
  }

  function openDesign(design: SavedDesign) {
    try {
      onOpen(design.source);
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
    <div className={styles.root} ref={rootRef} data-design-version-controls>
      <button
        aria-expanded={open}
        aria-haspopup='dialog'
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
        title='Open saved designs'
        type='button'
      >
        <History aria-hidden='true' />
        <span className={styles.currentName}>{activeDesign?.name ?? 'Autosaved draft'}</span>
        <span
          aria-label={visibleState}
          className={styles.stateDot}
          data-dirty={activeDesign ? dirty ? 'true' : 'false' : autosaveState === 'error' ? 'true' : 'false'}
        />
        <ChevronDown aria-hidden='true' />
      </button>

      <div className={styles.actions}>
        <Button
          aria-label={dirty ? 'Save design' : 'Design saved'}
          disabled={loading || saving || !dirty}
          onClick={() => void saveDesign()}
          size='sm'
          title={dirty ? 'Save design' : 'Design saved'}
          type='button'
          variant={dirty ? 'default' : 'outline'}
        >
          {dirty ? <Save aria-hidden='true' /> : <Check aria-hidden='true' />}
          <span className={styles.actionLabel}>{saving ? 'Saving' : dirty ? 'Save' : 'Saved'}</span>
        </Button>
        <Button aria-label='Fork design' disabled={loading || saving} onClick={() => void forkDesign()} size='icon-sm' title='Fork into a linked design' type='button' variant='outline'>
          <GitFork aria-hidden='true' />
        </Button>
        <Button aria-label='Clone design' disabled={loading || saving} onClick={() => void cloneDesign()} size='icon-sm' title='Clone as an independent copy' type='button' variant='outline'>
          <Copy aria-hidden='true' />
        </Button>
      </div>

      {open ? (
        <div aria-label={`${workspaceLabel} saved designs`} className={styles.popover} role='dialog'>
          <header className={styles.popoverHeader}>
            <div><strong>Saved designs</strong><span>{designs.length} stored in this browser</span></div>
            <span className={styles.workspace}>{workspaceLabel}</span>
          </header>

          {activeDesign ? (
            <label className={styles.nameField}>
              <span>Current design name</span>
              <input
                aria-label='Current design name'
                disabled={saving}
                onBlur={() => void normalizeDesignName(activeDesign)}
                onChange={(event) => renameDesign(activeDesign, event.target.value)}
                value={activeDesign.name}
              />
            </label>
          ) : (
            <div className={styles.unsavedCallout}>
              <Save aria-hidden='true' />
              <span><strong>Current canvas is autosaved</strong><small>Save it as a named design whenever you want a checkpoint.</small></span>
            </div>
          )}

          <div className={styles.list}>
            {loading ? <p className={styles.empty}>Loading saved designs…</p> : sortedDesigns.length ? sortedDesigns.map((design) => (
              <div className={styles.designRow} data-active={design.id === activeId ? 'true' : 'false'} key={design.id}>
                <button className={styles.openDesign} onClick={() => openDesign(design)} type='button'>
                  <span><strong>{design.name || 'Untitled design'}</strong><small>{design.origin} · {designDate(design.updatedAt)}</small></span>
                  {design.id === activeId ? <Check aria-label='Current design' /> : null}
                </button>
                <button aria-label={`Clone ${design.name}`} disabled={saving} onClick={() => {
                  void createDesign(`${design.name} · Copy`, 'clone', design.source).then((clone) => {
                    if (!clone) return;
                    try {
                      onOpen(clone.source);
                      setOpen(false);
                    } catch (openError) {
                      setError(openError instanceof Error ? openError.message : 'This clone could not be opened.');
                    }
                  });
                }} title='Clone this design' type='button'><Copy aria-hidden='true' /></button>
                <button aria-label={`Delete ${design.name}`} disabled={saving} onClick={() => void deleteDesign(design)} title='Delete saved design' type='button'><Trash2 aria-hidden='true' /></button>
              </div>
            )) : <p className={styles.empty}>Saved designs will appear here.</p>}
          </div>
          {error ? <p className={styles.error} role='alert'>{error}</p> : null}
        </div>
      ) : null}
      <span aria-live='polite' className='sr-only'>{notice}</span>
    </div>
  );
}
