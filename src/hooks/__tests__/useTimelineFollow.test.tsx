// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimelineFollow } from '../useTimelineFollow';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

describe('timeline playback following', () => {
  let host: HTMLDivElement;
  let root: Root;
  let viewport: HTMLDivElement;
  let content: HTMLDivElement;
  let follow: ReturnType<typeof useTimelineFollow>['follow'];
  let props: Parameters<typeof useTimelineFollow>[0];
  let notifyResize: () => void;
  let disconnect: ReturnType<typeof vi.fn>;
  let writeScroll: ReturnType<typeof vi.fn>;
  let readWidth: ReturnType<typeof vi.fn>;
  let clock: number;
  let left: number;
  let renders: number;

  function Harness() {
    renders += 1;
    const controller = useTimelineFollow(props);
    follow = controller.follow;
    return <div ref={controller.scrollRef}><div ref={controller.contentRef} /></div>;
  }

  beforeEach(() => {
    renders = 0; left = 0; clock = 0;
    disconnect = vi.fn();
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { notifyResize = callback; }
      observe = vi.fn();
      disconnect = disconnect;
    });
    props = { currentMsRef: { current: 0 }, disabled: false, isPlaying: true, totalMs: 1000 };
    host = document.createElement('div'); document.body.append(host);
    root = createRoot(host);
    act(() => root.render(<Harness />));
    viewport = host.firstElementChild as HTMLDivElement;
    content = viewport.firstElementChild as HTMLDivElement;
    readWidth = vi.fn(() => 400);
    writeScroll = vi.fn((value: number) => { left = value; });
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, get: readWidth });
    Object.defineProperty(content, 'clientWidth', { configurable: true, value: 1000 });
    Object.defineProperty(viewport, 'scrollWidth', { configurable: true, value: 3000 });
    Object.defineProperty(viewport, 'scrollLeft', { configurable: true, get: () => left, set: writeScroll });
    act(() => notifyResize());
    readWidth.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  });

  const tick = (time: number) => act(() => { props.currentMsRef.current = time; follow(time); });
  const wheel = () => act(() => viewport.dispatchEvent(new WheelEvent('wheel', { deltaX: -80, bubbles: true })));
  const pointer = (target: EventTarget, type: string) => act(() => target.dispatchEvent(new PointerEvent(type, { pointerId: 7, bubbles: true })));

  it('follows the right edge from the playback clock without layout reads or React renders', () => {
    const before = renders;
    tick(100); tick(200);
    expect(writeScroll).not.toHaveBeenCalled();
    tick(500);
    expect(left).toBe(180);
    tick(550);
    expect(left).toBe(229);
    expect(readWidth).not.toHaveBeenCalled();
    expect(renders).toBe(before);
  });

  it('clamps to the authored content, not transformed overflow, and follows loop/restart backwards', () => {
    tick(1000);
    expect(left).toBe(600);
    tick(0);
    expect(left).toBe(0);
    tick(900);
    tick(100);
    expect(left).toBe(28);
  });

  it('leaves paused browsing alone but reveals explicit seeks and resumed playback', () => {
    props = { ...props, isPlaying: false };
    act(() => root.render(<Harness />));
    tick(800);
    expect(left).toBe(0);
    act(() => follow(800, true));
    expect(left).toBe(474);
    left = 0;
    viewport.dispatchEvent(new Event('scroll'));
    wheel();
    props = { ...props, isPlaying: true };
    act(() => root.render(<Harness />));
    expect(left).toBe(474);
  });

  it('yields to wheel/trackpad input and resumes after the user has been idle', () => {
    tick(600);
    left = 0; viewport.dispatchEvent(new Event('scroll'));
    wheel();
    tick(650); expect(left).toBe(0);
    clock = 1000; wheel();
    clock = 2000; tick(700); expect(left).toBe(0);
    clock = 2501; tick(700); expect(left).toBe(376);
  });

  it('extends the quiet window through touch momentum without mistaking its own scrolls for input', () => {
    tick(700);
    viewport.dispatchEvent(new Event('scroll'));
    tick(800); expect(left).toBe(474);
    pointer(content, 'pointerdown'); pointer(window, 'pointerup');
    clock = 1400;
    left = 200; viewport.dispatchEvent(new Event('scroll'));
    clock = 2000; tick(900); expect(left).toBe(200);
    clock = 2901; tick(900); expect(left).toBe(572);
    viewport.dispatchEvent(new Event('scroll'));
    tick(950); expect(left).toBe(600);
  });

  it('yields when the native scrollbar moves without a DOM pointer event', () => {
    tick(700);
    left = 0; viewport.dispatchEvent(new Event('scroll'));
    tick(800); expect(left).toBe(0);
    clock = 1501; tick(800); expect(left).toBe(474);
  });

  it.each(['pointerup', 'pointercancel', 'blur'])('does not move the axis during a held drag and recovers after %s outside the rail', (ending) => {
    pointer(content, 'pointerdown');
    clock = 5000;
    tick(900);
    act(() => follow(900, true));
    expect(left).toBe(0);
    if (ending === 'blur') act(() => window.dispatchEvent(new Event('blur')));
    else pointer(window, ending);
    tick(900); expect(left).toBe(0);
    clock += 1501;
    tick(900); expect(left).toBe(572);
  });

  it('does not move disabled/exporting timelines even for explicit seeks', () => {
    props = { ...props, disabled: true };
    act(() => root.render(<Harness />));
    tick(900); act(() => follow(1000, true));
    expect(writeScroll).not.toHaveBeenCalled();
  });

  it('updates cached geometry on resize and safely skips zero-size/nonoverflowing timelines', () => {
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 200 });
    act(() => notifyResize());
    tick(500); expect(left).toBe(340);
    writeScroll.mockClear();
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 0 });
    act(() => notifyResize()); tick(900);
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 1200 });
    act(() => notifyResize()); tick(900);
    expect(writeScroll).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('never writes a nonfinite scroll position for an empty timeline', () => {
    props = { ...props, totalMs: 0 };
    act(() => root.render(<Harness />));
    tick(900); act(() => follow(0, true));
    expect(writeScroll).not.toHaveBeenCalled();
  });
});
