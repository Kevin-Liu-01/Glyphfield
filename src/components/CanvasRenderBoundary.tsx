'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useViewportActivity } from '@/hooks/useViewportActivity';

/** Keep geometry in the workspace, but release offscreen renderer/GPU work. */
export default function CanvasRenderBoundary({ children, keepAlive = false, bounds }: {
  children: () => ReactNode;
  keepAlive?: boolean;
  bounds?: CSSProperties;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const visible = useViewportActivity(anchor, { rootMargin: '400px', rootSelector: '.canvas-viewport-scroll' });
  return <div className='canvas-render-boundary' data-rendering={keepAlive || visible ? 'true' : 'false'} data-unframed={bounds ? 'true' : undefined}>
    <div aria-hidden='true' className='canvas-render-observer' ref={anchor} style={bounds} />
    {keepAlive || visible ? children() : null}
  </div>;
}
