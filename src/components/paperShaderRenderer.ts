import type { ShaderComponentProps } from '@paper-design/shaders-react';
import type { ComponentType } from 'react';

export type PaperShaderRenderer = {
  component: ComponentType<ShaderComponentProps & Record<string, unknown>>;
  presets: readonly { name: string; params: Record<string, unknown> }[];
};

export function paperShaderRenderer(component: unknown, presets: readonly unknown[]): PaperShaderRenderer {
  return {
    component: component as PaperShaderRenderer['component'],
    presets: presets as PaperShaderRenderer['presets'],
  };
}
