import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  StudioInspectorSection,
  StudioPanelHeader,
  StudioSidebar,
} from '@/components/LabWorkspace';

describe('LabWorkspace', () => {
  it('renders the shared panel heading contract', () => {
    const markup = renderToStaticMarkup(
      <StudioPanelHeader
        action={<button type='button'>Reset</button>}
        description='Focused controls'
        eyebrow='Inspector'
        title='Typography'
      />
    );

    expect(markup).toContain('data-studio-panel-header="true"');
    expect(markup).toContain('<h2>Typography</h2>');
    expect(markup).toContain('Focused controls');
    expect(markup).toContain('lab-panel-action');
  });

  it('renders icon and metadata in the shared inspector section', () => {
    const markup = renderToStaticMarkup(
      <StudioInspectorSection icon={<span>i</span>} meta='Live' title='Motion'>
        <input aria-label='Speed' type='range' />
      </StudioInspectorSection>
    );

    expect(markup).toContain('data-studio-inspector-section="true"');
    expect(markup).toContain('lab-section-marker');
    expect(markup).toContain('<h2>Motion</h2>');
    expect(markup).toContain('<small>Live</small>');
  });

  it('applies the standard sidebar kind and edge', () => {
    const markup = renderToStaticMarkup(
      <StudioSidebar kind='library' label='assets' side='right' storageKey='test-assets'>
        Assets
      </StudioSidebar>
    );

    expect(markup).toContain('studio-sidebar-library');
    expect(markup).toContain('lab-sidebar-right');
    expect(markup).toContain('data-resize-edge="left"');
    expect(markup).toContain('--resizable-sidebar-expanded-width:292px');
  });
});
