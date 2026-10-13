// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CanvasSelectionMenu from '@/components/CanvasSelectionMenu';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('CanvasSelectionMenu arrange, style and lock actions', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.querySelectorAll('.studio-context-menu').forEach((menu) => menu.remove());
  });

  function render(unitCount: number, extra: Partial<Parameters<typeof CanvasSelectionMenu>[0]> = {}) {
    const props = {
      arrangeUnitCount: unitCount,
      canGroup: true,
      canUngroup: false,
      count: unitCount,
      onAlign: vi.fn(),
      onArrange: vi.fn(),
      onBringForward: vi.fn(),
      onClose: vi.fn(),
      onDelete: vi.fn(),
      onDuplicate: vi.fn(),
      onGroup: vi.fn(),
      onSendBackward: vi.fn(),
      onUngroup: vi.fn(),
      position: { x: 20, y: 20 },
      ...extra,
    };
    act(() => root.render(<CanvasSelectionMenu {...props} />));
    return props;
  }

  const item = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]')]
    .find((button) => button.textContent?.includes(label));

  it('aligns to the selection with two units and distributes with three', () => {
    const props = render(2);
    expect(item('Align left edges')?.disabled).toBe(false);
    expect(item('Distribute horizontally')?.disabled).toBe(true);
    act(() => item('Align vertical centers')!.click());
    expect(props.onArrange).toHaveBeenCalledWith('vertical-center');
    // The artboard alignment section is unchanged.
    expect(item('Align left')).toBeDefined();

    const three = render(3);
    act(() => item('Distribute vertically')!.click());
    expect(three.onArrange).toHaveBeenCalledWith('distribute-vertical');
  });

  it('hides selection alignment for one layer and offers style and lock commands', () => {
    const onCopyStyle = vi.fn();
    const onPasteStyle = vi.fn();
    const onToggleLock = vi.fn();
    render(1, { canPasteStyle: false, onCopyStyle, onPasteStyle, onToggleLock });
    expect(item('Align left edges')).toBeUndefined();
    expect(item('Paste style')?.disabled).toBe(true);
    act(() => item('Copy style')!.click());
    act(() => item('Lock selection')!.click());
    expect(onCopyStyle).toHaveBeenCalledOnce();
    expect(onToggleLock).toHaveBeenCalledOnce();
  });
});
