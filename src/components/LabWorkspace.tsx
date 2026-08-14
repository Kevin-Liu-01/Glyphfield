import type { ComponentProps, ComponentPropsWithoutRef, ReactNode } from 'react';

import ResizableSidebar from '@/components/ResizableSidebar';

export type StudioSidebarKind = 'inspector' | 'library' | 'navigation';
export type StudioSidebarSide = 'left' | 'right';

type StudioSidebarProps = Omit<
  ComponentProps<typeof ResizableSidebar>,
  'defaultWidth' | 'maxWidth' | 'minWidth' | 'resizeEdge'
> & {
  defaultWidth?: number;
  kind?: StudioSidebarKind;
  maxWidth?: number;
  minWidth?: number;
  side?: StudioSidebarSide;
};

const STUDIO_SIDEBAR_WIDTH = 292;
const STUDIO_NAVIGATION_WIDTH = 216;

export function StudioSidebar({
  className = '',
  defaultWidth,
  kind = 'inspector',
  maxWidth,
  minWidth,
  side = 'left',
  ...props
}: StudioSidebarProps) {
  const navigation = kind === 'navigation';

  return (
    <ResizableSidebar
      {...props}
      className={`studio-sidebar lab-sidebar lab-sidebar-${side} studio-sidebar-${kind} ${className}`.trim()}
      defaultWidth={defaultWidth ?? (navigation ? STUDIO_NAVIGATION_WIDTH : STUDIO_SIDEBAR_WIDTH)}
      maxWidth={maxWidth ?? (navigation ? 320 : 520)}
      minWidth={minWidth ?? (navigation ? 190 : 220)}
      resizeEdge={side === 'right' ? 'left' : 'right'}
    />
  );
}

export function StudioPanelHeader({
  action,
  className = '',
  density = 'default',
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  className?: string;
  density?: 'compact' | 'default';
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className={`lab-panel-heading ${className}`.trim()} data-density={density} data-studio-panel-header>
      <div className='min-w-0'>
        {eyebrow ? <p className='lab-panel-eyebrow'>{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className='lab-panel-action'>{action}</div> : null}
    </header>
  );
}

export const LabPanelHeading = StudioPanelHeader;

type StudioInspectorSectionProps = Omit<ComponentPropsWithoutRef<'section'>, 'title'> & {
  action?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  index?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
};

export function StudioInspectorSection({
  action,
  children,
  className = '',
  description,
  icon,
  index,
  meta,
  title,
  ...sectionProps
}: StudioInspectorSectionProps) {
  return (
    <section {...sectionProps} className={`lab-inspector-section ${className}`.trim()} data-studio-inspector-section>
      <div className='lab-section-heading'>
        <div>
          {index !== undefined || icon ? <span className='lab-section-marker'>{icon ?? index}</span> : null}
          <h2>{title}</h2>
        </div>
        {meta || action ? <div className='lab-section-trailing'>{meta ? <small>{meta}</small> : null}{action}</div> : null}
      </div>
      {description ? <p className='lab-section-description'>{description}</p> : null}
      {children}
    </section>
  );
}

export const LabInspectorSection = StudioInspectorSection;
