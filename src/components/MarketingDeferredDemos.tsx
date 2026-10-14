'use client';

import { lazy, useRef, type ComponentProps, type ReactNode } from 'react';

import { useDeferredHydration } from '@/hooks/useDeferredHydration';
import { useViewportActivity } from '@/hooks/useViewportActivity';

import type MarketingOpenSourceWorkbenchComponent from '@/components/MarketingOpenSourceWorkbench';

// The interactive demos below the hero keep their server HTML and stylesheets.
// Their code loads and hydrates as each one nears the viewport, using the same
// margin as the landing shaders' prewarm range.
const HYDRATION_MARGIN = '960px 0px';

const loadShowcaseDemos = () => import('@/components/MarketingStudioShowcaseDemos');
const loadAgentControlLab = () => import('@/components/MarketingAgentControlLab');
const loadOpenSourceWorkbench = () => import('@/components/MarketingOpenSourceWorkbench');

// React.lazy, unlike next/dynamic, adds no preload links, so offscreen demos do
// not compete with the hero for bandwidth.
const MarketingIdentityDemo = lazy(() => loadShowcaseDemos().then((demos) => ({ default: demos.MarketingIdentityDemo })));
const MarketingMaterialDemo = lazy(() => loadShowcaseDemos().then((demos) => ({ default: demos.MarketingMaterialDemo })));
const MarketingApplicationsDemo = lazy(() => loadShowcaseDemos().then((demos) => ({ default: demos.MarketingApplicationsDemo })));
const MarketingMotionDemo = lazy(() => loadShowcaseDemos().then((demos) => ({ default: demos.MarketingMotionDemo })));
const MarketingAgentControlLab = lazy(loadAgentControlLab);
const MarketingOpenSourceWorkbench = lazy(loadOpenSourceWorkbench);

type DemoShellProps = {
  className?: string;
  'data-motion-item'?: boolean;
};

function DeferredDemo({
  children,
  load,
  ...shellProps
}: DemoShellProps & { children: ReactNode; load: () => Promise<unknown> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const near = useViewportActivity(containerRef, { respectDocumentVisibility: false, rootMargin: HYDRATION_MARGIN });
  const island = useDeferredHydration(containerRef, { enabled: near, load });
  return (
    <div ref={containerRef} {...shellProps} {...island.props}>
      {island.props ? null : children}
    </div>
  );
}

export function DeferredIdentityDemo(props: DemoShellProps) {
  return <DeferredDemo load={loadShowcaseDemos} {...props}><MarketingIdentityDemo /></DeferredDemo>;
}

export function DeferredMaterialDemo(props: DemoShellProps) {
  return <DeferredDemo load={loadShowcaseDemos} {...props}><MarketingMaterialDemo /></DeferredDemo>;
}

export function DeferredApplicationsDemo(props: DemoShellProps) {
  return <DeferredDemo load={loadShowcaseDemos} {...props}><MarketingApplicationsDemo /></DeferredDemo>;
}

export function DeferredMotionDemo(props: DemoShellProps) {
  return <DeferredDemo load={loadShowcaseDemos} {...props}><MarketingMotionDemo /></DeferredDemo>;
}

export function DeferredAgentControlLab(props: DemoShellProps) {
  return <DeferredDemo load={loadAgentControlLab} {...props}><MarketingAgentControlLab /></DeferredDemo>;
}

export function DeferredOpenSourceWorkbench({
  className,
  'data-motion-item': motionItem,
  ...workbench
}: DemoShellProps & ComponentProps<typeof MarketingOpenSourceWorkbenchComponent>) {
  return (
    <DeferredDemo className={className} data-motion-item={motionItem} load={loadOpenSourceWorkbench}>
      <MarketingOpenSourceWorkbench {...workbench} />
    </DeferredDemo>
  );
}
