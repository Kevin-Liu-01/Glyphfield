import type { StudioToolId } from './studioCatalog';
import { downloadBlob } from './download';

export type StudioAutomationControl = {
  kind: 'button' | 'checkbox' | 'input' | 'select' | 'textarea' | 'textbox';
  label: string;
  value?: boolean | string;
};

export type StudioAutomationValue = boolean | File | number | readonly File[] | string;

export type StudioAutomationArtifact = {
  blob: Blob;
  fileName: string;
};

export type StudioAutomationAdapter = {
  actions?: readonly string[];
  applySource?: (source: string) => void | Promise<void>;
  getSource?: () => string;
  invoke?: (action: string, input?: unknown) => unknown | Promise<unknown>;
  toolId: StudioToolId;
};

export type GlyphfieldStudioAutomation = {
  activate: (label: string) => void;
  activeTool: () => StudioToolId;
  applySource: (source: string | object) => Promise<void>;
  controls: () => StudioAutomationControl[];
  describe: () => {
    actions: readonly string[];
    source: { apply: boolean; read: boolean };
    toolId: StudioToolId;
    version: 1;
  };
  download: (artifact: StudioAutomationArtifact) => void;
  invoke: (action: string, input?: unknown) => Promise<unknown>;
  readSource: () => string;
  set: (label: string, value: StudioAutomationValue) => void;
  version: 1;
};

declare global {
  interface Window {
    glyphfield?: {
      studio: GlyphfieldStudioAutomation;
    };
  }
}

function normalizedLabel(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function controlLabel(element: HTMLElement): string {
  const explicit = element.getAttribute('aria-label')
    ?? element.getAttribute('title')
    ?? element.getAttribute('name');
  if (explicit) return explicit.trim();
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
    if (label) return label;
  }
  const wrappingLabel = element.closest('label');
  return (wrappingLabel?.textContent ?? element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function interactiveControls(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(
    'button, input, textarea, select, [role="button"], [role="textbox"]'
  )).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
}

function matchingControl(label: string): HTMLElement {
  const requested = normalizedLabel(label);
  const match = interactiveControls().find((element) => normalizedLabel(controlLabel(element)) === requested);
  if (!match) throw new RangeError(`No active Studio control is labelled “${label}”.`);
  return match;
}

function setNativeValue(element: HTMLElement, value: StudioAutomationValue) {
  if (element instanceof HTMLInputElement && element.type === 'file') {
    const files = value instanceof File ? [value] : Array.isArray(value) && value.every((item) => item instanceof File) ? value : null;
    if (!files) throw new TypeError('File inputs require a File or File array.');
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    element.files = transfer.files;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (element instanceof HTMLInputElement && element.type === 'checkbox') {
    if (typeof value !== 'boolean') throw new TypeError('Checkbox values must be Boolean.');
    if (element.checked !== value) element.click();
    return;
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    element.value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (element.getAttribute('role') === 'textbox' || element.isContentEditable) {
    element.textContent = String(value);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: String(value), inputType: 'insertText' }));
    return;
  }
  throw new TypeError(`The “${controlLabel(element)}” control does not accept a direct value.`);
}

function controls(): StudioAutomationControl[] {
  return interactiveControls().flatMap((element): StudioAutomationControl[] => {
    const label = controlLabel(element);
    if (!label) return [];
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      return [{ kind: 'checkbox', label, value: element.checked }];
    }
    if (element instanceof HTMLInputElement) return [{ kind: 'input', label, value: element.value }];
    if (element instanceof HTMLTextAreaElement) return [{ kind: 'textarea', label, value: element.value }];
    if (element instanceof HTMLSelectElement) return [{ kind: 'select', label, value: element.value }];
    if (element.getAttribute('role') === 'textbox' || element.isContentEditable) {
      return [{ kind: 'textbox', label, value: element.textContent ?? '' }];
    }
    return [{ kind: 'button', label }];
  });
}

function waitForStudioCommit(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function studioArtifact(input: unknown): StudioAutomationArtifact {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('An export artifact with blob and fileName is required.');
  }
  const { blob, fileName } = input as { blob?: unknown; fileName?: unknown };
  if (!(blob instanceof Blob) || typeof fileName !== 'string' || !fileName.trim()) {
    throw new TypeError('An export artifact requires a Blob and non-empty fileName.');
  }
  return { blob, fileName };
}

export function downloadStudioArtifact(artifact: StudioAutomationArtifact): void {
  const validated = studioArtifact(artifact);
  downloadBlob(validated.blob, validated.fileName);
}

export function registerStudioAutomation(adapter: StudioAutomationAdapter): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const previousGlyphfield = window.glyphfield;
  const studio: GlyphfieldStudioAutomation = {
    activate(label) {
      matchingControl(label).click();
    },
    activeTool: () => adapter.toolId,
    async applySource(source) {
      if (!adapter.applySource) throw new TypeError(`The active ${adapter.toolId} tool does not expose source application.`);
      await adapter.applySource(typeof source === 'string' ? source : JSON.stringify(source, null, 2));
      await waitForStudioCommit();
    },
    controls,
    describe: () => ({
      actions: adapter.actions ?? [],
      source: { apply: Boolean(adapter.applySource), read: Boolean(adapter.getSource) },
      toolId: adapter.toolId,
      version: 1,
    }),
    download: downloadStudioArtifact,
    async invoke(action, input) {
      if (action === 'source.read') return studio.readSource();
      if (action === 'source.apply') {
        if (typeof input !== 'string' && (!input || typeof input !== 'object')) {
          throw new TypeError('source.apply requires a JSON string or object.');
        }
        await studio.applySource(input);
        return adapter.getSource ? studio.readSource() : null;
      }
      if (action === 'controls.list') return studio.controls();
      if (action === 'control.activate') {
        if (typeof input !== 'string') throw new TypeError('control.activate requires an accessible control label.');
        studio.activate(input);
        return null;
      }
      if (action === 'control.set') {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
          throw new TypeError('control.set requires { label, value }.');
        }
        const { label, value } = input as { label?: unknown; value?: unknown };
        const validValue = ['boolean', 'number', 'string'].includes(typeof value)
          || value instanceof File
          || (Array.isArray(value) && value.every((item) => item instanceof File));
        if (typeof label !== 'string' || !validValue) {
          throw new TypeError('control.set requires a string label and a supported control value.');
        }
        studio.set(label, value as StudioAutomationValue);
        return null;
      }
      if (action === 'artifact.download') {
        const artifact = studioArtifact(input);
        studio.download(artifact);
        return { fileName: artifact.fileName };
      }
      if (adapter.invoke) return adapter.invoke(action, input);
      throw new RangeError(`The active ${adapter.toolId} tool does not expose the “${action}” action.`);
    },
    readSource() {
      if (!adapter.getSource) throw new TypeError(`The active ${adapter.toolId} tool does not expose source reading.`);
      return adapter.getSource();
    },
    set(label, value) {
      setNativeValue(matchingControl(label), value);
    },
    version: 1,
  };
  const glyphfield = { ...window.glyphfield, studio };
  window.glyphfield = glyphfield;
  window.dispatchEvent(new CustomEvent('glyphfield:studio-api-ready', { detail: studio.describe() }));
  return () => {
    if (window.glyphfield?.studio !== studio) return;
    if (previousGlyphfield) window.glyphfield = previousGlyphfield;
    else delete window.glyphfield;
  };
}
