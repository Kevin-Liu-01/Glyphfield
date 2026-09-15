import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScratchStudioProject, importStudioProject } from '../studioProjectCreation';
import { saveAutosavedDesign, savedDesignStorageKey } from '../savedDesigns';
import { parseCanvasDocument } from '../canvasDocument';
import { readDesignLabProjectFile } from '../designLabProjectFile';
import { readAnimationProjectFile } from '../animationProjectFile';

vi.mock('../savedDesigns', async (original) => ({
  ...await original<typeof import('../savedDesigns')>(),
  saveAutosavedDesign: vi.fn(async () => {}),
}));

afterEach(() => vi.clearAllMocks());

function savedSource() {
  return vi.mocked(saveAutosavedDesign).mock.calls.at(-1)![1];
}

function file(source: string, name = 'Shared.glyphfield.json') {
  const blob = new Blob([source], { type: 'application/json' });
  return { name, size: blob.size, text: () => blob.text() };
}

describe('Studio project creation', () => {
  it.each(['material', 'animation'] as const)('creates a blank %s through its portable document contract', async (toolId) => {
    const project = await createScratchStudioProject(toolId, 'Untitled');
    const source = savedSource();
    const document = parseCanvasDocument(source);
    const read = toolId === 'material' ? readDesignLabProjectFile : readAnimationProjectFile;
    await expect(read(new Blob([source]))).resolves.toBeTruthy();
    expect(document.elements).toEqual({});
    expect(document.assets).toEqual({});
    expect(document.brandId).toBe(project.identity.id);
    expect(saveAutosavedDesign).toHaveBeenCalledWith(
      savedDesignStorageKey(project.identity.id, toolId === 'material' ? 'logo-shader' : toolId), source, '1'
    );
    if (toolId === 'animation') expect(document.metadata.animation).toMatchObject({ textFrames: '', includeBrandLogo: false });
  });

  it('creates a brand identity without a template workspace', async () => {
    const result = await createScratchStudioProject('identity', 'My brand');
    expect(result).toMatchObject({ toolId: 'identity', identity: { name: 'My brand', builtIn: false, kind: 'custom' } });
    expect(saveAutosavedDesign).not.toHaveBeenCalled();
  });

  it.each(['material', 'animation'] as const)('detects %s files and isolates repeat imports without discarding document data', async (toolId) => {
    const original = await createScratchStudioProject(toolId, 'Original');
    const document = parseCanvasDocument(savedSource());
    document.metadata.future = { preserve: ['unknown', 'fields'] };
    const source = JSON.stringify(document);
    const first = await importStudioProject(file(source));
    const imported = parseCanvasDocument(savedSource());
    const second = await importStudioProject(file(source));
    expect(first.toolId).toBe(toolId);
    expect(first.identity.name).toBe('Shared');
    expect(new Set([original.identity.id, first.identity.id, second.identity.id]).size).toBe(3);
    expect(imported).toEqual(document);
    expect(vi.mocked(saveAutosavedDesign).mock.calls.at(-1)![0]).toBe(
      savedDesignStorageKey(second.identity.id, toolId === 'material' ? 'logo-shader' : toolId)
    );
  });

  it.each(['', 'not json', '{"schemaVersion":99}'])('rejects invalid contents before writing any workspace: %s', async (source) => {
    await expect(importStudioProject(file(source))).rejects.toThrow();
    expect(saveAutosavedDesign).not.toHaveBeenCalled();
  });

  it('checks the size before reading local bytes', async () => {
    const text = vi.fn();
    await expect(importStudioProject({ name: 'Huge.json', size: 129 * 1024 * 1024, text })).rejects.toThrow('128 MB');
    expect(text).not.toHaveBeenCalled();
    expect(saveAutosavedDesign).not.toHaveBeenCalled();
  });

  it('propagates a storage failure instead of announcing a created project', async () => {
    vi.mocked(saveAutosavedDesign).mockRejectedValueOnce(new Error('Storage full'));
    await expect(createScratchStudioProject('material', 'Unsaved')).rejects.toThrow('Storage full');
  });
});
