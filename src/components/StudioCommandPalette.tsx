'use client';

import { T, useGT } from 'gt-next';
import { Search } from 'lucide-react';
import { useRef, useState } from 'react';

import { STUDIO_TOOL_ICONS } from '@/components/StudioToolHeader';
import { useMountEffect } from '@/hooks/useMountEffect';

import type { StudioTool, StudioToolId } from '@/lib/studioCatalog';

type StudioCommandPaletteProps = {
  activeToolId?: StudioToolId;
  onClose: () => void;
  onSelect: (toolId: StudioToolId) => void;
  query: string;
  setQuery: (query: string) => void;
  tools: readonly StudioTool[];
};

export default function StudioCommandPalette({
  activeToolId,
  onClose,
  onSelect,
  query,
  setQuery,
  tools,
}: StudioCommandPaletteProps) {
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
    <dialog
      aria-label={gt('Search Studio tools')}
      aria-modal='true'
      className='studio-command-overlay'
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      open
    >
      <button
        aria-label={gt('Close Studio search')}
        className='studio-modal-backdrop'
        onClick={onClose}
        type='button'
      />
      <section className='studio-command-dialog'>
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
    </dialog>
  );
}
