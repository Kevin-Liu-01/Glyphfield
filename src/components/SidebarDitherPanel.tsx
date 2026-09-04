import type { ReactNode } from 'react';

type SidebarDitherPanelProps = {
  icons: readonly ReactNode[];
  variant: 'docs' | 'studio';
};

export default function SidebarDitherPanel({
  icons,
  variant,
}: SidebarDitherPanelProps) {
  return (
    <div
      aria-hidden='true'
      className='project-dither-panel sidebar-dither-panel'
      data-variant={variant}
    >
      <span className='project-dither-field' />
      <span className='project-dither-sweep' />
      <span className='project-dither-symbols'>
        {icons.slice(0, 4).map((icon, index) => (
          <span key={`project-dither-symbol-${index}`}>{icon}</span>
        ))}
      </span>
    </div>
  );
}
