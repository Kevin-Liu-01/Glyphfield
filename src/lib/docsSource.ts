import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import { createElement } from 'react';

import {
  Blend,
  BookMarked,
  BookOpen,
  BookOpenText,
  Books,
  Bot,
  Box,
  Braces,
  Command,
  Component,
  Download,
  Files,
  GitBranch,
  Images,
  LayoutGrid,
  ListChecks,
  Monitor,
  Package,
  Palette,
  PanelsTopLeft,
  Planet,
  PlugsConnected,
  Presentation,
  SealCheck,
  Settings2,
  ShieldCheck,
  Sparkles,
  Table,
  WandSparkles,
  Warning,
  type LucideIcon,
} from '@/components/ui/SolidIcons';

const DOCS_SOLID_ICONS: Record<string, LucideIcon> = {
  BadgeCheck: SealCheck,
  Blocks: Box,
  Blend,
  BookMarked,
  BookOpen,
  BookOpenText,
  Bot,
  Braces,
  Component,
  Download,
  Files,
  GitBranch,
  Images,
  Keyboard: Command,
  LayoutGrid,
  LibraryBig: Books,
  ListChecks,
  MonitorCog: Monitor,
  Orbit: Planet,
  PackageOpen: Package,
  Palette,
  PanelsTopLeft,
  PlugZap: PlugsConnected,
  Presentation,
  Settings2,
  ShieldCheck,
  Sparkles,
  TableProperties: Table,
  TriangleAlert: Warning,
  WandSparkles,
};

export const docsSource = loader({
  baseUrl: '/docs',
  icon: (name) => {
    const Icon = name ? DOCS_SOLID_ICONS[name] : undefined;
    return Icon ? createElement(Icon, { 'aria-hidden': true, weight: 'fill' }) : undefined;
  },
  source: docs.toFumadocsSource(),
});

export function getDocumentationImage(page: { slugs: string[] }) {
  const segments = [...page.slugs, 'image.png'];

  return {
    height: 630,
    url: `/og/docs/${segments.join('/')}`,
    width: 1200,
  } as const;
}
