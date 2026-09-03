'use client';

import { useEffect, useId, useRef, useState } from 'react';

import {
  BookOpenText,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Github,
  MessageSquareText,
  Sparkles,
} from '@/components/ui/SolidIcons';

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';

type DocsPageActionsProps = {
  content: string;
  markdownUrl: string;
  pageUrl: string;
  sourceUrl: string;
};

type MenuItemProps = {
  description: string;
  external?: boolean;
  href?: string;
  icon: ReactNode;
  onClick?: () => void;
  title: string;
};

function MenuItem({ description, external = false, href, icon, onClick, title }: MenuItemProps) {
  const body = (
    <>
      <span aria-hidden='true' className='docs-page-actions__menu-icon'>{icon}</span>
      <span className='docs-page-actions__menu-copy'>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      {external ? <ExternalLink aria-hidden='true' className='docs-page-actions__external' /> : null}
    </>
  );

  if (href) {
    return (
      <a href={href} onClick={onClick} rel={external ? 'noreferrer' : undefined} role='menuitem' target={external ? '_blank' : undefined}>
        {body}
      </a>
    );
  }

  return (
    <button onClick={onClick} role='menuitem' type='button'>
      {body}
    </button>
  );
}

export default function DocsPageActions({ content, markdownUrl, pageUrl, sourceUrl }: DocsPageActionsProps) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const copiedTimerRef = useRef<number | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closeOnPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('mousedown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const fallback = document.createElement('textarea');
      fallback.value = content;
      fallback.setAttribute('readonly', '');
      fallback.style.position = 'fixed';
      fallback.style.opacity = '0';
      document.body.append(fallback);
      fallback.select();
      document.execCommand('copy');
      fallback.remove();
    }
    setCopied(true);
    setOpen(false);
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1800);
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = currentIndex < 0
        ? direction > 0 ? 0 : items.length - 1
        : (currentIndex + direction + items.length) % items.length;
      items[nextIndex]?.focus();
    }
  };

  const prompt = encodeURIComponent(`Read this Glyphfield documentation page and help me use it: ${pageUrl}`);

  return (
    <div className='docs-page-actions' ref={rootRef}>
      <div className='docs-page-actions__split'>
        <button className='docs-page-actions__copy' onClick={() => void handleCopy()} type='button'>
          {copied ? <Check aria-hidden='true' className='docs-page-actions__copied' /> : <Copy aria-hidden='true' />}
          <span>{copied ? 'Copied' : 'Copy page'}</span>
        </button>
        <button
          aria-controls={menuId}
          aria-expanded={open}
          aria-haspopup='menu'
          aria-label='More ways to use this page'
          className='docs-page-actions__trigger'
          onClick={() => setOpen((value) => !value)}
          ref={triggerRef}
          type='button'
        >
          <ChevronDown aria-hidden='true' />
        </button>
      </div>
      {open ? (
        <div className='docs-page-actions__menu' id={menuId} onKeyDown={handleMenuKeyDown} ref={menuRef} role='menu'>
          <MenuItem
            description='Copy clean Markdown for an agent or teammate'
            icon={<Copy />}
            onClick={() => void handleCopy()}
            title='Copy page'
          />
          <MenuItem
            description='Open this exact page as plain Markdown'
            external
            href={markdownUrl}
            icon={<FileText />}
            onClick={() => setOpen(false)}
            title='View as Markdown'
          />
          <MenuItem
            description='Read the complete agent-facing product guide'
            external
            href='/llms.txt'
            icon={<BookOpenText />}
            onClick={() => setOpen(false)}
            title='Agent guide'
          />
          <MenuItem
            description='Inspect and improve this page in the repository'
            external
            href={sourceUrl}
            icon={<Github />}
            onClick={() => setOpen(false)}
            title='Open source file'
          />
          <MenuItem
            description='Ask Claude about this page'
            external
            href={`https://claude.ai/new?q=${prompt}`}
            icon={<MessageSquareText />}
            onClick={() => setOpen(false)}
            title='Open in Claude'
          />
          <MenuItem
            description='Ask ChatGPT about this page'
            external
            href={`https://chatgpt.com/?prompt=${prompt}`}
            icon={<Sparkles />}
            onClick={() => setOpen(false)}
            title='Open in ChatGPT'
          />
        </div>
      ) : null}
    </div>
  );
}
