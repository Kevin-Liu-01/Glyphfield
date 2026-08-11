import type { ReactNode } from 'react';

export function LabPanelHeading({
  action,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className='lab-panel-heading'>
      <div className='min-w-0'>
        {eyebrow ? <p className='lab-panel-eyebrow'>{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className='lab-panel-action'>{action}</div> : null}
    </header>
  );
}

export function LabInspectorSection({
  children,
  className = '',
  description,
  index,
  meta,
  title,
}: {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  index: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section className={`lab-inspector-section ${className}`.trim()}>
      <div className='lab-section-heading'>
        <div>
          <span>{index}</span>
          <h2>{title}</h2>
        </div>
        {meta ? <small>{meta}</small> : null}
      </div>
      {description ? <p className='lab-section-description'>{description}</p> : null}
      {children}
    </section>
  );
}
