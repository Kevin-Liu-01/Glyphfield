'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { docsSidebarRailPath, type DocsSidebarRailPoint } from '@/lib/docsSidebarRail';

const VIEWPORT_SELECTOR = '#nd-sidebar [data-radix-scroll-area-viewport]';
const ROW_SELECTOR = 'a[href], button[type="button"]';
const PENDING_CLASS = 'docs-sb-pending';
const RAIL_BEFORE_TEXT = 12;
const ROW_INSET_Y = 6;
const STROKE = 1.5;
const TRAVEL_MS = 300;

type RailRun = {
  hoverThumb: HTMLElement;
  rail: HTMLElement;
  rows: Map<HTMLElement, DocsSidebarRailPoint>;
  thumb: HTMLElement;
  top: number;
};
type MotionState = { host: HTMLElement; runs: RailRun[]; viewport: HTMLElement };

let motionState: MotionState | null = null;
let landingTimer: ReturnType<typeof setTimeout> | undefined;

function snap(element: HTMLElement, apply: () => void) {
  element.style.transition = 'none';
  apply();
  void element.offsetHeight;
  element.style.transition = '';
}

function collectRows(node: Element, rows: HTMLElement[]) {
  if (node.matches('a[href]')) {
    rows.push(node as HTMLElement);
    return;
  }
  if (!node.matches('div[data-state]')) {
    for (const child of node.children) collectRows(child, rows);
    return;
  }

  const header = node.querySelector<HTMLElement>(':scope > :is(button, a[href])');
  if (header) rows.push(header);

  const content = node.querySelector<HTMLElement>(':scope > div[data-state]');
  if (!content || content.offsetHeight <= 0) return;
  for (const child of content.children) collectRows(child, rows);
}

function groupRows(host: HTMLElement) {
  const groups: HTMLElement[][] = [];
  let current: HTMLElement[] | null = null;

  for (const child of host.children) {
    if (child.className.toString().includes('docs-sb-')) continue;
    if (child.tagName === 'P') {
      current = null;
      continue;
    }

    const rows: HTMLElement[] = [];
    collectRows(child, rows);
    if (rows.length === 0) continue;
    if (!current) {
      current = [];
      groups.push(current);
    }
    current.push(...rows);
  }

  return groups;
}

function makeRun(host: HTMLElement): RailRun {
  const rail = document.createElement('div');
  const hoverThumb = document.createElement('div');
  const thumb = document.createElement('div');
  rail.className = 'docs-sb-rail';
  hoverThumb.className = 'docs-sb-thumb-hover';
  thumb.className = 'docs-sb-thumb';
  rail.append(hoverThumb, thumb);
  host.prepend(rail);
  return { hoverThumb, rail, rows: new Map(), thumb, top: 0 };
}

function buildRails() {
  if (!motionState) return;
  const { host } = motionState;
  const hostRect = host.getBoundingClientRect();
  const rtl = getComputedStyle(host).direction === 'rtl';
  const groups = groupRows(host);

  while (motionState.runs.length < groups.length) {
    motionState.runs.push(makeRun(host));
  }

  motionState.runs.forEach((run, index) => {
    const rows = groups[index]?.filter((row) => row.offsetHeight > 0) ?? [];
    run.rows.clear();
    if (rows.length === 0) {
      run.rail.style.display = 'none';
      return;
    }

    let top = Infinity;
    let bottom = 0;
    let width = 0;
    const geometry = rows.map((row) => {
      const rect = row.getBoundingClientRect();
      const textStart = Number.parseFloat(getComputedStyle(row).paddingInlineStart) || 0;
      const point = {
        bottom: rect.bottom - hostRect.top - ROW_INSET_Y,
        top: rect.top - hostRect.top + ROW_INSET_Y,
        x: rtl
          ? rect.right - hostRect.left - textStart + RAIL_BEFORE_TEXT - 0.5
          : rect.left - hostRect.left + textStart - RAIL_BEFORE_TEXT + 0.5,
      };
      top = Math.min(top, point.top);
      bottom = Math.max(bottom, point.bottom);
      width = Math.max(width, point.x + STROKE);
      return point;
    });

    rows.forEach((row, rowIndex) => run.rows.set(row, geometry[rowIndex]!));
    run.top = top;
    const height = bottom - top;
    const path = docsSidebarRailPath(geometry, top);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${path}" stroke="black" stroke-width="${STROKE}" fill="none" stroke-linejoin="round" stroke-linecap="round" /></svg>`;
    const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    Object.assign(run.rail.style, {
      display: '',
      height: `${height}px`,
      maskImage: mask,
      top: `${top}px`,
      WebkitMaskImage: mask,
      width: `${width}px`,
    });
  });
}

function runForRow(row: HTMLElement) {
  return motionState?.runs.find((run) => run.rows.has(row));
}

function placeThumb(kind: 'hoverThumb' | 'thumb', row: HTMLElement | null, immediate = false) {
  if (!motionState) return;
  const target = row ? runForRow(row) : undefined;

  for (const run of motionState.runs) {
    const element = run[kind];
    if (run !== target) {
      element.removeAttribute('data-visible');
      continue;
    }

    const geometry = run.rows.get(row!)!;
    const apply = () => {
      element.style.height = `${geometry.bottom - geometry.top}px`;
      element.style.top = `${geometry.top - run.top}px`;
    };
    if (immediate || !element.hasAttribute('data-visible')) snap(element, apply);
    else apply();
    element.setAttribute('data-visible', '');
  }
}

function placePill(kind: 'current' | 'hover', row: HTMLElement | null, immediate = false) {
  if (!motionState) return;
  const pill = motionState.host.querySelector<HTMLElement>(`.docs-sb-${kind}`);
  if (!pill) return;
  if (!row) {
    pill.removeAttribute('data-visible');
    return;
  }

  const rect = row.getBoundingClientRect();
  const hostRect = motionState.host.getBoundingClientRect();
  const transform = `translate3d(${rect.left - hostRect.left}px, ${rect.top - hostRect.top}px, 0)`;
  const moved = pill.hasAttribute('data-visible') && pill.style.transform !== transform;
  const apply = () => {
    pill.style.height = `${rect.height}px`;
    pill.style.transform = transform;
    pill.style.width = `${rect.width}px`;
  };
  if (immediate || !pill.hasAttribute('data-visible')) snap(pill, apply);
  else apply();

  if (kind === 'hover') {
    const current = row.getAttribute('data-active') === 'true' || row.classList.contains(PENDING_CLASS);
    if (current) pill.setAttribute('data-tone', 'accent');
    else pill.removeAttribute('data-tone');
  }
  if (kind === 'current' && moved && !immediate) {
    pill.setAttribute('data-landing', '');
    clearTimeout(landingTimer);
    landingTimer = setTimeout(() => pill.removeAttribute('data-landing'), TRAVEL_MS + 120);
  }
  pill.setAttribute('data-visible', '');
}

function currentRow() {
  return document.querySelector<HTMLElement>(`${VIEWPORT_SELECTOR} a[data-active="true"]`);
}

function markCurrent(row: HTMLElement | null, immediate = false) {
  placeThumb('thumb', row, immediate);
  placePill('current', row, immediate);
}

function clearPending() {
  document.querySelectorAll(`${VIEWPORT_SELECTOR} .${PENDING_CLASS}`).forEach((element) => {
    element.classList.remove(PENDING_CLASS);
  });
}

function setup() {
  const viewport = document.querySelector<HTMLElement>(VIEWPORT_SELECTOR);
  if (!viewport || viewport.offsetParent === null) return null;
  const host = (viewport.firstElementChild as HTMLElement | null) ?? viewport;
  const previousPosition = host.style.position;
  host.style.position = 'relative';
  host.setAttribute('data-sidebar-rail-host', '');
  motionState = { host, runs: [], viewport };
  let hoveredRow: HTMLElement | null = null;
  let layoutFrame = 0;

  const hover = document.createElement('div');
  const current = document.createElement('div');
  hover.className = 'docs-sb-hover';
  current.className = 'docs-sb-current';
  host.prepend(hover, current);

  buildRails();
  markCurrent(currentRow(), true);
  const shell = viewport.closest<HTMLElement>('#nd-sidebar');
  shell?.setAttribute('data-sb-ready', '');

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const rowFromEvent = (event: Event) => {
    const row = (event.target as Element | null)?.closest<HTMLElement>(ROW_SELECTOR);
    return row && viewport.contains(row) ? row : null;
  };
  const refreshLayout = () => {
    layoutFrame = 0;
    buildRails();
    markCurrent(currentRow(), true);
    const visibleHover = hoveredRow?.isConnected ? hoveredRow : null;
    placePill('hover', visibleHover, true);
    placeThumb('hoverThumb', visibleHover, true);
  };
  const scheduleLayout = () => {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(refreshLayout);
  };
  const onPointerOver = (event: PointerEvent) => {
    if (!finePointer.matches) return;
    const row = rowFromEvent(event);
    if (row === hoveredRow) return;
    hoveredRow = row;
    placePill('hover', row);
    placeThumb('hoverThumb', row);
  };
  const onPointerLeave = () => {
    hoveredRow = null;
    placePill('hover', null);
    placeThumb('hoverThumb', null);
  };
  const onFocusIn = (event: FocusEvent) => {
    const row = rowFromEvent(event);
    hoveredRow = row;
    placePill('hover', row);
    placeThumb('hoverThumb', row);
  };
  const onFocusOut = (event: FocusEvent) => {
    const nextRow = event.relatedTarget instanceof Element
      ? event.relatedTarget.closest<HTMLElement>(ROW_SELECTOR)
      : null;
    if (nextRow && viewport.contains(nextRow)) return;
    onPointerLeave();
  };
  const onClick = (event: MouseEvent) => {
    const row = rowFromEvent(event);
    scheduleLayout();
    if (!row?.matches('a[href]')) return;
    clearPending();
    row.classList.add(PENDING_CLASS);
    markCurrent(row);
    placePill('hover', row);
  };

  viewport.addEventListener('click', onClick);
  viewport.addEventListener('focusin', onFocusIn);
  viewport.addEventListener('focusout', onFocusOut);
  viewport.addEventListener('pointerleave', onPointerLeave);
  viewport.addEventListener('pointerover', onPointerOver);
  const resizeObserver = new ResizeObserver(scheduleLayout);
  const mutationObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => (
      mutation.type === 'childList'
      || mutation.attributeName === 'data-active'
      || mutation.attributeName === 'data-state'
      || mutation.attributeName === 'hidden'
    ))) scheduleLayout();
  });
  resizeObserver.observe(host);
  mutationObserver.observe(host, {
    attributeFilter: ['data-active', 'data-state', 'hidden'],
    attributes: true,
    childList: true,
    subtree: true,
  });

  return () => {
    clearTimeout(landingTimer);
    cancelAnimationFrame(layoutFrame);
    shell?.removeAttribute('data-sb-ready');
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    viewport.removeEventListener('click', onClick);
    viewport.removeEventListener('focusin', onFocusIn);
    viewport.removeEventListener('focusout', onFocusOut);
    viewport.removeEventListener('pointerleave', onPointerLeave);
    viewport.removeEventListener('pointerover', onPointerOver);
    hover.remove();
    current.remove();
    motionState?.runs.forEach((run) => run.rail.remove());
    motionState = null;
    host.style.position = previousPosition;
    host.removeAttribute('data-sidebar-rail-host');
  };
}

function MotionMount() {
  useEffect(() => {
    let teardown = setup();
    const desktop = window.matchMedia('(min-width: 768px)');
    const onChange = () => {
      if (teardown || !desktop.matches) return;
      requestAnimationFrame(() => {
        if (!teardown) teardown = setup();
      });
    };
    desktop.addEventListener('change', onChange);
    return () => {
      desktop.removeEventListener('change', onChange);
      teardown?.();
    };
  }, []);
  return null;
}

function SettleOnActive() {
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      buildRails();
      markCurrent(currentRow());
      clearPending();
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return null;
}

export default function DocsSidebarMotion() {
  const pathname = usePathname();
  return (
    <>
      <MotionMount />
      <SettleOnActive key={pathname} />
    </>
  );
}
