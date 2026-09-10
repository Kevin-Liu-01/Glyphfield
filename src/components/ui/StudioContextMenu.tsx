'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type StudioContextMenuPosition = {
  anchor?: HTMLElement | null;
  x: number;
  y: number;
};

export type StudioContextMenuItem = {
  checked?: boolean;
  danger?: boolean;
  description?: string;
  disabled?: boolean;
  icon?: ReactNode;
  id: string;
  label: string;
  onSelect: () => void;
  shortcut?: string;
};

export type StudioContextMenuSection = {
  items: readonly StudioContextMenuItem[];
  label?: string;
};

export function contextMenuPositionFromEvent(
  event: Pick<ReactMouseEvent<HTMLElement>, 'clientX' | 'clientY' | 'currentTarget'>
): StudioContextMenuPosition {
  const bounds = event.currentTarget.getBoundingClientRect();
  const invokedFromKeyboard = event.clientX === 0 && event.clientY === 0;
  return {
    anchor: event.currentTarget,
    x: invokedFromKeyboard ? bounds.left + Math.min(32, bounds.width / 2) : event.clientX,
    y: invokedFromKeyboard ? bounds.top + Math.min(32, bounds.height) : event.clientY,
  };
}

export function contextMenuPositionFromElement(element: HTMLElement): StudioContextMenuPosition {
  const bounds = element.getBoundingClientRect();
  return {
    anchor: element,
    x: bounds.left + Math.min(32, bounds.width / 2),
    y: bounds.top + Math.min(32, bounds.height),
  };
}

function contextMenuAnchorIsActive(anchor: HTMLElement): boolean {
  return anchor.isConnected && !anchor.closest(
    '.studio-workspace-layer[data-active="false"], .studio-project-workspace-layer[data-active="false"], [inert]'
  );
}

function readContextMenuScrollOffset(target: EventTarget): readonly [number, number] {
  return target instanceof Element
    ? [target.scrollLeft, target.scrollTop]
    : [window.scrollX, window.scrollY];
}

function captureContextMenuScrollOffsets(anchor: HTMLElement) {
  const offsets = new Map<EventTarget, readonly [number, number]>();
  for (let element: HTMLElement | null = anchor; element; element = element.parentElement) {
    offsets.set(element, readContextMenuScrollOffset(element));
  }
  offsets.set(document, readContextMenuScrollOffset(document));
  offsets.set(window, readContextMenuScrollOffset(window));
  return offsets;
}

export default function StudioContextMenu({
  detail,
  label,
  onClose,
  position,
  sections,
}: {
  detail?: string;
  label: string;
  onClose: () => void;
  position: StudioContextMenuPosition | null;
  sections: readonly StudioContextMenuSection[];
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<CSSProperties | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    if (!position) return;
    const menu = menuRef.current;
    if (!menu) return;
    const gutter = 8;
    const bounds = menu.getBoundingClientRect();
    const left = Math.min(
      Math.max(gutter, position.x),
      Math.max(gutter, window.innerWidth - bounds.width - gutter)
    );
    const top = Math.min(
      Math.max(gutter, position.y),
      Math.max(gutter, window.innerHeight - bounds.height - gutter)
    );
    setPlacement({
      '--studio-context-origin-x': left < position.x ? '100%' : '0%',
      '--studio-context-origin-y': top < position.y ? '100%' : '0%',
      left,
      top,
    } as CSSProperties);
    const focusFrame = window.requestAnimationFrame(() => {
      if (position.anchor && !contextMenuAnchorIsActive(position.anchor)) return;
      menu.querySelector<HTMLButtonElement>('button[role^="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [position]);

  useEffect(() => {
    if (!position) {
      setPlacement(null);
      return;
    }
    const menu = menuRef.current;
    const initialScrollOffsets = position.anchor ? captureContextMenuScrollOffsets(position.anchor) : null;
    const close = (restoreFocus = false) => {
      closeRef.current();
      if (restoreFocus) {
        window.requestAnimationFrame(() => {
          if (position.anchor && contextMenuAnchorIsActive(position.anchor)) {
            position.anchor.focus({ preventScroll: true });
          }
        });
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && menu?.contains(event.target)) return;
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };
    const handleViewportChange = (event: Event) => {
      if (event.target instanceof Node && menu?.contains(event.target)) return;
      if (event.type === 'scroll' && initialScrollOffsets) {
        const target = event.target ?? window;
        const initial = initialScrollOffsets.get(target);
        if (!initial) return;
        const current = readContextMenuScrollOffset(target);
        // Focus scrolling can complete before opening, with WebKit delivering
        // its queued event afterward. Only a new, relevant scroll invalidates
        // the menu's position; another pane's scroll cannot move its anchor.
        if (current[0] === initial[0] && current[1] === initial[1]) return;
      }
      close();
    };
    // The body portal must follow the retained tool/project that owns its
    // anchor, even when navigation happens without an outside pointer press.
    const owners = [
      position.anchor?.closest<HTMLElement>('.studio-workspace-layer'),
      position.anchor?.closest<HTMLElement>('.studio-project-workspace-layer'),
    ].filter((owner): owner is HTMLElement => Boolean(owner));
    const dismissInactiveOwner = () => {
      if (owners.some((owner) => owner.dataset.active === 'false')) close();
    };
    const activityObserver = new MutationObserver(dismissInactiveOwner);
    owners.forEach((owner) => activityObserver.observe(owner, { attributeFilter: ['data-active'], attributes: true }));
    dismissInactiveOwner();
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      activityObserver.disconnect();
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [position]);

  if (!position || typeof document === 'undefined') return null;

  const enabledItems = () => Array.from(
    menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role^="menuitem"]:not(:disabled)') ?? []
  );
  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      if (event.key === 'Tab') onClose();
      return;
    }
    const items = enabledItems();
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? (currentIndex + 1 + items.length) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    event.preventDefault();
    items[nextIndex]?.focus({ preventScroll: true });
  };
  const run = (item: StudioContextMenuItem) => {
    if (item.disabled) return;
    item.onSelect();
    onClose();
  };

  return createPortal(
    <div
      aria-label={label}
      className='studio-context-menu'
      data-canvas-selection-preserve
      data-positioned={placement ? 'true' : 'false'}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={handleMenuKeyDown}
      ref={menuRef}
      role='menu'
      style={placement ?? { left: position.x, top: position.y, visibility: 'hidden' }}
    >
      <div className='studio-context-menu__header'>
        <strong>{label}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
      {sections.map((section, sectionIndex) => section.items.length > 0 ? (
        <div className='studio-context-menu__section' key={`${section.label ?? 'section'}-${sectionIndex}`}>
          {section.label ? <span className='studio-context-menu__section-label'>{section.label}</span> : null}
          {section.items.map((item) => (
            <button
              aria-checked={item.checked}
              className='studio-context-menu__item'
              data-danger={item.danger ? 'true' : undefined}
              disabled={item.disabled}
              key={item.id}
              onClick={() => run(item)}
              role={item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
              type='button'
            >
              <span className='studio-context-menu__icon' aria-hidden='true'>{item.icon}</span>
              <span className='studio-context-menu__copy'>
                <strong>{item.label}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>
              {item.checked !== undefined ? (
                <span className='studio-context-menu__check' aria-hidden='true'>{item.checked ? '✓' : ''}</span>
              ) : item.shortcut ? (
                <kbd>{item.shortcut}</kbd>
              ) : null}
            </button>
          ))}
        </div>
      ) : null)}
    </div>,
    document.body
  );
}
