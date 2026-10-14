import { describe, expect, it } from 'vitest';

import { layerOrderShortcut } from '../layerOrderShortcut';

const press = (key: string, code: string, shiftKey = false) => layerOrderShortcut({ code, key, shiftKey });

describe('layer order shortcuts', () => {
  it('moves one step with the bracket keys', () => {
    expect(press('[', 'BracketLeft')).toBe('backward');
    expect(press(']', 'BracketRight')).toBe('forward');
  });

  it('moves to the back or front with Shift, which types braces on most layouts', () => {
    expect(press('{', 'BracketLeft', true)).toBe('back');
    expect(press('}', 'BracketRight', true)).toBe('front');
  });

  it('accepts bracket characters typed from other keys on non-US layouts', () => {
    // German macOS types [ and ] with Option+5 and Option+6.
    expect(press('[', 'Digit5')).toBe('backward');
    expect(press(']', 'Digit6')).toBe('forward');
  });

  it('ignores other keys', () => {
    expect(press('a', 'KeyA')).toBeNull();
    expect(press('5', 'Digit5', true)).toBeNull();
  });
});
