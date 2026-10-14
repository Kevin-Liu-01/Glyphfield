'use client';

import { lazy, useRef } from 'react';

import { useDeferredRuntime } from '@/hooks/useDeferredRuntime';
import { useDeferredHydration } from '@/hooks/useDeferredHydration';
import { useViewportActivity } from '@/hooks/useViewportActivity';

// The server renders the editor in place; in the browser its code is a separate
// chunk that loads after the page hydrates. React.lazy, unlike next/dynamic, adds
// no preload or stylesheet links: the editor's view needs only global rules, and
// its module stylesheets load with its code.
const loadLiveEditor = () => import('@/components/MarketingAnimationStudioLive');
const MarketingAnimationStudioLive = lazy(loadLiveEditor);
// Fetch the hero editor while the page hydrates rather than after it.
if (typeof window !== 'undefined') void loadLiveEditor().catch(() => {});

function AnimationStudioPlaceholder() {
  return (
    <div className='marketing-animation-placeholder'>
      <i aria-hidden='true' />
      <span>Loading live Animation Studio…</span>
    </div>
  );
}

export default function MarketingAnimationDemo({ eager = false }: { eager?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inRange = useViewportActivity(containerRef, { initialActive: eager, rootMargin: '420px' });
  const visible = useViewportActivity(containerRef, { rootMargin: '0px' });
  const deferredReady = useDeferredRuntime(!eager && inRange, 300, {
    deferWhileInteracting: true,
  });
  // The hero is primary content: render its real controls into the initial HTML
  // without a streamed loading boundary. Only optional offscreen demos idle.
  const runtimeReady = eager || deferredReady;
  // The page hydrates around the server-rendered editor; the editor's own code
  // loads right after and replaces that markup with the live editor.
  const island = useDeferredHydration(containerRef, { enabled: runtimeReady, load: loadLiveEditor });

  return (
    <div
      className='marketing-animation-lazy-shell'
      data-studio-interactive={island.live && runtimeReady}
      ref={containerRef}
      {...island.props}
    >
      {/* Retain this one editor's state after loading; visibility suspends work,
          not the user's edits or their chosen play/pause state. */}
      {island.props ? null : runtimeReady ? <MarketingAnimationStudioLive viewportVisible={visible} /> : <AnimationStudioPlaceholder />}
    </div>
  );
}
