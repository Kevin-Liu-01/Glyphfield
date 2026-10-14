'use client';

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type MouseEvent,
  type RefObject,
} from 'react';

import { useCommittedRef } from '@/hooks/useCommittedRef';

// One stable object: a new one on a later render would make React reset innerHTML.
const SERVER_MARKUP = { __html: '' } as const;
const subscribeNothing = () => () => {};

type ElementPath = readonly number[];

export type DeferredHydrationProps = {
  dangerouslySetInnerHTML: typeof SERVER_MARKUP;
  onClickCapture: (event: MouseEvent<HTMLElement>) => void;
  onFocusCapture: (event: FocusEvent<HTMLElement>) => void;
  suppressHydrationWarning: true;
};

function pathFrom(root: Element, node: EventTarget): ElementPath | null {
  if (!(node instanceof Element) || !root.contains(node)) return null;
  const path: number[] = [];
  for (let current = node; current !== root && current.parentElement; current = current.parentElement) {
    path.unshift(Array.prototype.indexOf.call(current.parentElement.children, current));
  }
  return path;
}

function elementAt(root: Element, path: ElementPath): Element | null {
  let current: Element | null = root;
  for (const index of path) current = current?.children[index] ?? null;
  return current;
}

/**
 * Hydrates one element's server HTML after the rest of the page.
 *
 * The server, and a client-side navigation, render the element's live children
 * directly; `live` is true once they are interactive. During hydration the element instead keeps its server HTML as inert
 * markup (`props`), so the page hydrates without that subtree's code. Once
 * `enabled`, `load` fetches the code and the live children replace the markup
 * in one transition. A click inside the inert markup starts the load at once and
 * is replayed on the matching live element; focus moves to the matching element.
 * React replays a click made before the page hydrates, so none is lost.
 */
export function useDeferredHydration(
  containerRef: RefObject<HTMLElement | null>,
  { enabled, load }: { enabled: boolean; load: () => Promise<unknown> }
): { live: boolean; props: DeferredHydrationProps | null } {
  const hydrating = useSyncExternalStore(subscribeNothing, () => false, () => true);
  const onServer = typeof window === 'undefined';
  const [inert, setInert] = useState(() => hydrating && !onServer);
  const [requested, setRequested] = useState(false);
  const pendingRef = useRef<{ click: ElementPath | null; focus: ElementPath | null }>({ click: null, focus: null });
  const loadRef = useCommittedRef(load);

  useEffect(() => {
    if (!inert || !(enabled || requested)) return;
    let cancelled = false;
    loadRef.current().then(
      () => { if (!cancelled) startTransition(() => setInert(false)); },
      // Keep the server markup; the next click retries the load.
      () => { if (!cancelled) setRequested(false); }
    );
    return () => { cancelled = true; };
  }, [enabled, inert, loadRef, requested]);

  useEffect(() => {
    const container = containerRef.current;
    if (inert || !container) return;
    const { click, focus } = pendingRef.current;
    pendingRef.current = { click: null, focus: null };
    if (focus) {
      const target = elementAt(container, focus);
      if (target instanceof HTMLElement && !container.contains(document.activeElement)) target.focus();
    }
    if (click) elementAt(container, click)?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }, [containerRef, inert]);

  // Server HTML is not interactive either, so `live` matches during hydration.
  if (!inert) return { live: !onServer, props: null };
  return {
    live: false,
    props: {
      dangerouslySetInnerHTML: SERVER_MARKUP,
      onClickCapture: (event) => {
        event.preventDefault();
        event.stopPropagation();
        pendingRef.current.click = pathFrom(event.currentTarget, event.target);
        setRequested(true);
      },
      onFocusCapture: (event) => {
        pendingRef.current.focus = pathFrom(event.currentTarget, event.target);
        setRequested(true);
      },
      suppressHydrationWarning: true,
    },
  };
}
