// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProjectTabInteraction } from '@/hooks/useProjectTabInteraction';

describe('project tab pointer transactions', () => {
  let container: HTMLDivElement;
  let root: Root | null;
  const reorder = vi.fn();
  const select = vi.fn();
  const close = vi.fn();
  const dragStart = vi.fn();
  const capture = vi.fn();

  function Harness() {
    const interaction = useProjectTabInteraction({
      activeIdentityId: 'alpha',
      activeProjectTabIndex: 0,
      onDragStart: dragStart,
      onReorder: reorder,
      onSelect: select,
    });
    return <nav>
      <span ref={interaction.projectTabSelectionRef} />
      {['alpha', 'beta', 'gamma'].map((id) => <div
        data-project-id={id}
        key={id}
        onClick={(event) => interaction.handleProjectTabClick(event, id)}
        onClickCapture={(event) => interaction.handleProjectTabClickCapture(event, id)}
        onLostPointerCapture={interaction.handleProjectTabPointerCancel}
        onPointerCancel={interaction.handleProjectTabPointerCancel}
        onPointerDown={(event) => interaction.handleProjectTabPointerDown(event, id)}
        onPointerMove={interaction.handleProjectTabPointerMove}
        onPointerUp={interaction.handleProjectTabPointerEnd}
      >
        <button data-open onClick={() => select(id)}>{id}</button>
        <input aria-label={`${id} name`} defaultValue={id} />
        <button className='project-tab-close' onClick={() => close(id)}><svg><path /></svg></button>
      </div>)}
    </nav>;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root!.render(<Harness />));
    Array.from(container.querySelectorAll<HTMLElement>('[data-project-id]')).forEach((tab, index) => {
      let captured: number | null = null;
      Object.defineProperties(tab, {
        getBoundingClientRect: { value: () => ({ left: index * 120, top: 0, width: 120, height: 38 }) },
        setPointerCapture: { value: (id: number) => { capture(id); captured = id; } },
        hasPointerCapture: { value: (id: number) => captured === id },
        releasePointerCapture: { value: (id: number) => { if (captured === id) captured = null; } },
      });
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function tab(id = 'alpha') {
    return container.querySelector<HTMLElement>(`[data-project-id="${id}"]`)!;
  }

  function pointer(target: EventTarget, type: string, x: number, buttons = type === 'pointerup' ? 0 : 1, pointerId = 1) {
    act(() => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId, button: 0, buttons, clientX: x, clientY: 19,
    })));
  }

  function frame() {
    act(() => vi.advanceTimersByTime(20));
  }

  function click(id = 'alpha') {
    act(() => tab(id).querySelector<HTMLButtonElement>('[data-open]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
  }

  it.each([{ x: 3, y: 19 }, { x: 35, y: 3 }])('invariant_tab_chrome_at_$x_$y_opens_the_project', ({ x, y }) => {
    act(() => tab('beta').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientX: 120 + x, clientY: y })));
    expect(select).toHaveBeenCalledExactlyOnceWith('beta');
  });

  it('invariant_close_and_rename_controls_do_not_select_their_project', () => {
    act(() => {
      tab('beta').querySelector('.project-tab-close path')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      tab('beta').querySelector('input')!.click();
    });
    expect(close).toHaveBeenCalledExactlyOnceWith('beta');
    expect(select).not.toHaveBeenCalled();
  });

  it('invariant_keyboard_activation_is_not_swallowed_by_an_earlier_drag', () => {
    pointer(tab(), 'pointerdown', 40);
    pointer(tab(), 'pointermove', 190);
    pointer(tab(), 'pointerup', 190);
    act(() => tab().querySelector<HTMLButtonElement>('[data-open]')!.click());
    expect(select).toHaveBeenCalledExactlyOnceWith('alpha');
  });

  it('invariant_release_outside_the_tab_never_turns_later_hover_into_a_drag', () => {
    pointer(tab(), 'pointerdown', 40);
    pointer(window, 'pointerup', 400);
    pointer(tab(), 'pointermove', 90, 0);
    frame();
    expect(capture).not.toHaveBeenCalled();
    expect(tab().dataset.dragging).toBeUndefined();
    click();
    expect(select).toHaveBeenCalledWith('alpha');
  });

  it('invariant_hover_cancels_a_gesture_whose_release_was_not_delivered', () => {
    pointer(tab(), 'pointerdown', 40);
    pointer(tab(), 'pointermove', 90, 0);
    frame();
    expect(capture).not.toHaveBeenCalled();
    expect(tab().dataset.dragging).toBeUndefined();
  });

  it.each(['pointercancel', 'blur'])('invariant_window_%s_clears_drag_styles_and_keeps_the_next_click_usable', (type) => {
    pointer(tab(), 'pointerdown', 40);
    pointer(tab(), 'pointermove', 190);
    frame();
    expect(tab().dataset.dragging).toBe('true');
    if (type === 'blur') act(() => window.dispatchEvent(new Event('blur')));
    else pointer(window, type, 190);
    expect(tab().dataset.dragging).toBeUndefined();
    expect(tab().style.transform).toBe('');
    expect(reorder).not.toHaveBeenCalled();
    pointer(tab(), 'pointerdown', 40);
    pointer(tab(), 'pointerup', 40);
    click();
    expect(select).toHaveBeenCalledWith('alpha');
  });

  it.each(['.project-tab-close path', 'input'])('invariant_%s_interactions_do_not_arm_tab_dragging', (selector) => {
    pointer(tab().querySelector(selector)!, 'pointerdown', 40);
    pointer(tab(), 'pointermove', 190);
    frame();
    expect(capture).not.toHaveBeenCalled();
    expect(tab().dataset.dragging).toBeUndefined();
  });

  it('invariant_a_real_drag_commits_once_and_suppresses_only_its_generated_click', () => {
    pointer(tab(), 'pointerdown', 40);
    pointer(tab(), 'pointermove', 190);
    frame();
    pointer(tab(), 'pointerup', 190);
    expect(reorder).toHaveBeenCalledExactlyOnceWith('alpha', 'beta', 'after');
    click();
    expect(select).not.toHaveBeenCalled();
    pointer(tab(), 'pointerdown', 40);
    pointer(tab(), 'pointerup', 40);
    click();
    expect(select).toHaveBeenCalledExactlyOnceWith('alpha');
  });

  it('invariant_a_fresh_click_is_not_swallowed_when_a_drag_did_not_generate_a_click', () => {
    pointer(tab(), 'pointerdown', 40);
    pointer(tab(), 'pointermove', 190);
    pointer(tab(), 'pointerup', 190);
    pointer(tab(), 'pointerdown', 40);
    pointer(tab(), 'pointerup', 40);
    click();
    expect(select).toHaveBeenCalledWith('alpha');
  });

  it('invariant_reorder_uses_the_release_position_even_after_the_last_animation_frame', () => {
    pointer(tab(), 'pointerdown', 40);
    pointer(tab(), 'pointermove', 90);
    frame();
    pointer(tab(), 'pointerup', 190);
    expect(reorder).toHaveBeenCalledExactlyOnceWith('alpha', 'beta', 'after');
  });

  it('invariant_another_pointer_cannot_replace_the_current_tab_gesture', () => {
    pointer(tab(), 'pointerdown', 40);
    pointer(tab('gamma'), 'pointerdown', 280, 1, 2);
    pointer(tab(), 'pointermove', 190);
    pointer(tab(), 'pointerup', 190);
    expect(reorder).toHaveBeenCalledExactlyOnceWith('alpha', 'beta', 'after');
  });

  it('invariant_unmount_cancels_pending_drag_frames_without_committing', () => {
    pointer(tab(), 'pointerdown', 40);
    pointer(tab(), 'pointermove', 190);
    act(() => root!.unmount());
    root = null;
    expect(vi.getTimerCount()).toBe(0);
    frame();
    expect(reorder).not.toHaveBeenCalled();
  });
});
