'use client';

import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

import { useCommittedRef } from '@/hooks/useCommittedRef';
import type { ProjectTabPlacement } from '@/lib/studioCatalog';

type ProjectTabDragState = {
  originOrder: string[];
  placement: ProjectTabPlacement;
  pointerOffsetX: number;
  previewOrder: string[];
  sourceId: string;
  targetId: string;
};

type ProjectTabPointerDrag = {
  centers: number[];
  element: HTMLDivElement;
  moved: boolean;
  originOrder: string[];
  pendingClientX: number;
  pointerId: number;
  sourceIndex: number;
  sourceId: string;
  startX: number;
  startY: number;
  tabs: HTMLElement[];
};

type ProjectTabInteractionOptions = {
  activeIdentityId: string | undefined;
  activeProjectTabIndex: number;
  onDragStart: () => void;
  onReorder: (sourceId: string, targetId: string, placement: ProjectTabPlacement) => void;
  onSelect: (identityId: string) => void;
};

export function useProjectTabInteraction({
  activeIdentityId,
  activeProjectTabIndex,
  onDragStart,
  onReorder,
  onSelect,
}: ProjectTabInteractionOptions) {
  const projectTabDragRef = useRef<ProjectTabDragState | null>(null);
  const projectTabFrameRef = useRef<number | null>(null);
  const projectTabSelectionRef = useRef<HTMLSpanElement>(null);
  const projectTabPointerDragRef = useRef<ProjectTabPointerDrag | null>(null);
  const suppressProjectTabClickRef = useRef<string | null>(null);
  const suppressClickTimerRef = useRef<number | null>(null);
  const detachGestureListenersRef = useRef<(() => void) | null>(null);
  const latest = useCommittedRef({ activeIdentityId, activeProjectTabIndex, onDragStart, onReorder });
  const endGestureRef = useCommittedRef(handleProjectTabPointerEnd);
  const clearGestureRef = useCommittedRef(clearProjectTabDrag);

  useEffect(() => () => {
    clearGestureRef.current();
    window.clearTimeout(suppressClickTimerRef.current ?? undefined);
  }, [clearGestureRef]);

  function handleProjectTabPointerDown(event: ReactPointerEvent<HTMLDivElement>, identityId: string) {
    if (event.button !== 0 || projectTabPointerDragRef.current) return;
    // A new physical click must never inherit suppression from a previous drag.
    suppressProjectTabClickRef.current = null;
    window.clearTimeout(suppressClickTimerRef.current ?? undefined);
    suppressClickTimerRef.current = null;
    const target = event.target;
    if (target instanceof Element && target.closest('.project-tab-close, input, textarea, select, [contenteditable]')) return;
    projectTabPointerDragRef.current = {
      centers: [],
      element: event.currentTarget,
      moved: false,
      originOrder: [],
      pendingClientX: event.clientX,
      pointerId: event.pointerId,
      sourceIndex: -1,
      sourceId: identityId,
      startX: event.clientX,
      startY: event.clientY,
      tabs: [],
    };
    // Before drag capture begins, release may occur outside the tab entirely.
    const onPointerUp = (event: PointerEvent) => endGestureRef.current(event);
    const onPointerCancel = (event: PointerEvent) => {
      if (projectTabPointerDragRef.current?.pointerId === event.pointerId) clearGestureRef.current();
    };
    const onBlur = () => clearGestureRef.current();
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', onBlur);
    detachGestureListenersRef.current = () => {
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('blur', onBlur);
    };
  }

  function clearProjectTabDrag() {
    if (projectTabFrameRef.current !== null) {
      window.cancelAnimationFrame(projectTabFrameRef.current);
      projectTabFrameRef.current = null;
    }
    const pointerDrag = projectTabPointerDragRef.current;
    projectTabDragRef.current = null;
    projectTabPointerDragRef.current = null;
    detachGestureListenersRef.current?.();
    detachGestureListenersRef.current = null;
    pointerDrag?.tabs.forEach((tab) => {
      delete tab.dataset.dragging;
      delete tab.dataset.shifting;
      tab.style.removeProperty('transform');
    });
    const selection = projectTabSelectionRef.current;
    if (selection) {
      selection.style.transform = `translate3d(calc(${latest.current.activeProjectTabIndex} * (var(--project-tab-width) + var(--project-tab-gap))), 0, 0)`;
    }
    if (pointerDrag?.element.hasPointerCapture?.(pointerDrag.pointerId)) {
      pointerDrag.element.releasePointerCapture(pointerDrag.pointerId);
    }
  }

  function applyProjectTabDragFrame(pointerDrag: ProjectTabPointerDrag) {
    projectTabFrameRef.current = null;
    if (projectTabPointerDragRef.current !== pointerDrag || !pointerDrag.moved) return;
    const clientX = pointerDrag.pendingClientX;
    const firstCenter = pointerDrag.centers[0] ?? clientX;
    const lastCenter = pointerDrag.centers.at(-1) ?? clientX;
    const minimumOffset = firstCenter - pointerDrag.centers[pointerDrag.sourceIndex];
    const maximumOffset = lastCenter - pointerDrag.centers[pointerDrag.sourceIndex];
    const pointerOffsetX = Math.min(maximumOffset, Math.max(minimumOffset, clientX - pointerDrag.startX));
    const draggedCenter = pointerDrag.centers[pointerDrag.sourceIndex] + pointerOffsetX;
    const remainingTabs = pointerDrag.originOrder.reduce<Array<{ center: number; id: string }>>(
      (tabs, id, index) => {
        if (id !== pointerDrag.sourceId) tabs.push({ center: pointerDrag.centers[index] ?? 0, id });
        return tabs;
      },
      []
    );
    const movingRight = pointerOffsetX > 0;
    const previewIndex = remainingTabs.filter(({ center }) => (
      movingRight ? center <= draggedCenter : center < draggedCenter
    )).length;
    const previewOrder = remainingTabs.map(({ id }) => id);
    previewOrder.splice(previewIndex, 0, pointerDrag.sourceId);
    const orderChanged = previewIndex !== pointerDrag.sourceIndex;
    const targetId = orderChanged
      ? previewIndex < pointerDrag.sourceIndex
        ? remainingTabs[previewIndex]?.id ?? pointerDrag.sourceId
        : remainingTabs[previewIndex - 1]?.id ?? pointerDrag.sourceId
      : pointerDrag.sourceId;
    const placement: ProjectTabPlacement = previewIndex < pointerDrag.sourceIndex ? 'before' : 'after';
    projectTabDragRef.current = {
      originOrder: pointerDrag.originOrder,
      placement,
      pointerOffsetX,
      previewOrder,
      sourceId: pointerDrag.sourceId,
      targetId,
    };
    pointerDrag.tabs.forEach((tab, originIndex) => {
      const identityId = pointerDrag.originOrder[originIndex];
      if (identityId === pointerDrag.sourceId) {
        tab.dataset.dragging = 'true';
        delete tab.dataset.shifting;
        tab.style.transform = `translate3d(${pointerOffsetX}px, 0, 0)`;
        return;
      }
      const destinationIndex = previewOrder.indexOf(identityId);
      const slotOffset = destinationIndex - originIndex;
      if (slotOffset === 0) {
        delete tab.dataset.shifting;
        tab.style.removeProperty('transform');
        return;
      }
      tab.dataset.shifting = 'true';
      tab.style.transform = `translate3d(calc(${slotOffset} * (var(--project-tab-width) + var(--project-tab-gap))), 0, 0)`;
    });
    const selection = projectTabSelectionRef.current;
    if (selection) {
      const selectedId = latest.current.activeIdentityId ?? '';
      const activeIndex = pointerDrag.originOrder.indexOf(selectedId);
      const selectionIndex = selectedId === pointerDrag.sourceId
        ? activeIndex
        : previewOrder.indexOf(selectedId);
      const selectionOffset = selectedId === pointerDrag.sourceId ? ` + ${pointerOffsetX}px` : '';
      selection.style.transform = `translate3d(calc(${selectionIndex} * (var(--project-tab-width) + var(--project-tab-gap))${selectionOffset}), 0, 0)`;
    }
  }

  function handleProjectTabPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointerDrag = projectTabPointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    if ((event.buttons & 1) === 0) {
      clearProjectTabDrag();
      return;
    }
    if (!pointerDrag.moved) {
      const distance = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
      if (distance <= 5) return;
      const tabs = Array.from(pointerDrag.element.parentElement?.children ?? []).filter(
        (element): element is HTMLElement => element instanceof HTMLElement && Boolean(element.dataset.projectId)
      );
      const sourceIndex = tabs.findIndex(({ dataset }) => dataset.projectId === pointerDrag.sourceId);
      const bounds = tabs.map((tab) => tab.getBoundingClientRect());
      if (sourceIndex < 0 || !bounds[sourceIndex]) {
        clearProjectTabDrag();
        return;
      }
      pointerDrag.centers = bounds.map(({ left, width }) => left + width / 2);
      pointerDrag.moved = true;
      pointerDrag.originOrder = tabs.map(({ dataset }) => dataset.projectId ?? '');
      pointerDrag.sourceIndex = sourceIndex;
      pointerDrag.tabs = tabs;
      try {
        pointerDrag.element.setPointerCapture(event.pointerId);
      } catch {
        // The pointer can be canceled by the browser between queued events.
        clearProjectTabDrag();
        return;
      }
      latest.current.onDragStart();
    }
    event.preventDefault();
    pointerDrag.pendingClientX = event.clientX;
    if (projectTabFrameRef.current === null) {
      projectTabFrameRef.current = window.requestAnimationFrame(() => applyProjectTabDragFrame(pointerDrag));
    }
  }

  function handleProjectTabPointerEnd(event: Pick<PointerEvent, 'pointerId' | 'clientX'>) {
    const pointerDrag = projectTabPointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    if (projectTabFrameRef.current !== null) {
      window.cancelAnimationFrame(projectTabFrameRef.current);
      projectTabFrameRef.current = null;
    }
    if (pointerDrag.moved) {
      pointerDrag.pendingClientX = event.clientX;
      applyProjectTabDragFrame(pointerDrag);
    }
    const currentDrag = projectTabDragRef.current;
    if (pointerDrag.moved) {
      suppressProjectTabClickRef.current = pointerDrag.sourceId;
      suppressClickTimerRef.current = window.setTimeout(() => {
        suppressClickTimerRef.current = null;
        if (suppressProjectTabClickRef.current === pointerDrag.sourceId) suppressProjectTabClickRef.current = null;
      }, 80);
    }
    clearProjectTabDrag();
    if (pointerDrag.moved && currentDrag && currentDrag.sourceId !== currentDrag.targetId) {
      latest.current.onReorder(currentDrag.sourceId, currentDrag.targetId, currentDrag.placement);
    }
  }

  function handleProjectTabPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (projectTabPointerDragRef.current?.pointerId === event.pointerId) clearProjectTabDrag();
  }

  function handleProjectTabClickCapture(event: ReactMouseEvent<HTMLDivElement>, identityId: string) {
    if (event.detail === 0 || suppressProjectTabClickRef.current !== identityId) return;
    event.preventDefault();
    event.stopPropagation();
    suppressProjectTabClickRef.current = null;
  }

  function handleProjectTabClick(event: ReactMouseEvent<HTMLDivElement>, identityId: string) {
    if (event.defaultPrevented) return;
    const target = event.target;
    // The semantic open button, close button, and name input own their actions.
    if (target instanceof Element && target.closest('button, input, textarea, select, a, [contenteditable]')) return;
    onSelect(identityId);
  }

  return {
    projectTabSelectionRef,
    handleProjectTabPointerDown,
    handleProjectTabPointerMove,
    handleProjectTabPointerEnd,
    handleProjectTabPointerCancel,
    handleProjectTabClickCapture,
    handleProjectTabClick,
  };
}
