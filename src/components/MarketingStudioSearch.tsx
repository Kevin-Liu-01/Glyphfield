'use client';

import { T, useGT } from 'gt-next';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import StudioCommandPalette from '@/components/StudioCommandPalette';
import { filterStudioTools, STUDIO_TOOLS, type StudioToolId } from '@/lib/studioCatalog';

export default function MarketingStudioSearch() {
  const gt = useGT();
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const tools = useMemo(() => filterStudioTools(STUDIO_TOOLS, query), [query]);

  function openSearch() {
    setQuery('');
    setOpen(true);
  }

  function closeSearch() {
    setOpen(false);
    setQuery('');
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function selectTool(toolId: StudioToolId) {
    router.push(`/studio?tool=${encodeURIComponent(toolId)}`);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const isEditing =
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable);
      const isCommandK =
        (event.metaKey || event.ctrlKey)
        && (event.code === 'KeyK' || event.key.toLocaleLowerCase() === 'k');

      if (isCommandK || (!isEditing && event.key === '/')) {
        event.preventDefault();
        openSearch();
      }
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);

  return (
    <>
      <button
        aria-haspopup='dialog'
        aria-keyshortcuts='Meta+K Control+K /'
        aria-label={gt('Search Studio tools')}
        className='marketing-v5-search-launcher'
        onClick={openSearch}
        ref={triggerRef}
        title={gt('Search Studio tools')}
        type='button'
      >
        <Search aria-hidden='true' />
        <span><T>Search</T></span>
        <kbd>⌘K</kbd>
      </button>
      {open ? (
        <StudioCommandPalette
          onClose={closeSearch}
          onSelect={selectTool}
          query={query}
          setQuery={setQuery}
          tools={tools}
        />
      ) : null}
    </>
  );
}
