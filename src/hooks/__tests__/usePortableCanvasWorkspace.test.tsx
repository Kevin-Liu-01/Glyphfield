// @vitest-environment happy-dom

import { act, useEffect, useMemo } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  loadAutosavedDesign: vi.fn(),
  saveAutosavedDesign: vi.fn(),
  writeAutosaveRecovery: vi.fn(),
}));

vi.mock('@/lib/savedDesigns', () => storage);

import {
  usePortableCanvasWorkspace,
  type PortableCanvasWorkspace,
} from '@/hooks/usePortableCanvasWorkspace';
import { parseCanvasDocument } from '@/lib/canvasDocument';
import { createStudioCanvasDocument } from '@/lib/studioCanvasDocument';

const embeddedPng = 'data:image/png;base64,aGVsbG8=';

function workspaceDocument(revision = 7) {
  return createStudioCanvasDocument({
    background: '#111216',
    brandId: 'gt',
    createdAt: '2026-09-01T00:00:00.000Z',
    height: 540,
    id: 'gt:workspace:test',
    layers: [{
      asset: { name: 'Placed image', source: embeddedPng },
      bounds: { height: 160, rotation: 0, width: 240, x: 80, y: 90 },
      id: 'placed-image',
      kind: 'image',
      name: 'Placed image',
    }],
    revision,
    state: { layerOrder: ['placed-image'] },
    title: 'Workspace test',
    toolId: 'test-tool',
    updatedAt: '2026-09-01T00:00:00.000Z',
    width: 960,
  });
}

function WorkspaceHarness({
  applySource,
  onWorkspace,
  suspendAutosave = false,
}: {
  applySource: (source: string) => void;
  onWorkspace: (workspace: PortableCanvasWorkspace) => void;
  suspendAutosave?: boolean;
}) {
  const document = useMemo(() => workspaceDocument(), []);
  const workspace = usePortableCanvasWorkspace({
    applySource,
    document,
    suspendAutosave,
    workspaceKey: 'gt:test-tool',
  });
  useEffect(() => {
    onWorkspace(workspace);
  }, [onWorkspace, workspace]);
  return <output>{workspace.autosaveState}</output>;
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('usePortableCanvasWorkspace', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    storage.loadAutosavedDesign.mockReset().mockResolvedValue(null);
    storage.saveAutosavedDesign.mockReset().mockResolvedValue(undefined);
    storage.writeAutosaveRecovery.mockReset().mockReturnValue(true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (container.isConnected) {
      await act(async () => {
        root.unmount();
        await settle();
      });
    }
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('invariant_autosave_persists_the_exact_portable_document_source', async () => {
    const workspaces: PortableCanvasWorkspace[] = [];
    await act(async () => {
      root.render(
        <WorkspaceHarness
          applySource={vi.fn()}
          onWorkspace={(workspace) => workspaces.push(workspace)}
        />
      );
      await settle();
    });

    await act(async () => {
      vi.advanceTimersByTime(180);
      await settle();
    });

    const source = workspaces.at(-1)?.source;
    expect(source).toBeTruthy();
    expect(storage.saveAutosavedDesign).toHaveBeenLastCalledWith(
      'gt:test-tool',
      source,
      '7',
      expect.any(String)
    );
    expect(parseCanvasDocument(source!).assets['resource:placed-image']?.source).toBe(embeddedPng);
  });

  it('invariant_hydration_applies_the_saved_portable_source_before_new_writes', async () => {
    const storedSource = JSON.stringify(workspaceDocument(4));
    const applySource = vi.fn();
    storage.loadAutosavedDesign.mockResolvedValue({ revision: '4', source: storedSource });

    await act(async () => {
      root.render(<WorkspaceHarness applySource={applySource} onWorkspace={() => undefined} />);
      await settle();
    });

    expect(applySource).toHaveBeenCalledWith(storedSource);
    expect(storage.saveAutosavedDesign).not.toHaveBeenCalled();
  });

  it('keeps stale document snapshots out of autosave while live edits are settling', async () => {
    const workspaces: PortableCanvasWorkspace[] = [];
    await act(async () => {
      root.render(
        <WorkspaceHarness
          applySource={vi.fn()}
          onWorkspace={(workspace) => workspaces.push(workspace)}
          suspendAutosave
        />
      );
      await settle();
      vi.advanceTimersByTime(1_000);
      await settle();
    });

    expect(storage.saveAutosavedDesign).not.toHaveBeenCalled();
    expect(workspaces.at(-1)?.autosaveState).toBe('preparing');
  });
});
