'use client';

import { useLayoutEffect, useRef, type CSSProperties } from 'react';

export default function PlaygroundEditableText({
  label,
  onChange,
  onFocus,
  style,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  style: CSSProperties;
  value: string;
}) {
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text || document.activeElement === text || text.innerText === value) return;
    text.innerText = value;
  }, [value]);

  return (
    <span
      aria-label={label}
      aria-multiline='true'
      className='design-lab-canvas-text'
      contentEditable='plaintext-only'
      data-canvas-editable='true'
      onBlur={(event) => onChange(event.currentTarget.innerText.replace(/\r\n/g, '\n'))}
      onFocus={onFocus}
      onInput={(event) => onChange(event.currentTarget.innerText.replace(/\r\n/g, '\n'))}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') event.currentTarget.blur();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      ref={textRef}
      role='textbox'
      spellCheck
      style={style}
      suppressContentEditableWarning
      tabIndex={0}
    />
  );
}
