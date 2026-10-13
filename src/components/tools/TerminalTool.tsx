'use client';

import ExpressionEditor from '@/components/expressions/ExpressionEditor';
import type { BrandIdentity } from '@/lib/brandIdentity';
import type { StudioTool } from '@/lib/studioCatalog';

/** Terminal card: multi-tab, brand-themed code windows on the shared expression editor. */
export default function TerminalTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  return <ExpressionEditor identity={identity} kind='terminal' tool={tool} />;
}
