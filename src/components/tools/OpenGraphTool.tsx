'use client';

import ExpressionEditor from '@/components/expressions/ExpressionEditor';
import type { BrandIdentity } from '@/lib/brandIdentity';
import type { StudioTool } from '@/lib/studioCatalog';

/** OpenGraph and social formats on the shared expression editor. */
export default function OpenGraphTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  return <ExpressionEditor identity={identity} kind='opengraph' tool={tool} />;
}
