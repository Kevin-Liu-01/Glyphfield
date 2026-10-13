import type {
  ComponentContent,
  ComponentLibrarySettings,
  ComponentPatternId,
  ComponentStateId,
} from '@/lib/componentLibrary';
import { el, icon, type UiAttrValue, type UiElement, type UiNode } from '@/lib/componentMarkup';

/**
 * Markup for every catalog pattern. A template renders one pattern for one state:
 * `default` with live interaction hooks for the demo, or a forced state (hover,
 * focus, disabled, loading, error, selected, pressed) on the pattern's primary
 * element for the state matrix. Content comes from the active identity.
 */

export type DemoState = {
  selected: Readonly<Record<string, number>>;
  toggled: Readonly<Record<string, boolean>>;
};

export const EMPTY_DEMO_STATE: DemoState = { selected: {}, toggled: {} };

export type TemplateContext = {
  content: ComponentContent;
  demo: DemoState;
  /** Live demos carry data-action hooks; matrix replicas are static. */
  live: boolean;
  settings: Pick<ComponentLibrarySettings, 'disabled' | 'label' | 'supportingCopy'>;
  state: ComponentStateId;
  /** Prefix for ids so label/for pairs stay unique across panes. */
  uid: string;
};

type Attrs = Record<string, UiAttrValue>;

function action(context: TemplateContext, value: string): Attrs {
  return context.live ? { 'data-action': value } : {};
}

/**
 * Live demos describe their next state in data-action: `select:<group>:<index>`
 * or `set:<key>:<true|false>`. The preview applies it to DemoState.
 */
export function applyDemoAction(state: DemoState, value: string): DemoState {
  const [kind, key, raw] = value.split(':');
  if (!key || raw === undefined) return state;
  if (kind === 'select') {
    const index = Number(raw);
    return Number.isInteger(index) ? { ...state, selected: { ...state.selected, [key]: index } } : state;
  }
  if (kind === 'set') return { ...state, toggled: { ...state.toggled, [key]: raw === 'true' } };
  return state;
}

function selectedIndex(context: TemplateContext, group: string, fallback = 0): number {
  return context.demo.selected[group] ?? fallback;
}

function toggled(context: TemplateContext, key: string, fallback: boolean): boolean {
  return context.demo.toggled[key] ?? fallback;
}

/** The primary element's attributes for the current state. */
function stateAttrs(context: TemplateContext, options: { busy?: boolean; disable?: 'attr' | 'aria'; invalid?: boolean } = {}): Attrs {
  const { state } = context;
  const disabled = state === 'disabled' || context.settings.disabled;
  return {
    ...(state === 'hover' || state === 'focus' || state === 'active' ? { 'data-force': state } : {}),
    ...(disabled ? (options.disable === 'aria' ? { 'aria-disabled': 'true' } : { disabled: true }) : {}),
    ...(state === 'loading' && options.busy !== false ? { 'aria-busy': 'true' } : {}),
    ...(state === 'error' && options.invalid !== false ? { 'aria-invalid': 'true' } : {}),
  };
}

function id(context: TemplateContext, name: string): string {
  return `${context.uid}-${name}`;
}

const NUMBER_FORMAT = new Intl.NumberFormat('en-US');

function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toLocaleUpperCase()).join('') || '··';
}

function sentence(value: string, maximum = 140): string {
  const trimmed = value.trim();
  if (trimmed.length <= maximum) return trimmed;
  const cut = trimmed.slice(0, maximum);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).replace(/[,;:]$/, '')}…`;
}

function button(className: string, attrs: Attrs, ...children: UiNode[]): UiElement {
  return el('button', `gf-btn ${className}`, { type: 'button', ...attrs }, ...children);
}

function field(context: TemplateContext, name: string, label: string, control: UiNode, hint?: string, error?: string): UiElement {
  const invalid = context.state === 'error' && Boolean(error);
  return el('div', 'gf-field', null,
    el('label', 'gf-label', { for: id(context, name) }, label),
    control,
    invalid ? el('p', 'gf-error-text', { id: id(context, `${name}-message`) }, error!) : hint ? el('p', 'gf-hint', { id: id(context, `${name}-message`) }, hint) : null,
  );
}

function badge(tone: 'neutral' | 'primary' | 'outline' | 'positive' | 'caution' | 'negative', text: string): UiElement {
  if (tone === 'positive' || tone === 'caution' || tone === 'negative') {
    return el('span', 'gf-badge gf-badge-outline', null, el('span', `gf-dot gf-tone-${tone}`, { 'aria-hidden': 'true' }), text);
  }
  return el('span', `gf-badge gf-badge-${tone}`, null, text);
}

function skeleton(width: string): UiElement {
  return { attrs: { 'aria-hidden': 'true' }, className: 'gf-skeleton', style: { width }, tag: 'span' };
}

// ── Actions ─────────────────────────────────────────────────────────────────

function buttons(context: TemplateContext): UiElement {
  const loading = context.state === 'loading';
  const primary = button('gf-btn-primary', stateAttrs(context), loading ? icon('spinner', 'gf-spinner') : null, loading ? 'Working…' : context.settings.label);
  return el('div', 'gf-stack-lg', null,
    el('div', 'gf-row', null,
      primary,
      button('gf-btn-secondary', {}, 'Contact sales'),
      button('gf-btn-outline', {}, 'Read the docs'),
      button('gf-btn-ghost', {}, 'Learn more', icon('arrow-right')),
    ),
    el('div', 'gf-row', null,
      button('gf-btn-outline', {}, icon('download'), 'Export'),
      button('gf-btn-danger', {}, 'Delete project'),
    ),
  );
}

function iconButtons(context: TemplateContext): UiElement {
  const items: [Parameters<typeof icon>[0], string][] = [['plus', 'Create'], ['search', 'Search'], ['copy', 'Copy link'], ['download', 'Download'], ['sliders', 'Adjust filters'], ['more', 'More actions']];
  return el('div', 'gf-row', { 'aria-label': `${context.content.short} toolbar`, role: 'toolbar' },
    ...items.map(([name, label], index) => button(index === 0 ? 'gf-btn-primary gf-btn-icon' : 'gf-btn-outline gf-btn-icon', { 'aria-label': label, title: label, ...(index === 0 ? stateAttrs(context) : {}) }, context.state === 'loading' && index === 0 ? icon('spinner', 'gf-spinner') : icon(name))),
  );
}

function buttonGroups(context: TemplateContext): UiElement {
  const views = ['Design', 'Preview', 'Code'];
  const current = context.state === 'selected' ? 1 : selectedIndex(context, 'view');
  const page = selectedIndex(context, 'pager', 1);
  return el('div', 'gf-stack-lg', null,
    el('div', 'gf-segmented', { 'aria-label': 'View', 'data-roving': 'true', role: 'group' },
      ...views.map((view, index) => el('button', 'gf-segment', {
        'aria-pressed': index === current ? 'true' : 'false',
        type: 'button',
        ...action(context, `select:view:${index}`),
        ...(index === 0 ? stateAttrs(context, { invalid: false }) : {}),
      }, view)),
    ),
    el('div', 'gf-joined', { 'aria-label': 'Pages', role: 'group' },
      button('gf-btn-outline gf-btn-icon gf-joined-first', { 'aria-label': 'Previous page', ...action(context, `select:pager:${Math.max(0, page - 1)}`) }, icon('chevron-left')),
      button('gf-btn-outline gf-joined-mid gf-num', { 'aria-live': 'polite' }, `Page ${page + 1} of 12`),
      button('gf-btn-outline gf-btn-icon gf-joined-last', { 'aria-label': 'Next page', ...action(context, `select:pager:${Math.min(11, page + 1)}`) }, icon('chevron-right')),
    ),
  );
}

// ── Forms ───────────────────────────────────────────────────────────────────

function inputs(context: TemplateContext): UiElement {
  const loading = context.state === 'loading';
  return el('div', 'gf-stack-lg', null,
    field(context, 'workspace', 'Workspace name',
      el('div', 'gf-control', null,
        el('input', `gf-input${loading ? ' gf-input-trailing' : ''}`, { 'aria-describedby': id(context, 'workspace-message'), autocomplete: 'organization', id: id(context, 'workspace'), type: 'text', value: context.content.name, ...stateAttrs(context) }),
        loading ? icon('spinner', 'gf-adornment-end-spin') : null,
      ),
      `${context.content.domain}/${context.content.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      'That name is already taken. Try another.',
    ),
    field(context, 'search', 'Search',
      el('div', 'gf-control', null,
        icon('search', 'gf-icon gf-adornment'),
        el('input', 'gf-input gf-input-leading', { id: id(context, 'search'), placeholder: `Search ${context.content.products.slice(0, 2).join(', ')}…`, type: 'search' }),
      ),
    ),
    field(context, 'email', 'Work email', el('input', 'gf-input', { autocomplete: 'email', id: id(context, 'email'), type: 'email', value: context.content.email })),
  );
}

function textareas(context: TemplateContext): UiElement {
  const text = sentence(context.settings.supportingCopy || context.content.description, 220);
  return field(context, 'summary', 'Project summary',
    el('textarea', 'gf-input gf-textarea', { 'aria-describedby': id(context, 'summary-message'), id: id(context, 'summary'), maxlength: 280, rows: 4, value: text, ...stateAttrs(context) }),
    `${text.length} / 280 characters`,
    'Add a summary before publishing.',
  );
}

function selects(context: TemplateContext): UiElement {
  return el('div', 'gf-stack-lg', null,
    field(context, 'product', 'Product',
      el('div', 'gf-control', null,
        el('select', 'gf-input gf-select', { 'aria-describedby': id(context, 'product-message'), id: id(context, 'product'), value: context.content.products[0], ...stateAttrs(context) },
          ...context.content.products.slice(0, 6).map((product) => el('option', undefined, { value: product }, product)),
        ),
        context.state === 'loading' ? icon('spinner', 'gf-adornment-end-spin') : icon('chevron-down', 'gf-icon gf-adornment-end'),
      ),
      'Choose where this change applies.',
      'Select a product to continue.',
    ),
    field(context, 'role', 'Role',
      el('div', 'gf-control', null,
        el('select', 'gf-input gf-select', { id: id(context, 'role'), value: 'member' },
          el('option', undefined, { value: 'admin' }, 'Administrator'),
          el('option', undefined, { value: 'member' }, 'Member'),
          el('option', undefined, { value: 'viewer' }, 'Viewer'),
        ),
        icon('chevron-down', 'gf-icon gf-adornment-end'),
      ),
    ),
  );
}

function choiceRow(context: TemplateContext, kind: 'checkbox' | 'radio', name: string, index: number, title: string, description: string, checked: boolean, primary: boolean): UiElement {
  const inputId = id(context, `${name}-${index}`);
  const attrs: Attrs = {
    'aria-describedby': `${inputId}-hint`,
    checked,
    id: inputId,
    name: kind === 'radio' ? id(context, name) : undefined,
    type: kind,
    value: title,
    ...(context.live ? { 'data-action': kind === 'radio' ? `select:${name}:${index}` : `set:${name}-${index}:${checked ? 'false' : 'true'}` } : {}),
    ...(primary ? stateAttrs(context, { busy: false }) : {}),
  };
  return el('label', 'gf-choice', { for: inputId, ...(primary && context.state === 'hover' ? { 'data-force': 'hover' } : {}) },
    el('input', 'gf-choice-input', attrs),
    kind === 'checkbox'
      ? el('span', 'gf-checkbox', { 'aria-hidden': 'true' }, icon('check', 'gf-check-mark'))
      : el('span', 'gf-radio', { 'aria-hidden': 'true' }, el('span', 'gf-radio-dot')),
    el('span', 'gf-stack', null,
      el('span', 'gf-label', null, title),
      el('span', 'gf-hint', { id: `${inputId}-hint` }, description),
    ),
  );
}

function checkboxes(context: TemplateContext): UiElement {
  const products = context.content.products.slice(0, 3);
  return el('fieldset', 'gf-fieldset gf-stack', null,
    el('legend', 'gf-heading', null, 'Email updates'),
    ...products.map((product, index) => choiceRow(context, 'checkbox', 'updates', index, `${product} releases`, index === 0 ? 'New features and changes to the API.' : index === 1 ? 'A short summary once a month.' : 'Security notices only.', context.state === 'selected' && index === 0 ? true : toggled(context, `updates-${index}`, index !== 2), index === 0)),
    context.state === 'error' ? el('p', 'gf-error-text', null, 'Choose at least one update to keep.') : null,
  );
}

function radios(context: TemplateContext): UiElement {
  const options = [['Public', `Anyone with the link can view on ${context.content.domain}.`], ['Team', `Members of ${context.content.name} only.`], ['Private', 'Only you and people you invite.']] as const;
  const current = context.state === 'selected' ? 0 : selectedIndex(context, 'visibility', 1);
  return el('fieldset', 'gf-fieldset gf-stack', null,
    el('legend', 'gf-heading', null, 'Visibility'),
    ...options.map(([title, description], index) => choiceRow(context, 'radio', 'visibility', index, title, description, index === current, index === 0)),
    context.state === 'error' ? el('p', 'gf-error-text', null, 'Pick who can see this project.') : null,
  );
}

function switches(context: TemplateContext): UiElement {
  const rows = [[`Sync ${context.content.products[0]}`, 'Keep changes in step across workspaces.'], ['Notify collaborators', 'Email people when you publish.'], ['Publish automatically', 'Ship approved changes without review.']] as const;
  return el('div', 'gf-stack-lg', null,
    ...rows.map(([title, description], index) => {
      const on = context.state === 'selected' && index === 0 ? true : toggled(context, `switch-${index}`, index === 0);
      const switchId = id(context, `switch-${index}`);
      return el('div', 'gf-row-between', null,
        el('span', 'gf-stack', null, el('span', 'gf-label', { id: `${switchId}-label` }, title), el('span', 'gf-hint', null, description)),
        el('button', 'gf-switch', {
          'aria-checked': on ? 'true' : 'false',
          'aria-labelledby': `${switchId}-label`,
          id: switchId,
          role: 'switch',
          type: 'button',
          ...action(context, `set:switch-${index}:${on ? 'false' : 'true'}`),
          ...(index === 0 ? stateAttrs(context, { busy: false }) : {}),
        }, el('span', 'gf-switch-thumb', { 'aria-hidden': 'true' })),
      );
    }),
  );
}

function uploaders(context: TemplateContext): UiElement {
  const inputId = id(context, 'upload');
  const invalid = context.state === 'error';
  return el('div', 'gf-stack', null,
    el('input', 'gf-choice-input', { accept: 'image/*,.svg', id: inputId, type: 'file', ...stateAttrs(context, { busy: false }) }),
    el('label', 'gf-dropzone', { for: inputId, ...(invalid ? { 'aria-invalid': 'true' } : {}), ...(context.state === 'hover' ? { 'data-force': 'hover' } : {}) },
      icon('upload'),
      el('span', 'gf-label', null, `Drop ${context.content.name} assets here`),
      el('span', 'gf-hint', null, invalid ? 'That file is larger than 25 MB.' : 'SVG, PNG or JPG up to 25 MB, or click to choose.'),
    ),
  );
}

// ── Navigation ──────────────────────────────────────────────────────────────

function navigation(context: TemplateContext): UiElement {
  const current = selectedIndex(context, 'nav');
  const links = context.content.products.slice(0, 4);
  return el('header', 'gf-nav', null,
    el('a', 'gf-brand', { href: '#top' }, context.content.name),
    el('nav', 'gf-grow', { 'aria-label': 'Main' },
      el('ul', 'gf-nav-list', null,
        ...links.map((link, index) => el('li', undefined, null, el('a', 'gf-nav-link', {
          'aria-current': index === current ? 'page' : undefined,
          href: `#${link.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          ...action(context, `select:nav:${index}`),
          ...(index === 1 ? stateAttrs(context, { disable: 'aria' }) : {}),
        }, link))),
      ),
    ),
    button('gf-btn-primary', {}, context.settings.label),
  );
}

function sidebars(context: TemplateContext): UiElement {
  const current = selectedIndex(context, 'side');
  const items = context.content.products.slice(0, 4);
  const counts = [12, 3, 28, 0];
  const row = (label: string, index: number) => el('button', 'gf-sidebar-item', {
    'aria-current': index === current ? 'page' : undefined,
    type: 'button',
    ...action(context, `select:side:${index}`),
    ...(index === 1 ? stateAttrs(context, { busy: false, invalid: false }) : {}),
  }, el('span', 'gf-grow gf-truncate', null, label), counts[index] ? el('span', 'gf-count', null, String(counts[index])) : null);
  return el('div', 'gf-row', null,
    el('nav', 'gf-sidebar', { 'aria-label': `${context.content.short} workspace`, 'data-roving': 'true' },
      el('p', 'gf-sidebar-heading', null, 'Products'),
      ...items.slice(0, 3).map((item, index) => row(item, index)),
      el('p', 'gf-sidebar-heading', null, 'Workspace'),
      row(items[3] ?? 'Settings', 3),
    ),
    el('section', 'gf-grow gf-stack', { 'aria-live': 'polite' },
      el('p', 'gf-eyebrow', null, 'Now viewing'),
      el('h3', 'gf-title', null, items[Math.min(current, items.length - 1)] ?? items[0]),
      el('p', 'gf-muted', null, sentence(context.content.positioning, 120)),
    ),
  );
}

function tabs(context: TemplateContext): UiElement {
  const labels = ['Overview', 'Activity', 'Settings'];
  const current = context.state === 'selected' ? 1 : selectedIndex(context, 'tab');
  const panels = [sentence(context.content.positioning, 180), `${context.content.products.slice(0, 3).join(', ')} changed this week.`, `Manage access, billing and notifications for ${context.content.name}.`];
  return el('div', undefined, null,
    el('div', 'gf-tablist', { 'aria-label': `${context.content.short} project`, 'data-roving': 'true', role: 'tablist' },
      ...labels.map((label, index) => el('button', 'gf-tab', {
        'aria-controls': id(context, 'tabpanel'),
        'aria-selected': index === current ? 'true' : 'false',
        id: id(context, `tab-${index}`),
        role: 'tab',
        tabindex: index === current ? 0 : -1,
        type: 'button',
        ...action(context, `select:tab:${index}`),
        ...(index === 0 && context.state !== 'selected' ? stateAttrs(context, { busy: false, invalid: false }) : {}),
      }, label)),
    ),
    el('div', 'gf-tabpanel gf-stack', { 'aria-labelledby': id(context, `tab-${current}`), id: id(context, 'tabpanel'), role: 'tabpanel', tabindex: 0 },
      el('h3', 'gf-heading', null, labels[current]!),
      el('p', 'gf-muted', null, panels[current]!),
    ),
  );
}

function breadcrumbs(context: TemplateContext): UiElement {
  const trail = [context.content.name, context.content.products[0]!, 'Settings'];
  return el('nav', undefined, { 'aria-label': 'Breadcrumb' },
    el('ol', 'gf-breadcrumbs', null,
      ...trail.map((item, index) => el('li', 'gf-crumb', null,
        index === trail.length - 1
          ? el('span', 'gf-crumb-current', { 'aria-current': 'page' }, item)
          : el('a', 'gf-crumb-link', { href: `#${item.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`, ...(index === 0 ? stateAttrs(context) : {}) }, item),
        index < trail.length - 1 ? icon('chevron-right', 'gf-icon gf-tone-muted') : null,
      )),
    ),
  );
}

function pagination(context: TemplateContext): UiElement {
  const page = selectedIndex(context, 'page', 1);
  return el('nav', 'gf-row-between', { 'aria-label': 'Pagination' },
    el('p', 'gf-muted gf-num', null, `Showing ${page * 20 + 1}–${page * 20 + 20} of 248`),
    el('div', 'gf-row', null,
      button('gf-btn-ghost gf-btn-icon', { 'aria-label': 'Previous page', ...(page === 0 ? { disabled: true } : {}), ...action(context, `select:page:${Math.max(0, page - 1)}`) }, icon('chevron-left')),
      ...[0, 1, 2, 3].map((index) => el('button', 'gf-page', {
        'aria-current': index === page ? 'page' : undefined,
        'aria-label': `Page ${index + 1}`,
        type: 'button',
        ...action(context, `select:page:${index}`),
        ...(index === 2 ? stateAttrs(context, { busy: false, invalid: false }) : {}),
      }, String(index + 1))),
      el('span', 'gf-muted', { 'aria-hidden': 'true' }, '…'),
      el('button', 'gf-page', { 'aria-label': 'Page 13', type: 'button' }, '13'),
      button('gf-btn-ghost gf-btn-icon', { 'aria-label': 'Next page', ...action(context, `select:page:${Math.min(3, page + 1)}`) }, icon('chevron-right')),
    ),
  );
}

// ── Overlays ────────────────────────────────────────────────────────────────

function commandMenu(context: TemplateContext): UiElement {
  const commands = [`Open ${context.content.products[0]}`, `Create ${context.content.products[1] ?? 'project'}`, 'Invite a teammate', 'Copy API key'];
  const current = context.state === 'selected' ? 2 : selectedIndex(context, 'command');
  return el('div', 'gf-command', { 'aria-label': 'Command menu', role: 'dialog' },
    el('div', 'gf-command-search', null,
      context.state === 'loading' ? icon('spinner', 'gf-spinner') : icon('search'),
      el('input', 'gf-command-field', { 'aria-controls': id(context, 'commands'), 'aria-label': 'Search commands', placeholder: `Search ${context.content.name}…`, role: 'combobox', type: 'text' }),
      el('kbd', 'gf-kbd', null, 'Esc'),
    ),
    context.state === 'error'
      ? el('div', 'gf-card-body', null, el('p', 'gf-error-text', null, 'Commands could not load. Check your connection and try again.'))
      : el('ul', 'gf-command-list', { id: id(context, 'commands'), role: 'listbox' },
        ...commands.map((command, index) => el('li', undefined, { role: 'presentation' }, el('button', 'gf-menu-item', {
          'aria-selected': index === current ? 'true' : 'false',
          role: 'option',
          type: 'button',
          ...action(context, `select:command:${index}`),
        }, el('span', 'gf-grow', null, command), index === 0 ? el('kbd', 'gf-kbd', null, '↵') : null))),
      ),
  );
}

function dialogs(context: TemplateContext): UiElement {
  const open = toggled(context, 'dialog', true);
  if (!open) return el('div', 'gf-row', null, button('gf-btn-outline', action(context, 'set:dialog:true'), 'Open dialog'));
  const loading = context.state === 'loading';
  return el('div', 'gf-scrim', null,
    el('div', 'gf-dialog', { 'aria-describedby': id(context, 'dialog-body'), 'aria-labelledby': id(context, 'dialog-title'), 'aria-modal': 'true', role: 'dialog' },
      el('div', 'gf-row-between', null,
        el('h3', 'gf-heading', { id: id(context, 'dialog-title') }, `Publish ${context.content.products[0]} changes?`),
        button('gf-btn-ghost gf-btn-icon', { 'aria-label': 'Close dialog', ...action(context, 'set:dialog:false') }, icon('x')),
      ),
      el('p', 'gf-muted', { id: id(context, 'dialog-body') }, sentence(context.settings.supportingCopy || context.content.description, 150)),
      context.state === 'error' ? el('p', 'gf-error-text', { role: 'alert' }, 'Publishing failed. Your changes are saved as a draft.') : null,
      el('div', 'gf-dialog-footer', null,
        button('gf-btn-ghost', action(context, 'set:dialog:false'), 'Cancel'),
        button('gf-btn-primary', loading ? { 'aria-busy': 'true', disabled: true } : {}, loading ? icon('spinner', 'gf-spinner') : null, loading ? 'Publishing…' : context.settings.label),
      ),
    ),
  );
}

function sheets(context: TemplateContext): UiElement {
  const open = toggled(context, 'sheet', true);
  if (!open) return el('div', 'gf-row', null, button('gf-btn-outline', action(context, 'set:sheet:true'), 'Edit details'));
  const loading = context.state === 'loading';
  return el('div', undefined, null,
    el('div', 'gf-sheet-scrim', { 'aria-hidden': 'true' }),
    el('aside', 'gf-sheet', { 'aria-labelledby': id(context, 'sheet-title'), 'aria-modal': 'true', role: 'dialog' },
      el('div', 'gf-sheet-header', null,
        el('div', 'gf-stack', null, el('h3', 'gf-heading', { id: id(context, 'sheet-title') }, `Edit ${context.content.products[0]}`), el('p', 'gf-muted', null, `Changes apply to ${context.content.name}.`)),
        button('gf-btn-ghost gf-btn-icon', { 'aria-label': 'Close panel', ...action(context, 'set:sheet:false') }, icon('x')),
      ),
      el('div', 'gf-sheet-body', null,
        field(context, 'sheet-name', 'Display name', el('input', 'gf-input', { id: id(context, 'sheet-name'), type: 'text', value: context.content.products[0], ...(context.state === 'error' ? { 'aria-invalid': 'true' } : {}) }), undefined, 'A display name is required.'),
        field(context, 'sheet-owner', 'Owner', el('input', 'gf-input', { id: id(context, 'sheet-owner'), type: 'email', value: context.content.email })),
      ),
      el('div', 'gf-sheet-footer', null,
        button('gf-btn-ghost', action(context, 'set:sheet:false'), 'Cancel'),
        button('gf-btn-primary', loading ? { 'aria-busy': 'true', disabled: true } : {}, loading ? icon('spinner', 'gf-spinner') : null, loading ? 'Saving…' : 'Save changes'),
      ),
    ),
  );
}

function popovers(context: TemplateContext): UiElement {
  const open = context.state === 'default' ? toggled(context, 'popover', true) : true;
  return el('div', 'gf-anchor', null,
    button('gf-btn-outline', { 'aria-controls': id(context, 'menu'), 'aria-expanded': open ? 'true' : 'false', 'aria-haspopup': 'menu', ...action(context, `set:popover:${open ? 'false' : 'true'}`), ...stateAttrs(context, { busy: false, invalid: false }) }, icon('sliders'), 'Options'),
    open ? el('div', 'gf-popover', { id: id(context, 'menu'), role: 'menu' },
      el('button', 'gf-menu-item', { role: 'menuitem', type: 'button' }, icon('copy'), 'Duplicate project'),
      el('button', 'gf-menu-item', { role: 'menuitem', type: 'button' }, icon('download'), 'Export assets'),
      el('hr', 'gf-separator', { role: 'separator' }),
      el('button', 'gf-menu-item gf-menu-danger', { role: 'menuitem', type: 'button' }, icon('x'), 'Archive project'),
    ) : null,
  );
}

function tooltips(context: TemplateContext): UiElement {
  const items: [Parameters<typeof icon>[0], string][] = [['copy', 'Copy link'], ['download', 'Download'], ['sliders', 'Adjust']];
  return el('div', 'gf-row', null,
    ...items.map(([name, label], index) => el('span', 'gf-tooltip-anchor', index === 0 && (context.state === 'hover' || context.state === 'focus') ? { 'data-force': context.state } : null,
      button('gf-btn-outline gf-btn-icon', { 'aria-describedby': id(context, `tip-${index}`), 'aria-label': label }, icon(name)),
      el('span', 'gf-tooltip', { id: id(context, `tip-${index}`), role: 'tooltip' }, label),
    )),
  );
}

// ── Feedback ────────────────────────────────────────────────────────────────

function alerts(context: TemplateContext): UiElement {
  const rows: ['info' | 'positive' | 'caution' | 'negative', Parameters<typeof icon>[0], string, string][] = [
    ['info', 'info', `${context.content.products[0]} has a new version`, 'Review the changes before you update your integration.'],
    ['positive', 'check-circle', 'Brand updated', `Every template now uses the latest ${context.content.name} settings.`],
    ['caution', 'alert', 'Usage is at 90%', 'Raise the limit or archive older projects this week.'],
    ['negative', 'alert', 'Export failed', 'The source file could not be read. Upload it again.'],
  ];
  return el('div', 'gf-stack', null,
    ...rows.map(([tone, glyph, title, body]) => el('div', `gf-alert${tone === 'info' ? '' : ` gf-alert-${tone}`}`, { role: tone === 'negative' ? 'alert' : 'status' },
      icon(glyph, `gf-icon${tone === 'info' ? '' : ` gf-tone-${tone}`}`),
      el('div', 'gf-stack', null, el('p', 'gf-label', null, title), el('p', 'gf-muted', null, body)),
    )),
  );
}

function toasts(context: TemplateContext): UiElement {
  const dismissed = toggled(context, 'toast', false);
  if (dismissed && context.live) return el('div', 'gf-row', null, button('gf-btn-outline', action(context, 'set:toast:false'), 'Show toast'));
  const error = context.state === 'error';
  const loading = context.state === 'loading';
  return el('div', 'gf-toast', { 'aria-live': 'polite', role: error ? 'alert' : 'status' },
    loading ? icon('spinner', 'gf-spinner') : icon(error ? 'alert' : 'check-circle', `gf-icon ${error ? 'gf-tone-negative' : 'gf-tone-positive'}`),
    el('div', 'gf-grow gf-stack', null,
      el('p', 'gf-label', null, loading ? 'Exporting assets…' : error ? 'Export failed' : 'Export ready'),
      el('p', 'gf-muted', null, loading ? `Packaging ${context.content.name} files.` : error ? 'Check the file and try again.' : `${context.content.name}-brand-kit.zip is in your downloads.`),
      error || loading ? null : el('div', 'gf-row', null, el('button', 'gf-link', { type: 'button' }, 'Undo')),
    ),
    button('gf-btn-ghost gf-btn-icon', { 'aria-label': 'Dismiss', ...action(context, 'set:toast:true') }, icon('x')),
  );
}

function progress(context: TemplateContext): UiElement {
  const value = context.state === 'error' ? 42 : 68;
  const steps = ['Upload', 'Review', 'Publish'];
  return el('div', 'gf-stack-lg', null,
    el('div', 'gf-stack', null,
      el('div', 'gf-row-between', null, el('span', 'gf-label', { id: id(context, 'progress-label') }, context.state === 'error' ? 'Upload paused' : `Uploading ${context.content.products[0]} assets`), el('span', 'gf-muted gf-num', null, context.state === 'loading' ? 'Preparing…' : `${value}%`)),
      el('div', 'gf-progress', { 'aria-busy': context.state === 'loading' ? 'true' : undefined, 'aria-labelledby': id(context, 'progress-label'), 'aria-valuemax': 100, 'aria-valuemin': 0, 'aria-valuenow': context.state === 'loading' ? undefined : value, role: 'progressbar' },
        { className: `gf-progress-bar${context.state === 'error' ? ' gf-progress-error' : ''}${context.state === 'loading' ? ' gf-progress-busy' : ''}`, style: { width: context.state === 'loading' ? '30%' : `${value}%` }, tag: 'div' },
      ),
      context.state === 'error' ? el('p', 'gf-error-text', null, 'The connection dropped. Resume when you are back online.') : null,
    ),
    el('ol', 'gf-steps', { 'aria-label': 'Publishing steps' },
      ...steps.map((step, index) => el('li', `gf-step${index === 0 ? ' gf-step-done' : ''}`, { 'aria-current': index === 1 ? 'step' : undefined }, `${index + 1}. ${step}`)),
    ),
  );
}

function badges(context: TemplateContext): UiElement {
  return el('div', 'gf-stack-lg', null,
    el('div', 'gf-row', null, badge('neutral', 'Draft'), badge('primary', 'New'), badge('outline', `v${context.content.stats.length + 1}.2`), badge('positive', 'Live'), badge('caution', 'Review'), badge('negative', 'Failed')),
    el('div', 'gf-row', null,
      el('span', 'gf-label', null, context.content.products[0]!), badge('positive', 'Operational'),
      el('span', 'gf-label', null, context.content.products[1] ?? 'API'), badge('caution', 'Degraded'),
    ),
  );
}

function emptyStates(context: TemplateContext): UiElement {
  const loading = context.state === 'loading';
  const error = context.state === 'error';
  return el('div', 'gf-empty', { role: error ? 'alert' : undefined },
    el('span', 'gf-empty-icon', { 'aria-hidden': 'true' }, loading ? icon('spinner', 'gf-spinner') : icon(error ? 'alert' : 'folder')),
    el('h3', 'gf-heading', null, loading ? 'Loading projects…' : error ? 'Projects could not load' : `No ${context.content.products[0]} projects yet`),
    el('p', 'gf-muted', null, loading ? 'This takes a moment the first time.' : error ? 'Check your connection, then try again.' : sentence(context.content.tagline, 90)),
    loading ? null : el('div', 'gf-row', null,
      button('gf-btn-primary', {}, error ? icon('arrow-right') : icon('plus'), error ? 'Try again' : context.settings.label),
      error ? null : button('gf-btn-ghost', {}, 'Import a project'),
    ),
  );
}

// ── Data ────────────────────────────────────────────────────────────────────

function tables(context: TemplateContext): UiElement {
  const statuses: ['positive' | 'caution' | 'neutral', string][] = [['positive', 'Live'], ['caution', 'Review'], ['positive', 'Live'], ['neutral', 'Draft']];
  const rows = context.content.products.slice(0, 4).map((product, index) => ({ product, status: statuses[index]!, updated: ['Today', 'Yesterday', '3 days ago', 'Last week'][index]!, usage: [12840, 3420, 980, 0][index]! }));
  return el('div', 'gf-table-wrap', null,
    el('table', 'gf-table', { 'aria-busy': context.state === 'loading' ? 'true' : undefined },
      el('caption', 'gf-sr-only', null, `${context.content.name} products`),
      el('thead', undefined, null, el('tr', undefined, null, el('th', 'gf-th', { scope: 'col' }, 'Product'), el('th', 'gf-th', { scope: 'col' }, 'Status'), el('th', 'gf-th gf-td-num', { scope: 'col' }, 'Requests'), el('th', 'gf-th', { scope: 'col' }, 'Updated'))),
      el('tbody', undefined, null,
        ...(context.state === 'error'
          ? [el('tr', undefined, null, el('td', 'gf-td', { colspan: 4 }, el('p', 'gf-error-text', null, 'Rows could not load. Refresh to try again.')))]
          : rows.map((row, index) => el('tr', `gf-tr${context.state === 'selected' && index === 1 ? ' gf-tr-selected' : ''}`, index === 0 && context.state === 'hover' ? { 'data-force': 'hover' } : null,
          el('td', 'gf-td', null, context.state === 'loading' ? skeleton('70%') : el('span', 'gf-label', null, row.product)),
          el('td', 'gf-td', null, context.state === 'loading' ? skeleton('48px') : badge(row.status[0], row.status[1])),
          el('td', 'gf-td gf-td-num', null, context.state === 'loading' ? skeleton('56px') : formatNumber(row.usage)),
          el('td', 'gf-td gf-tone-muted', null, context.state === 'loading' ? skeleton('64px') : row.updated)))),
      ),
    ),
  );
}

function stats(context: TemplateContext): UiElement {
  return el('div', 'gf-stats', null,
    ...context.content.stats.slice(0, 3).map((stat) => el('div', 'gf-stat', null,
      context.state === 'loading' ? skeleton('60%') : el('p', 'gf-stat-value', null, stat.value),
      el('p', 'gf-muted', null, sentence(stat.label, 48)),
      context.state === 'error' ? el('p', 'gf-error-text', null, 'Not updated') : null,
    )),
  );
}

function charts(context: TemplateContext): UiElement {
  const heights = [38, 56, 44, 72, 61, 86, 100];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const current = context.state === 'selected' ? 5 : selectedIndex(context, 'bar', 6);
  return el('figure', 'gf-card gf-card-flat', null,
    el('div', 'gf-card-body', null,
      el('div', 'gf-row-between', null,
        el('div', 'gf-stack', null, el('figcaption', 'gf-label', null, `${context.content.products[0]} requests`), el('p', 'gf-hint', null, 'Last seven days')),
        el('p', 'gf-stat-value', null, context.state === 'loading' ? '—' : formatNumber(heights[current]! * 128)),
      ),
      el('div', 'gf-bars', { 'aria-busy': context.state === 'loading' ? 'true' : undefined, 'data-roving': 'true', role: 'group' },
        ...heights.map((height, index) => ({
          attrs: {
            'aria-label': `${days[index]}: ${formatNumber(height * 128)} requests`,
            'aria-pressed': index === current ? 'true' : 'false',
            type: 'button',
            ...action(context, `select:bar:${index}`),
            ...(index === 2 && (context.state === 'hover' || context.state === 'focus') ? { 'data-force': context.state } : {}),
          },
          className: `gf-bar${context.state === 'loading' ? ' gf-skeleton' : ''}`,
          style: { height: `${height}%` },
          tag: 'button',
        } satisfies UiElement)),
      ),
      el('div', 'gf-axis', { 'aria-hidden': 'true' }, ...days.map((day) => el('span', 'gf-axis-label', null, day))),
    ),
  );
}

// ── Commerce, cards, messaging, content ─────────────────────────────────────

function pricing(context: TemplateContext): UiElement {
  return el('article', 'gf-card', null,
    el('div', 'gf-card-body', null,
      el('div', 'gf-row-between', null, el('p', 'gf-eyebrow', null, 'Team'), badge('primary', 'Popular')),
      el('p', 'gf-price', null, context.state === 'loading' ? '—' : '$49', el('span', 'gf-muted', null, ' / month')),
      el('p', 'gf-muted', null, sentence(context.settings.supportingCopy || context.content.description, 110)),
      el('ul', 'gf-list', null, ...context.content.values.slice(0, 3).map((value) => el('li', 'gf-list-item', null, icon('check', 'gf-icon gf-tone-positive'), value))),
      button('gf-btn-primary gf-btn-block', { ...stateAttrs(context, { invalid: false }), ...(context.state === 'loading' ? { disabled: true } : {}) }, context.state === 'loading' ? icon('spinner', 'gf-spinner') : null, context.settings.label),
    ),
  );
}

function checkout(context: TemplateContext): UiElement {
  const items = context.content.products.slice(0, 2);
  const loading = context.state === 'loading';
  return el('div', 'gf-card gf-split', null,
    el('form', 'gf-card-body', { 'aria-label': 'Payment details' },
      el('h3', 'gf-heading', null, 'Payment details'),
      field(context, 'card', 'Card number', el('input', 'gf-input gf-num', { autocomplete: 'cc-number', id: id(context, 'card'), inputmode: 'numeric', type: 'text', value: '4242 4242 4242 4242', ...stateAttrs(context, { busy: false }) }), 'Test card number', 'Your card number is incomplete.'),
      el('div', 'gf-grid-2', null,
        field(context, 'expiry', 'Expiry', el('input', 'gf-input gf-num', { autocomplete: 'cc-exp', id: id(context, 'expiry'), type: 'text', value: '12 / 28' })),
        field(context, 'cvc', 'CVC', el('input', 'gf-input gf-num', { autocomplete: 'cc-csc', id: id(context, 'cvc'), type: 'text', value: '123' })),
      ),
    ),
    el('aside', 'gf-aside', { 'aria-label': 'Order summary' },
      el('p', 'gf-eyebrow', null, 'Due today'),
      el('ul', 'gf-list', null, ...items.map((item, index) => el('li', 'gf-row-between', null, el('span', 'gf-muted', null, item), el('span', 'gf-num', null, index === 0 ? '$39.00' : '$10.00')))),
      el('p', 'gf-price', null, '$49'),
      button('gf-btn-primary gf-btn-block', loading ? { 'aria-busy': 'true', disabled: true } : {}, loading ? icon('spinner', 'gf-spinner') : null, loading ? 'Processing…' : `Pay ${context.content.short}`),
    ),
  );
}

function cards(context: TemplateContext): UiElement {
  const loading = context.state === 'loading';
  return el('div', 'gf-grid-2', null,
    ...context.content.products.slice(0, 2).map((product, index) => el('a', 'gf-card gf-card-interactive', {
      href: `#${product.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      ...(index === 0 && (context.state === 'hover' || context.state === 'focus') ? { 'data-force': context.state } : {}),
    },
    el('div', 'gf-media', { 'aria-hidden': 'true' }, loading ? skeleton('40%') : product),
    el('div', 'gf-card-body', null,
      el('p', 'gf-eyebrow', null, index === 0 ? 'Product' : 'Guide'),
      el('h3', 'gf-heading', null, loading ? skeleton('70%') : index === 0 ? `${product} for ${context.content.audiences[0]}` : `Ship ${product} in a day`),
      el('p', 'gf-muted', null, loading ? skeleton('90%') : sentence(index === 0 ? context.content.positioning : context.content.description, 100)),
    ),
    el('div', 'gf-card-footer', null, el('span', 'gf-hint', null, index === 0 ? context.content.domain : '6 min read'), icon('arrow-right', 'gf-icon gf-tone-muted')),
    )),
  );
}

function testimonials(context: TemplateContext): UiElement {
  const quote = context.content.writeExamples[0] ?? context.content.phrases[0] ?? context.content.tagline;
  const audience = context.content.audiences[0] ?? 'Customer';
  return el('figure', 'gf-card', null,
    el('div', 'gf-card-body', null,
      el('blockquote', 'gf-quote', null, `“${sentence(quote, 160)}”`),
      el('figcaption', 'gf-row', null,
        el('span', 'gf-avatar', { 'aria-hidden': 'true' }, initials(audience)),
        el('span', 'gf-stack', null, el('span', 'gf-label', null, audience), el('span', 'gf-hint', null, `${context.content.name} customer`)),
      ),
    ),
  );
}

function inbox(context: TemplateContext): UiElement {
  const messages = [
    [`${context.content.products[0]} is live`, context.content.tagline],
    ['Your export is ready', `${context.content.name}-brand-kit.zip finished in 12 seconds.`],
    [`${context.content.audiences[0]} feedback`, sentence(context.content.positioning, 90)],
  ] as const;
  const current = context.state === 'selected' ? 1 : selectedIndex(context, 'message');
  return el('div', 'gf-card gf-inbox', null,
    el('nav', 'gf-inbox-list', { 'aria-label': 'Messages', 'data-roving': 'true' },
      ...messages.map(([subject, preview], index) => el('button', 'gf-inbox-item', {
        'aria-current': index === current ? 'true' : undefined,
        type: 'button',
        ...action(context, `select:message:${index}`),
        ...(index === 2 && context.state === 'hover' ? { 'data-force': 'hover' } : {}),
      }, el('span', 'gf-label gf-truncate', null, subject), el('span', 'gf-hint gf-truncate', null, context.state === 'loading' ? '' : preview))),
    ),
    el('article', 'gf-card-body', { 'aria-live': 'polite' },
      el('p', 'gf-eyebrow', null, context.content.handle),
      el('h3', 'gf-heading', null, messages[current]![0]),
      context.state === 'loading' ? el('div', 'gf-stack', null, skeleton('92%'), skeleton('80%'), skeleton('64%')) : el('p', 'gf-prose', null, `${messages[current]![1]} ${sentence(context.content.description, 160)}`),
      el('div', 'gf-row', null, button('gf-btn-primary', {}, 'Reply'), button('gf-btn-ghost', {}, 'Archive')),
    ),
  );
}

function comments(context: TemplateContext): UiElement {
  const thread = [
    [context.content.audiences[0] ?? 'Product', sentence(context.content.phrases[0] ?? context.content.tagline, 120), '2 min ago'],
    [context.content.audiences[1] ?? 'Design', sentence(context.content.positioning, 140), 'Yesterday'],
  ] as const;
  return el('div', 'gf-stack-lg', null,
    ...thread.map(([author, body, time]) => el('article', 'gf-row', null,
      el('span', 'gf-avatar', { 'aria-hidden': 'true' }, initials(author)),
      el('div', 'gf-grow gf-stack', null, el('p', 'gf-row', null, el('span', 'gf-label', null, author), el('span', 'gf-hint', null, time)), el('p', 'gf-prose', null, body)),
    )),
    el('form', 'gf-stack', { 'aria-label': 'Add a comment' },
      el('label', 'gf-label', { for: id(context, 'comment') }, 'Add a comment'),
      el('textarea', 'gf-input gf-textarea', { id: id(context, 'comment'), placeholder: `Reply to ${thread[0][0]}…`, rows: 3, ...stateAttrs(context, { busy: false }) }),
      context.state === 'error' ? el('p', 'gf-error-text', null, 'Write something before posting.') : null,
      el('div', 'gf-row', null, button('gf-btn-primary', context.state === 'loading' ? { 'aria-busy': 'true', disabled: true } : {}, context.state === 'loading' ? icon('spinner', 'gf-spinner') : null, context.state === 'loading' ? 'Posting…' : 'Post comment')),
    ),
  );
}

function articleBody(context: TemplateContext): UiElement {
  return el('article', 'gf-article', null,
    el('p', 'gf-eyebrow', null, `${context.content.name} / Field notes`),
    el('h2', 'gf-title', null, context.settings.label === 'Get started' ? context.content.tagline : context.settings.label),
    el('p', 'gf-lead', null, sentence(context.settings.supportingCopy || context.content.description, 200)),
    el('p', 'gf-prose', null, context.content.positioning),
    el('blockquote', 'gf-blockquote', null, context.content.phrases[0] ?? context.content.tagline),
    el('p', 'gf-prose', null, `${context.content.pillars.slice(0, 3).join(', ')}: ${sentence(context.content.description, 120)}`),
  );
}

function metadata(context: TemplateContext): UiElement {
  const rows: [string, string][] = [
    ['Title', context.settings.label === 'Get started' ? context.content.tagline : context.settings.label],
    ['Description', sentence(context.settings.supportingCopy || context.content.description, 160)],
    ['Author', context.content.name],
    ['Canonical URL', `https://${context.content.domain}/`],
    ['Social', context.content.handle],
  ];
  return el('dl', 'gf-dl', null, ...rows.flatMap(([term, value]) => [el('dt', 'gf-dt', null, term), el('dd', 'gf-dd', null, value)]));
}

export const COMPONENT_TEMPLATES: Readonly<Record<ComponentPatternId, (context: TemplateContext) => UiElement>> = {
  alerts,
  'article-body': articleBody,
  badges,
  breadcrumbs,
  'button-groups': buttonGroups,
  buttons,
  cards,
  charts,
  checkboxes,
  checkout,
  comments,
  'command-menu': commandMenu,
  dialogs,
  'empty-states': emptyStates,
  'icon-buttons': iconButtons,
  inbox,
  inputs,
  metadata,
  navigation,
  pagination,
  popovers,
  pricing,
  progress,
  radios,
  selects,
  sheets,
  sidebars,
  stats,
  tables,
  tabs,
  testimonials,
  textareas,
  toasts,
  toggles: switches,
  tooltips,
  uploaders,
};

/** The root element for one pattern in one state, wrapped in the brand root class. */
export function componentTree(pattern: ComponentPatternId, context: TemplateContext): UiElement {
  const tree = COMPONENT_TEMPLATES[pattern](context);
  return { ...tree, className: `gf-root${tree.className ? ` ${tree.className}` : ''}` };
}
