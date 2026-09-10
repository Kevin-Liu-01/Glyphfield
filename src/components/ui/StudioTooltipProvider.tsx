'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { observeTooltipAnchor, tooltipAnchorIsAvailable } from './studioTooltipLifecycle';

const OPEN_DELAY_MS = 420;
const CLOSE_DELAY_MS = 110;
const CONTROL_SELECTOR = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="combobox"], [role="tab"], [title]';

type ControlHint = { anchor: HTMLElement; keyboard: boolean; text: string };
type ActiveHint = ControlHint & { originalTitle: string | null };

function hintFromTarget(target: EventTarget | null): Omit<ControlHint, 'keyboard'> | null {
  if (!(target instanceof Element) || target.closest('[data-studio-preview-trigger], [role="tooltip"]')) return null;
  const anchor = target.closest<HTMLElement>(CONTROL_SELECTOR);
  if (!anchor || !tooltipAnchorIsAvailable(anchor)) return null;
  const text = anchor.getAttribute('title')?.trim() || anchor.getAttribute('aria-label')?.trim();
  return text ? { anchor, text } : null;
}

function removeDescription(anchor: HTMLElement, id: string) {
  const remaining = anchor.getAttribute('aria-describedby')?.split(/\s+/).filter((token) => token !== id).join(' ');
  if (remaining) anchor.setAttribute('aria-describedby', remaining);
  else anchor.removeAttribute('aria-describedby');
}

/** One idle event delegate; observes only the current anchor's ancestor chain. */
function attachControlHints(id: string, update: (hint: ControlHint | null) => void) {
  let current: ActiveHint | null = null;
  let openTimer = 0;
  let closeTimer = 0;
  let revealed = false;
  let warmUntil = 0;
  let stopObserving: (() => void) | null = null;
  let keyboardInput = true;
  const insideHint = (target: EventTarget | null) => target instanceof Node && document.getElementById(id)?.contains(target);

  function close() {
    if (revealed) warmUntil = Date.now() + 900;
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    stopObserving?.();
    stopObserving = null;
    if (current) {
      const { anchor, originalTitle } = current;
      // React may have changed or removed the title while it was suppressed.
      if (anchor.getAttribute('title') === '') {
        if (originalTitle === null) anchor.removeAttribute('title');
        else anchor.setAttribute('title', originalTitle);
      }
      removeDescription(anchor, id);
    }
    current = null;
    revealed = false;
    openTimer = 0;
    update(null);
  }

  function closeSoon() {
    window.clearTimeout(openTimer);
    openTimer = 0;
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(close, CLOSE_DELAY_MS);
  }

  function observeAnchor(anchor: HTMLElement) {
    stopObserving = observeTooltipAnchor(anchor, () => {
      const labelChanged = !current?.originalTitle && anchor.getAttribute('aria-label')?.trim() !== current?.text;
      if (!tooltipAnchorIsAvailable(anchor) || anchor.getAttribute('title') !== '' || labelChanged) close();
    });
  }

  function reveal() {
    openTimer = 0;
    if (!current || !tooltipAnchorIsAvailable(current.anchor)) return;
    revealed = true;
    update(current);
  }

  function show(hint: Omit<ControlHint, 'keyboard'>, keyboard: boolean) {
    if (current?.anchor === hint.anchor) {
      window.clearTimeout(closeTimer);
      if (keyboard) {
        window.clearTimeout(openTimer);
        current = { ...current, keyboard };
        reveal();
      } else if (!revealed && !openTimer) {
        openTimer = window.setTimeout(reveal, OPEN_DELAY_MS);
      }
      return;
    }
    close();
    const active = { ...hint, keyboard, originalTitle: hint.anchor.getAttribute('title') };
    current = active;
    // Empty title prevents a second, native tooltip (including inherited title).
    active.anchor.setAttribute('title', '');
    observeAnchor(active.anchor);
    if (keyboard || Date.now() < warmUntil) reveal();
    else openTimer = window.setTimeout(reveal, OPEN_DELAY_MS);
  }

  function pointerOver(event: PointerEvent) {
    if (insideHint(event.target)) {
      window.clearTimeout(closeTimer);
      return;
    }
    if (event.pointerType === 'touch' || event.buttons || window.matchMedia('(hover: none)').matches) return;
    if (current?.anchor.contains(event.target as Node)) {
      show(current, false);
      return;
    }
    const hint = hintFromTarget(event.target);
    if (hint) show(hint, false);
  }

  function pointerOut(event: PointerEvent) {
    if (!current || insideHint(event.relatedTarget)) return;
    if (event.relatedTarget instanceof Node && current.anchor.contains(event.relatedTarget)) return;
    if (current.keyboard && current.anchor === document.activeElement) return;
    if (current.anchor.contains(event.target as Node) || insideHint(event.target)) closeSoon();
  }

  function focusIn(event: FocusEvent) {
    if (!keyboardInput) return;
    const hint = current?.anchor === event.target ? current : hintFromTarget(event.target);
    if (hint) show(hint, true);
  }

  function focusOut(event: FocusEvent) {
    if (current?.anchor.contains(event.target as Node)) close();
  }

  function pointerDown() {
    keyboardInput = false;
    close();
  }

  function keyDown(event: KeyboardEvent) {
    keyboardInput = true;
    if (event.key !== 'Tab' && !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) close();
  }

  function visibilityChange() {
    if (document.hidden) close();
  }

  document.addEventListener('pointerover', pointerOver, true);
  document.addEventListener('pointerout', pointerOut, true);
  document.addEventListener('pointerdown', pointerDown, true);
  document.addEventListener('focusin', focusIn, true);
  document.addEventListener('focusout', focusOut, true);
  document.addEventListener('keydown', keyDown, true);
  document.addEventListener('input', close, true);
  document.addEventListener('visibilitychange', visibilityChange);
  window.addEventListener('scroll', close, true);
  window.addEventListener('resize', close);
  window.addEventListener('blur', close);
  return () => {
    close();
    document.removeEventListener('pointerover', pointerOver, true);
    document.removeEventListener('pointerout', pointerOut, true);
    document.removeEventListener('pointerdown', pointerDown, true);
    document.removeEventListener('focusin', focusIn, true);
    document.removeEventListener('focusout', focusOut, true);
    document.removeEventListener('keydown', keyDown, true);
    document.removeEventListener('input', close, true);
    document.removeEventListener('visibilitychange', visibilityChange);
    window.removeEventListener('scroll', close, true);
    window.removeEventListener('resize', close);
    window.removeEventListener('blur', close);
  };
}

function ControlTooltip({ hint, id }: { hint: ControlHint; id: string }) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const bounds = hint.anchor.getBoundingClientRect();
    const size = tooltip.getBoundingClientRect();
    const left = Math.max(10, Math.min(window.innerWidth - size.width - 10, bounds.left + (bounds.width - size.width) / 2));
    const preferredTop = bounds.top >= size.height + 18 ? bounds.top - size.height - 8 : bounds.bottom + 8;
    const top = Math.max(10, Math.min(window.innerHeight - size.height - 10, preferredTop));
    setLayout({ left, top });
    const previous = hint.anchor.getAttribute('aria-describedby');
    hint.anchor.setAttribute('aria-describedby', [previous, id].filter(Boolean).join(' '));
    return () => removeDescription(hint.anchor, id);
  }, [hint, id]);

  // Native popovers/dialogs are in the top layer: their hints belong inside it.
  const portalOwner = hint.anchor.closest('dialog[open], [popover]') ?? document.body;
  return createPortal(
    <div className='studio-control-tooltip' data-keyboard={hint.keyboard} data-positioned={Boolean(layout)}
      id={id} ref={tooltipRef} role='tooltip' style={layout ?? { left: 0, top: 0 }}>
      {hint.text}
    </div>,
    portalOwner
  );
}

export default function StudioTooltipProvider({ children }: { children: ReactNode }) {
  const id = useId();
  const [hint, setHint] = useState<ControlHint | null>(null);
  useEffect(() => attachControlHints(id, setHint), [id]);
  return <>{children}{hint ? <ControlTooltip hint={hint} id={id} /> : null}</>;
}
