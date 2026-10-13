'use client';

import ExpressionEditor from '@/components/expressions/ExpressionEditor';
import type { BrandIdentity } from '@/lib/brandIdentity';
import type { StudioTool } from '@/lib/studioCatalog';
import type { TemplateKind } from '@/lib/templateAssets';

/** Partnership lockup, Blog cover, and Slide templates on the shared expression editor. */
export default function TemplateTool({ identity, kind, tool }: { identity: BrandIdentity; kind: TemplateKind; tool: StudioTool }) {
  return <ExpressionEditor identity={identity} kind={kind} tool={tool} />;
}
