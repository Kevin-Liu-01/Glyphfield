'use client';

import dynamic from 'next/dynamic';

/** The source editor and its syntax highlighter load when a drawer first opens. */
const LazySourceCodeDrawer = dynamic(() => import('@/components/SourceCodeDrawer'), { ssr: false });

export default LazySourceCodeDrawer;
