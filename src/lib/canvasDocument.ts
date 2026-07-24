export const CANVAS_DOCUMENT_SCHEMA_VERSION = 1;

export type CanvasCapability =
  | 'animation'
  | 'assets'
  | 'comments'
  | 'constraints'
  | 'guides'
  | 'history'
  | 'layers'
  | 'pages'
  | 'speaker-notes'
  | 'text'
  | 'video';

export type CanvasElementKind =
  | 'component'
  | 'frame'
  | 'gradient'
  | 'image'
  | 'line'
  | 'logo'
  | 'shader'
  | 'shape'
  | 'text'
  | 'texture'
  | 'video';

export type CanvasAnchor = 'bottom' | 'center' | 'left' | 'right' | 'scale' | 'stretch' | 'top';

export type CanvasBlendMode =
  | 'color'
  | 'difference'
  | 'multiply'
  | 'normal'
  | 'overlay'
  | 'screen';

export type CanvasBounds = {
  height: number;
  rotation: number;
  width: number;
  x: number;
  y: number;
};

export type CanvasElementStyle = {
  blendMode: CanvasBlendMode;
  borderColor?: string;
  borderWidth: number;
  borderRadius: number;
  opacity: number;
  shadowBlur: number;
  shadowColor?: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
};

export type CanvasElementConstraints = {
  anchors: CanvasAnchor[];
  lockAspectRatio: boolean;
  lockDimensions: boolean;
  lockPosition: boolean;
  lockRotation: boolean;
};

export type CanvasTextStyle = {
  align: 'center' | 'justify' | 'left' | 'right';
  casing: 'lowercase' | 'none' | 'uppercase';
  color: string;
  fontFamily: string;
  fontId: string;
  fontRole?: 'Accent' | 'Body' | 'Code' | 'Display';
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  lineHeight: number;
  maxLines?: number;
  tokenBound: boolean;
};

export type CanvasImageTreatment = {
  blur: number;
  crop: { height: number; width: number; x: number; y: number };
  dither: number;
  focalPoint: { x: number; y: number };
  grain: number;
  halation: number;
  objectFit: 'contain' | 'cover' | 'fill';
  posterize: number;
  saturation: number;
};

export type CanvasElement = {
  assetId?: string;
  bounds: CanvasBounds;
  children: string[];
  constraints: CanvasElementConstraints;
  content?: string;
  hidden: boolean;
  id: string;
  imageTreatment?: CanvasImageTreatment;
  kind: CanvasElementKind;
  locked: boolean;
  name: string;
  style: CanvasElementStyle;
  textStyle?: CanvasTextStyle;
  tokenId?: string;
};

export type CanvasGuide = {
  axis: 'x' | 'y';
  id: string;
  locked: boolean;
  position: number;
};

export type CanvasPage = {
  background: string;
  bleed: number;
  elementIds: string[];
  height: number;
  id: string;
  name: string;
  notes: string;
  safeArea: number;
  width: number;
};

export type CanvasDocument = {
  assetIds: string[];
  brandId: string;
  capabilities: CanvasCapability[];
  createdAt: string;
  elements: Record<string, CanvasElement>;
  fontIds: string[];
  guides: CanvasGuide[];
  id: string;
  pageIds: string[];
  pages: Record<string, CanvasPage>;
  revision: number;
  schemaVersion: number;
  title: string;
  updatedAt: string;
};

export type CanvasDocumentHistory = {
  future: CanvasDocument[];
  past: CanvasDocument[];
  present: CanvasDocument;
};

export type CanvasSavedVersion = {
  author: string;
  createdAt: string;
  document: CanvasDocument;
  id: string;
  name: string;
  note: string;
  revision: number;
};

export type CanvasPreflightIssue = {
  elementId?: string;
  message: string;
  pageId?: string;
  severity: 'error' | 'warning';
  type: 'clipped' | 'missing-asset' | 'missing-font' | 'text-overflow';
};

export type CanvasMutation =
  | { elementIds: string[]; type: 'delete-elements' }
  | { assetId: string; elementId: string; type: 'replace-asset' }
  | { bounds: Partial<CanvasBounds>; elementId: string; type: 'resize-element' }
  | { deltaX: number; deltaY: number; elementIds: string[]; type: 'move-elements' }
  | { elementId: string; locked: boolean; type: 'set-lock' }
  | { elementId: string; index: number; pageId: string; type: 'reorder-element' }
  | { elementId: string; patch: Partial<CanvasElement>; type: 'update-element' };

const DEFAULT_STYLE: CanvasElementStyle = {
  blendMode: 'normal',
  borderRadius: 0,
  borderWidth: 0,
  opacity: 1,
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
};

const DEFAULT_CONSTRAINTS: CanvasElementConstraints = {
  anchors: ['left', 'top'],
  lockAspectRatio: false,
  lockDimensions: false,
  lockPosition: false,
  lockRotation: false,
};

function cloneDocument(document: CanvasDocument): CanvasDocument {
  return structuredClone(document);
}

function updateDocument(document: CanvasDocument, patch: Partial<CanvasDocument>): CanvasDocument {
  return {
    ...document,
    ...patch,
    revision: document.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function createCanvasElement(
  id: string,
  name: string,
  kind: CanvasElementKind,
  bounds: CanvasBounds
): CanvasElement {
  return {
    bounds,
    children: [],
    constraints: { ...DEFAULT_CONSTRAINTS, anchors: [...DEFAULT_CONSTRAINTS.anchors] },
    hidden: false,
    id,
    kind,
    locked: false,
    name,
    style: { ...DEFAULT_STYLE },
  };
}

export function createCanvasDocument(
  id: string,
  brandId: string,
  title: string,
  width: number,
  height: number,
  capabilities: CanvasCapability[]
): CanvasDocument {
  const createdAt = new Date().toISOString();
  const pageId = `${id}-page-1`;
  return {
    assetIds: [],
    brandId,
    capabilities: [...new Set(capabilities)],
    createdAt,
    elements: {},
    fontIds: [],
    guides: [],
    id,
    pageIds: [pageId],
    pages: {
      [pageId]: {
        background: '#FFFFFF',
        bleed: 0,
        elementIds: [],
        height,
        id: pageId,
        name: 'Page 1',
        notes: '',
        safeArea: 0,
        width,
      },
    },
    revision: 1,
    schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION,
    title,
    updatedAt: createdAt,
  };
}

export function insertCanvasElement(
  document: CanvasDocument,
  pageId: string,
  element: CanvasElement,
  index?: number
): CanvasDocument {
  const page = document.pages[pageId];
  if (!page) return document;
  const elementIds = [...page.elementIds];
  elementIds.splice(index ?? elementIds.length, 0, element.id);
  return updateDocument(document, {
    elements: { ...document.elements, [element.id]: element },
    pages: { ...document.pages, [pageId]: { ...page, elementIds } },
  });
}

function mutateElement(
  document: CanvasDocument,
  elementId: string,
  mutate: (element: CanvasElement) => CanvasElement
): CanvasDocument {
  const element = document.elements[elementId];
  if (!element) return document;
  return updateDocument(document, {
    elements: { ...document.elements, [elementId]: mutate(element) },
  });
}

export function applyCanvasMutation(document: CanvasDocument, mutation: CanvasMutation): CanvasDocument {
  if (mutation.type === 'move-elements') {
    const elements = { ...document.elements };
    let changed = false;
    for (const elementId of mutation.elementIds) {
      const element = elements[elementId];
      if (!element || element.locked || element.constraints.lockPosition) continue;
      elements[elementId] = {
        ...element,
        bounds: {
          ...element.bounds,
          x: element.bounds.x + mutation.deltaX,
          y: element.bounds.y + mutation.deltaY,
        },
      };
      changed = true;
    }
    return changed ? updateDocument(document, { elements }) : document;
  }

  if (mutation.type === 'resize-element') {
    return mutateElement(document, mutation.elementId, (element) => {
      if (element.locked || element.constraints.lockDimensions) return element;
      const bounds = { ...element.bounds, ...mutation.bounds };
      if (element.constraints.lockAspectRatio && mutation.bounds.width && !mutation.bounds.height) {
        bounds.height = mutation.bounds.width * (element.bounds.height / element.bounds.width);
      }
      return { ...element, bounds };
    });
  }

  if (mutation.type === 'replace-asset') {
    return mutateElement(document, mutation.elementId, (element) => ({ ...element, assetId: mutation.assetId }));
  }

  if (mutation.type === 'set-lock') {
    return mutateElement(document, mutation.elementId, (element) => ({ ...element, locked: mutation.locked }));
  }

  if (mutation.type === 'update-element') {
    return mutateElement(document, mutation.elementId, (element) => ({
      ...element,
      ...mutation.patch,
      bounds: mutation.patch.bounds ? { ...element.bounds, ...mutation.patch.bounds } : element.bounds,
      constraints: mutation.patch.constraints ? { ...element.constraints, ...mutation.patch.constraints } : element.constraints,
      style: mutation.patch.style ? { ...element.style, ...mutation.patch.style } : element.style,
    }));
  }

  if (mutation.type === 'reorder-element') {
    const page = document.pages[mutation.pageId];
    if (!page || !page.elementIds.includes(mutation.elementId)) return document;
    const elementIds = page.elementIds.filter((id) => id !== mutation.elementId);
    elementIds.splice(Math.max(0, Math.min(mutation.index, elementIds.length)), 0, mutation.elementId);
    return updateDocument(document, {
      pages: { ...document.pages, [mutation.pageId]: { ...page, elementIds } },
    });
  }

  const deleteIds = new Set(mutation.elementIds);
  const elements = Object.fromEntries(
    Object.entries(document.elements).filter(([elementId]) => !deleteIds.has(elementId))
  );
  const pages = Object.fromEntries(
    Object.entries(document.pages).map(([pageId, page]) => [
      pageId,
      { ...page, elementIds: page.elementIds.filter((elementId) => !deleteIds.has(elementId)) },
    ])
  );
  return updateDocument(document, { elements, pages });
}

export function createCanvasHistory(document: CanvasDocument): CanvasDocumentHistory {
  return { future: [], past: [], present: cloneDocument(document) };
}

export function commitCanvasChange(
  history: CanvasDocumentHistory,
  mutation: CanvasMutation | CanvasMutation[]
): CanvasDocumentHistory {
  const mutations = Array.isArray(mutation) ? mutation : [mutation];
  const next = mutations.reduce(applyCanvasMutation, history.present);
  if (next === history.present) return history;
  return {
    future: [],
    past: [...history.past, cloneDocument(history.present)],
    present: next,
  };
}

export function undoCanvasChange(history: CanvasDocumentHistory): CanvasDocumentHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    future: [cloneDocument(history.present), ...history.future],
    past: history.past.slice(0, -1),
    present: cloneDocument(previous),
  };
}

export function redoCanvasChange(history: CanvasDocumentHistory): CanvasDocumentHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    future: history.future.slice(1),
    past: [...history.past, cloneDocument(history.present)],
    present: cloneDocument(next),
  };
}

export function saveCanvasVersion(
  document: CanvasDocument,
  id: string,
  name: string,
  author: string,
  note = ''
): CanvasSavedVersion {
  return {
    author,
    createdAt: new Date().toISOString(),
    document: cloneDocument(document),
    id,
    name,
    note,
    revision: document.revision,
  };
}

export function restoreCanvasVersion(version: CanvasSavedVersion): CanvasDocument {
  return cloneDocument(version.document);
}

export function preflightCanvasDocument(document: CanvasDocument): CanvasPreflightIssue[] {
  const issues: CanvasPreflightIssue[] = [];
  for (const pageId of document.pageIds) {
    const page = document.pages[pageId];
    if (!page) continue;
    for (const elementId of page.elementIds) {
      const element = document.elements[elementId];
      if (!element || element.hidden) continue;
      if (element.assetId && !document.assetIds.includes(element.assetId)) {
        issues.push({ elementId, message: `Missing asset ${element.assetId}`, pageId, severity: 'error', type: 'missing-asset' });
      }
      if (element.textStyle?.fontId && !document.fontIds.includes(element.textStyle.fontId)) {
        issues.push({ elementId, message: `Missing font ${element.textStyle.fontId}`, pageId, severity: 'error', type: 'missing-font' });
      }
      if (
        element.bounds.x < 0 ||
        element.bounds.y < 0 ||
        element.bounds.x + element.bounds.width > page.width ||
        element.bounds.y + element.bounds.height > page.height
      ) {
        issues.push({ elementId, message: `${element.name} extends beyond the page`, pageId, severity: 'warning', type: 'clipped' });
      }
      if (
        element.kind === 'text' &&
        element.textStyle?.maxLines &&
        (element.content?.split('\n').length ?? 0) > element.textStyle.maxLines
      ) {
        issues.push({ elementId, message: `${element.name} exceeds its line limit`, pageId, severity: 'error', type: 'text-overflow' });
      }
    }
  }
  return issues;
}
