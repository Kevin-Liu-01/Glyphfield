'use client';

import { T, useGT } from 'gt-next';

import { LabPanelHeading } from '@/components/LabWorkspace';
import {
  Activity,
  AlertCircle,
  Article,
  Badge,
  Braces,
  ChartBar,
  ChartLineUp,
  ChevronDown,
  ChevronRight,
  Circle,
  Command,
  CreditCard,
  CurrencyDollar,
  CursorClick,
  FilePenLine,
  Folder,
  Group,
  Info,
  LayoutGrid,
  ListChecks,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  NavigationArrow,
  Notification,
  PanelLeft,
  PanelRightOpen,
  Quotes,
  RadioButton,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  Table,
  Tabs,
  Textbox,
  ToggleLeft,
  Upload,
  type LucideIcon,
} from '@/components/ui/SolidIcons';
import {
  COMPONENT_FAMILY_OPTIONS,
  COMPONENT_PATTERNS,
  type ComponentPatternId,
} from '@/lib/componentLibrary';

export const COMPONENT_PATTERN_ICONS = {
  'article-body': Article,
  alerts: AlertCircle,
  badges: Badge,
  breadcrumbs: ChevronRight,
  'button-groups': Group,
  buttons: CursorClick,
  cards: LayoutGrid,
  charts: ChartLineUp,
  checkout: CreditCard,
  checkboxes: ListChecks,
  comments: MessageSquareText,
  'command-menu': Command,
  dialogs: RectangleHorizontal,
  'empty-states': Folder,
  'icon-buttons': Square,
  inbox: Mail,
  inputs: Textbox,
  metadata: Braces,
  navigation: NavigationArrow,
  pagination: MoreHorizontal,
  popovers: RectangleVertical,
  pricing: CurrencyDollar,
  progress: Activity,
  radios: RadioButton,
  selects: ChevronDown,
  sheets: PanelRightOpen,
  sidebars: PanelLeft,
  stats: ChartBar,
  tables: Table,
  tabs: Tabs,
  testimonials: Quotes,
  textareas: FilePenLine,
  toasts: Notification,
  toggles: ToggleLeft,
  tooltips: Info,
  uploaders: Upload,
} satisfies Record<ComponentPatternId, LucideIcon>;

export function ComponentPatternIcon({
  className = '',
  pattern,
}: {
  className?: string;
  pattern: ComponentPatternId;
}) {
  const Icon = COMPONENT_PATTERN_ICONS[pattern] ?? Circle;
  return <Icon aria-hidden='true' className={className} />;
}

export default function ComponentLibraryCatalog({
  onSelect,
  selectedPattern,
}: {
  onSelect: (pattern: ComponentPatternId) => void;
  selectedPattern: ComponentPatternId;
}) {
  const gt = useGT();

  return (
    <>
      <LabPanelHeading
        action={<span className='component-library-catalog-count'>{COMPONENT_PATTERNS.length}</span>}
        description={<T>Choose a component here, then configure it on the right.</T>}
        title={<T>Components</T>}
      />
      <nav aria-label={gt('Component catalog')} className='component-library-catalog'>
        {COMPONENT_FAMILY_OPTIONS.map((family) => {
          const patterns = COMPONENT_PATTERNS.filter((pattern) => pattern.family === family.value);
          const headingId = `component-family-${family.value}`;

          return (
            <section aria-labelledby={headingId} className='component-library-catalog-family' key={family.value}>
              <header>
                <h3 id={headingId}>{gt(family.label)}</h3>
                <span>{patterns.length}</span>
              </header>
              <div className='component-library-catalog-list'>
                {patterns.map((pattern) => (
                  <button
                    aria-pressed={selectedPattern === pattern.id}
                    key={pattern.id}
                    onClick={() => onSelect(pattern.id)}
                    type='button'
                  >
                    <span className='component-library-catalog-icon'>
                      <ComponentPatternIcon pattern={pattern.id} />
                    </span>
                    <span title={gt(pattern.description)}>{gt(pattern.label)}</span>
                    <span aria-hidden='true' className='component-library-catalog-selection' />
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </nav>
    </>
  );
}
