'use client';

import {
  createElement,
  Fragment,
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useGT } from 'gt-next';

import styles from '@/components/tools/components/ComponentLibraryTool.module.css';

import type { LiveStore } from '@/hooks/useLiveStore';
import type { BrandIdentity } from '@/lib/brandIdentity';
import {
  COMPONENT_STATES,
  componentPattern,
  componentPreviewVariables,
  componentRoleColors,
  resolvedComponentSettings,
  type ComponentContent,
  type ComponentLibrarySettings,
  type ComponentPatternId,
  type ComponentStateId,
} from '@/lib/componentLibrary';
import {
  collectClasses,
  componentCss,
  isElement,
  markupContext,
  type UiNode,
} from '@/lib/componentMarkup';
import { applyDemoAction, componentTree, type DemoState, type TemplateContext } from '@/lib/componentTemplates';
import type { ColorMode } from '@/lib/colorSystem';

/**
 * Renders the component library's element trees as React: one pane per theme with
 * the brand's CSS custom properties, a live keyboard-operable demo, and inert state
 * replicas. Styles come from the same rules as the exported code.
 */

const SVG_ATTRIBUTES: Readonly<Record<string, string>> = {
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-width': 'strokeWidth',
};

const DOM_ATTRIBUTES: Readonly<Record<string, string>> = {
  autocomplete: 'autoComplete',
  colspan: 'colSpan',
  for: 'htmlFor',
  inputmode: 'inputMode',
  maxlength: 'maxLength',
  readonly: 'readOnly',
  tabindex: 'tabIndex',
};

const noop = () => {};

function reactProps(node: Exclude<UiNode, string | null | false | undefined>, key: number): Record<string, unknown> {
  const props: Record<string, unknown> = { key };
  if (node.className) props.className = node.className;
  if (node.style) props.style = node.style;
  for (const [name, value] of Object.entries(node.attrs ?? {})) {
    if (value === undefined || value === false) continue;
    if (name === 'value') {
      if (node.tag === 'option') props.value = value;
      else props.defaultValue = value;
      continue;
    }
    if (name === 'checked') {
      props.checked = Boolean(value);
      props.onChange = noop;
      continue;
    }
    props[SVG_ATTRIBUTES[name] ?? DOM_ATTRIBUTES[name] ?? name] = value === true && !name.startsWith('aria-') && !name.startsWith('data-') ? true : value;
  }
  return props;
}

function renderUiNode(node: UiNode, key = 0): ReactNode {
  if (typeof node === 'string') return node;
  if (!isElement(node)) return null;
  const children = (node.children ?? []).map((child, index) => renderUiNode(child, index));
  if (node.tag === 'textarea') {
    // Textareas take their text as defaultValue, never as children.
    return createElement('textarea', reactProps(node, key));
  }
  return createElement(node.tag, reactProps(node, key), ...(children.length ? children : []));
}

/** Wide layouts shrink further in the state replicas so their columns still fit. */
const WIDE_PATTERNS = new Set<ComponentPatternId>(['cards', 'charts', 'checkout', 'command-menu', 'dialogs', 'inbox', 'navigation', 'sheets', 'sidebars', 'stats', 'tables']);

/** Panes need room for overlays that are positioned inside them. */
const PANE_MIN_HEIGHT: Partial<Record<ComponentPatternId, number>> = {
  'command-menu': 320,
  dialogs: 380,
  popovers: 300,
  sheets: 460,
  tooltips: 160,
};

const FORCED_STATES = new Set<ComponentStateId>(['hover', 'focus', 'active', 'selected', 'disabled', 'loading', 'error']);

function rovingKeyDown(event: KeyboardEvent<HTMLElement>) {
  const container = (event.target as HTMLElement).closest<HTMLElement>('[data-roving]');
  if (!container || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  const items = Array.from(container.querySelectorAll<HTMLElement>('[data-action]:not(:disabled)'));
  const index = items.indexOf(event.target as HTMLElement);
  if (index < 0) return;
  event.preventDefault();
  const last = items.length - 1;
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index === 0 ? last : index - 1) : (index === last ? 0 : index + 1);
  items[next]?.focus();
  if (container.getAttribute('role') === 'tablist' || container.getAttribute('role') === 'group') items[next]?.click();
}

type PaneProps = {
  assetPath?: string;
  content: ComponentContent;
  demo: DemoState;
  identity: BrandIdentity;
  mode: ColorMode;
  onDemo: (next: DemoState) => void;
  pattern: ComponentPatternId;
  settingsStore: LiveStore<ComponentLibrarySettings>;
  states: readonly ComponentStateId[];
  textSettings: Pick<ComponentLibrarySettings, 'disabled' | 'label' | 'supportingCopy'>;
};

/** Writes the pane's custom properties on every settings change without re-rendering the trees. */
function usePaneVariables(ref: RefObject<HTMLDivElement | null>, identity: BrandIdentity, store: LiveStore<ComponentLibrarySettings>, mode: ColorMode) {
  useLayoutEffect(() => {
    const apply = () => {
      const element = ref.current;
      if (!element) return;
      const settings = resolvedComponentSettings(identity, store.get());
      const variables = componentPreviewVariables(identity, settings, componentRoleColors(identity, settings, mode)) as Record<string, string | number>;
      for (const [name, value] of Object.entries(variables)) element.style.setProperty(name, String(value));
      element.style.setProperty('--gf-asset-opacity', String(settings.asset.opacity / 100));
    };
    apply();
    return store.subscribe(apply);
  }, [identity, mode, ref, store]);
}

const ComponentPane = memo(function ComponentPane({ assetPath, content, demo, identity, mode, onDemo, pattern, settingsStore, states, textSettings }: PaneProps) {
  const gt = useGT();
  const ref = useRef<HTMLDivElement>(null);
  usePaneVariables(ref, identity, settingsStore, mode);
  const uid = `${pattern}-${mode}`;
  const base: Omit<TemplateContext, 'live' | 'state' | 'uid'> = { content, demo, settings: textSettings };
  const live = componentTree(pattern, { ...base, live: true, state: textSettings.disabled ? 'disabled' : 'default', uid: `${uid}-live` });
  const replicas = states.filter((state) => FORCED_STATES.has(state));

  function onClick(event: MouseEvent<HTMLElement>) {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target || !event.currentTarget.contains(target)) return;
    const value = target.getAttribute('data-action');
    if (value) onDemo(applyDemoAction(demo, value));
    if (target.tagName === 'A') event.preventDefault();
  }

  return (
    <section
      aria-label={mode === 'light' ? gt('Light theme') : gt('Dark theme')}
      className={styles.pane}
      data-gf-root=''
      data-mode={mode}
      data-wide={WIDE_PATTERNS.has(pattern) ? 'true' : undefined}
      ref={ref}
    >
      {assetPath ? <img alt='' aria-hidden='true' className={styles.paneAsset} src={assetPath} /> : null}
      <div className={styles.paneLive} onClick={onClick} onKeyDown={rovingKeyDown} style={{ minHeight: PANE_MIN_HEIGHT[pattern] }}>
        {renderUiNode(live)}
      </div>
      <p className={styles.paneHead}>
        <span>{mode === 'light' ? gt('Light theme') : gt('Dark theme')}</span>
        <span>{gt('Live and keyboard operable')}</span>
      </p>
      {replicas.length ? (
        <div aria-hidden='true' className={styles.paneStates} inert>
          {replicas.map((state) => (
            <figure key={state} style={{ minHeight: PANE_MIN_HEIGHT[pattern] ? Math.round(PANE_MIN_HEIGHT[pattern]! * 0.62) : undefined }}>
              <div className={styles.paneReplica}>
                {renderUiNode(componentTree(pattern, { ...base, live: false, state, uid: `${uid}-${state}` }))}
              </div>
              <figcaption>{gt(COMPONENT_STATES.find(({ id }) => id === state)?.label ?? state)}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
});

/** Scoped CSS for every class a pattern uses in any state, with forced-state hooks. */
export function useComponentPreviewCss(pattern: ComponentPatternId, content: ComponentContent, settings: ComponentLibrarySettings, foreground: string): string {
  const fontRole = settings.typography.role;
  return useMemo(() => {
    const classes = new Set<string>();
    const config = componentPattern(pattern);
    const base = { content, demo: { selected: {}, toggled: {} }, live: false, settings: { disabled: false, label: 'Label', supportingCopy: '' }, uid: 'css' } as const;
    for (const state of config?.states ?? ['default']) collectClasses(componentTree(pattern, { ...base, state }), classes);
    collectClasses(componentTree(pattern, { ...base, live: true, state: 'default' }), classes);
    // Metrics and colors are custom properties in preview CSS; only the classes and font role change it.
    return componentCss(classes, markupContext({ ...settings, typography: { ...settings.typography, role: fontRole } }, foreground, true), '[data-gf-root]');
  }, [content, fontRole, pattern]);
}

export function ComponentPreviewStyle({ css }: { css: string }) {
  return <style>{css}</style>;
}

export const ComponentPanes = memo(function ComponentPanes(props: Omit<PaneProps, 'mode'> & { modes: readonly ColorMode[] }) {
  const { modes, ...rest } = props;
  return <Fragment>{modes.map((mode) => <ComponentPane key={mode} {...rest} mode={mode} />)}</Fragment>;
});
