import { createBrandIdentity, type BrandIdentity } from './brandIdentity';
import { parseCanvasDocument, serializeCanvasDocument, type CanvasDocument } from './canvasDocument';
import { createDesignLabCanvasDocument } from './designLabDocument';
import { createAnimationCanvasDocument } from './animationDocument';
import { readDesignLabProjectFile } from './designLabProjectFile';
import { readAnimationProjectFile } from './animationProjectFile';
import { STUDIO_PROJECT_FILE_MAX_BYTES } from './projectFile';
import { savedDesignStorageKey, saveAutosavedDesign } from './savedDesigns';
import { DEFAULT_SHADER_SEQUENCE_SETTINGS } from './shaderSequence';
import { createDefaultFrameSettings, DEFAULT_SETTINGS } from './studio';

export type ProjectCreationTool = 'identity' | 'material' | 'animation';
export type CreatedStudioProject = { identity: BrandIdentity; toolId: ProjectCreationTool };

// Seed the same autosave that editors hydrate before mounting the new project.
// No active workspace is replaced, and a failed write never creates a tab.
async function saveInitialDocument(identity: BrandIdentity, toolId: 'material' | 'animation', document: CanvasDocument) {
  const scope = toolId === 'material' ? 'logo-shader' : toolId;
  await saveAutosavedDesign(
    savedDesignStorageKey(identity.id, scope),
    serializeCanvasDocument(document),
    String(document.revision)
  );
}

export async function createScratchStudioProject(toolId: ProjectCreationTool, name: string): Promise<CreatedStudioProject> {
  const identity = createBrandIdentity(name);
  if (toolId === 'identity') return { identity, toolId };
  const now = new Date().toISOString();
  const common = { brandId: identity.id, createdAt: now, id: `${identity.id}:${toolId}:scene`, revision: 1, title: name, updatedAt: now };
  const document = toolId === 'material'
    ? createDesignLabCanvasDocument({
      ...common, width: 1200, height: 800, ratio: 'wide', backgroundColor: '#FFFFFF',
      assets: [], effectLayers: [], groups: [], layerOrder: [], layerShaders: {}, logos: [], shaderLayers: [], textLayers: [],
      exportSettings: {}, shaderSequence: { ...DEFAULT_SHADER_SEQUENCE_SETTINGS, targetLayerId: null },
      timeline: { frame: 0, paused: true, timeMs: 0 },
    })
    : createAnimationCanvasDocument({
      ...common, sources: [], state: {
        backgroundOverrides: {}, frameSettings: {}, includeBrandLogo: false, mode: 'sequence', playbackRate: 1,
        sequenceBackground: createDefaultFrameSettings(DEFAULT_SETTINGS).background,
        sequenceOrder: [], settings: DEFAULT_SETTINGS, textFrames: '',
      },
    });
  await saveInitialDocument(identity, toolId, document);
  return { identity, toolId };
}

export async function importStudioProject(file: Pick<File, 'name' | 'size' | 'text'>): Promise<CreatedStudioProject> {
  if (!file.size) throw new TypeError('The project file is empty.');
  if (file.size > STUDIO_PROJECT_FILE_MAX_BYTES) throw new TypeError('Project files must be 128 MB or smaller.');
  const bytes = new Blob([await file.text()], { type: 'application/json' });
  if (bytes.size > STUDIO_PROJECT_FILE_MAX_BYTES) throw new TypeError('Project files must be 128 MB or smaller.');
  const envelope = parseCanvasDocument(await bytes.text());
  const toolId = envelope.metadata.tool === 'design-lab' ? 'material'
    : envelope.metadata.tool === 'animation-studio' ? 'animation' : null;
  if (!toolId) throw new TypeError('Choose a Glyphfield Design Lab or Animation project file.');
  const source = await (toolId === 'material' ? readDesignLabProjectFile(bytes) : readAnimationProjectFile(bytes));
  const document = parseCanvasDocument(source);
  const name = file.name.replace(/(?:\.glyphfield)?\.json$/i, '').trim() || document.title || 'Imported project';
  const identity = createBrandIdentity(name);
  // Keep the file's brand ID paired with its embedded font identity. The host
  // validates that pair, then namespaces it to this new workspace on hydration.
  await saveInitialDocument(identity, toolId, document);
  return { identity, toolId };
}
