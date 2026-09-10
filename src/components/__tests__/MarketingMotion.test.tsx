// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import MarketingMotion from '../MarketingMotion';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('batches landing geometry reads before reveal writes without hiding initial content', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const observe = vi.fn();
  vi.stubGlobal('IntersectionObserver', class { observe = observe; disconnect() {} });
  const host = document.body.appendChild(document.createElement('div'));
  const sections = [0, 2000].map(top => {
    const section = host.appendChild(document.createElement('section'));
    section.dataset.motionReveal = '';
    const item = section.appendChild(document.createElement('div'));
    item.dataset.motionItem = '';
    return { section, item, top };
  });
  const events: string[] = [];
  for (const { section, item, top } of sections) {
    vi.spyOn(section, 'getBoundingClientRect').mockImplementation(() => {
      events.push('read');
      return { top } as DOMRect;
    });
    const set = item.style.setProperty.bind(item.style);
    vi.spyOn(item.style, 'setProperty').mockImplementation((...args) => {
      events.push('write');
      set(...args);
    });
  }
  const mount = host.appendChild(document.createElement('div'));
  const root = createRoot(mount);
  try {
    act(() => root.render(<MarketingMotion />));
    expect(events).toEqual(['read', 'read', 'write', 'write']);
    expect(sections[0]!.section.dataset.motionState).toBe('visible');
    expect(sections[1]!.section.dataset.motionState).toBe('waiting');
    expect(observe).toHaveBeenCalledWith(sections[1]!.section);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
