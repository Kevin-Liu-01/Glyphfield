import type { ReactNode } from 'react';

export function canvasSelectionViewportClipPath(viewport: Element | null): string | undefined {
  const bounds = viewport?.getBoundingClientRect();
  if (!bounds) return undefined;
  return `inset(${Math.max(0, bounds.top)}px ${Math.max(0, window.innerWidth - bounds.right)}px ${Math.max(0, window.innerHeight - bounds.bottom)}px ${Math.max(0, bounds.left)}px)`;
}

export default function CanvasSelectionClip({ children, clipPath }: {
  children: ReactNode;
  clipPath?: string;
}) {
  return (
    <div
      className='canvas-selection-clip'
      style={{ clipPath, inset: 0, pointerEvents: 'none', position: 'fixed', zIndex: 2147483000 }}
    >
      {children}
    </div>
  );
}
