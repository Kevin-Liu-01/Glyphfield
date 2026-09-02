import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ConditionalRender, OptionalRender } from '@/components/RenderControl';

describe('RenderControl', () => {
  it('does not evaluate hidden conditional content', () => {
    const children = vi.fn(() => <span>hidden</span>);

    expect(renderToStaticMarkup(<ConditionalRender when={false}>{children}</ConditionalRender>)).toBe('');
    expect(children).not.toHaveBeenCalled();
  });

  it('evaluates visible conditional content once', () => {
    const children = vi.fn(() => <span>visible</span>);

    expect(renderToStaticMarkup(<ConditionalRender when>{children}</ConditionalRender>)).toBe('<span>visible</span>');
    expect(children).toHaveBeenCalledTimes(1);
  });

  it('passes defined optional values without dropping valid falsy values', () => {
    const renderValue = vi.fn((value: number) => <span>{value}</span>);

    expect(renderToStaticMarkup(<OptionalRender value={0}>{renderValue}</OptionalRender>)).toBe('<span>0</span>');
    expect(renderValue).toHaveBeenCalledWith(0);
  });

  it.each([null, undefined])('does not evaluate missing optional content (%s)', (value) => {
    const children = vi.fn(() => <span>missing</span>);

    expect(renderToStaticMarkup(<OptionalRender value={value}>{children}</OptionalRender>)).toBe('');
    expect(children).not.toHaveBeenCalled();
  });
});
