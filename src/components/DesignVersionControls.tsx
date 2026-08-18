'use client';

import { Check, ChevronDown, Copy, GitFork, History, Save, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { useMountEffect } from '@/hooks/useMountEffect';
import { usePersistentState } from '@/hooks/usePersistentState';
import {
  activeSavedDesignStorageKey,
  createSavedDesign,
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
  identityId,
  onOpen,
  source,
  toolId,
  workspaceLabel,
}: {
  identityId: string;
  onOpen: (source: string) => void;
  source: string | (() => string);
  toolId: string;
  workspaceLabel: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [designs, setDesigns] = usePersistentState<SavedDesign[]>(
    savedDesignStorageKey(identityId, toolId),
    []
  );
  const [activeId, setActiveId] = usePersistentState<string | null>(
    activeSavedDesignStorageKey(identityId, toolId),
    null
  );
  const currentSource = typeof source === 'function' ? source() : source;
  const activeDesign = designs.find(({ id }) => id === activeId) ?? null;
  const dirty = activeDesign ? activeDesign.source !== currentSource : true;
  const sortedDesigns = useMemo(
    () => [...designs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [designs]
  );

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

  function createDesign(
    name: string,
    origin: SavedDesignOrigin,
    designSource = typeof source === 'function' ? source() : source,
    parentId?: string
  ) {
    const now = new Date().toISOString();
    const design = createSavedDesign({
      designs,
      id: designId(),
      name,
      now,
      origin,
      parentId,
      source: designSource,
    });
    setDesigns([design, ...designs]);
    setActiveId(design.id);
    setError('');
    announce(origin === 'fork' ? 'Fork created' : origin === 'clone' ? 'Clone created' : 'Design saved');
    return design;
  }

  function saveDesign() {
    if (!activeDesign) {
      createDesign('Untitled design', 'saved');
      return;
    }
    const now = new Date().toISOString();
    const latestSource = typeof source === 'function' ? source() : source;
    setDesigns(updateSavedDesign(designs, activeDesign.id, { source: latestSource, updatedAt: now }));
    setError('');
    announce('Changes saved');
  }

  function forkDesign() {
    createDesign(
      `${activeDesign?.name ?? 'Untitled design'} · Fork`,
      'fork',
      typeof source === 'function' ? source() : source,
      activeDesign?.id
    );
  }

  function cloneDesign(
    design = activeDesign,
    designSource = typeof source === 'function' ? source() : source
  ) {
    createDesign(`${design?.name ?? 'Untitled design'} · Copy`, 'clone', designSource);
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

  function normalizeDesignName(design: SavedDesign) {
    const otherDesigns = designs.filter(({ id }) => id !== design.id);
    const name = uniqueDesignName(otherDesigns, design.name);
    setDesigns(updateSavedDesign(designs, design.id, { name }));
  }

  function deleteDesign(design: SavedDesign) {
    setDesigns(designs.filter(({ id }) => id !== design.id));
    if (activeId === design.id) setActiveId(null);
    announce(`${design.name} removed`);
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
        <span className={styles.currentName}>{activeDesign?.name ?? 'Unsaved design'}</span>
        <span aria-label={dirty ? 'Unsaved changes' : 'Saved'} className={styles.stateDot} data-dirty={dirty ? 'true' : 'false'} />
        <ChevronDown aria-hidden='true' />
      </button>

      <div className={styles.actions}>
        <Button
          aria-label={dirty ? 'Save design' : 'Design saved'}
          disabled={!dirty}
          onClick={saveDesign}
          size='sm'
          title={dirty ? 'Save design' : 'Design saved'}
          type='button'
          variant={dirty ? 'default' : 'outline'}
        >
          {dirty ? <Save aria-hidden='true' /> : <Check aria-hidden='true' />}
          <span className={styles.actionLabel}>{dirty ? 'Save' : 'Saved'}</span>
        </Button>
        <Button aria-label='Fork design' onClick={forkDesign} size='icon-sm' title='Fork into a linked design' type='button' variant='outline'>
          <GitFork aria-hidden='true' />
        </Button>
        <Button aria-label='Clone design' onClick={() => cloneDesign()} size='icon-sm' title='Clone as an independent copy' type='button' variant='outline'>
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
                onBlur={() => normalizeDesignName(activeDesign)}
                onChange={(event) => renameDesign(activeDesign, event.target.value)}
                value={activeDesign.name}
              />
            </label>
          ) : (
            <div className={styles.unsavedCallout}>
              <Save aria-hidden='true' />
              <span><strong>Current canvas is unsaved</strong><small>Save it before switching designs.</small></span>
            </div>
          )}

          <div className={styles.list}>
            {sortedDesigns.length ? sortedDesigns.map((design) => (
              <div className={styles.designRow} data-active={design.id === activeId ? 'true' : 'false'} key={design.id}>
                <button className={styles.openDesign} onClick={() => openDesign(design)} type='button'>
                  <span><strong>{design.name || 'Untitled design'}</strong><small>{design.origin} · {designDate(design.updatedAt)}</small></span>
                  {design.id === activeId ? <Check aria-label='Current design' /> : null}
                </button>
                <button aria-label={`Clone ${design.name}`} onClick={() => {
                  const clone = createDesign(`${design.name} · Copy`, 'clone', design.source);
                  try {
                    onOpen(clone.source);
                    setOpen(false);
                  } catch (openError) {
                    setError(openError instanceof Error ? openError.message : 'This clone could not be opened.');
                  }
                }} title='Clone this design' type='button'><Copy aria-hidden='true' /></button>
                <button aria-label={`Delete ${design.name}`} onClick={() => deleteDesign(design)} title='Delete saved design' type='button'><Trash2 aria-hidden='true' /></button>
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
