import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Design Lab is split into its host editor and focused modules. Source
// contracts read them together, so moving code between modules is not a
// behavior change. The host stays first for ordered slices of its functions.
export const DESIGN_LAB_SOURCE_FILES = [
  'src/components/ShaderLabStudio.tsx',
  'src/components/DesignLabCanvasContent.tsx',
  'src/components/DesignLabChrome.tsx',
  'src/components/DesignLabInspector.tsx',
  'src/components/DesignLabLayerDock.tsx',
  'src/components/DesignLabStage.tsx',
  'src/lib/designLabModel.ts',
] as const;

export function readDesignLabSource(): string {
  return DESIGN_LAB_SOURCE_FILES.map((path) => readFileSync(join(process.cwd(), path), 'utf8')).join('\n');
}
