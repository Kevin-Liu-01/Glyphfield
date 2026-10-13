'use client';

import { useGT } from 'gt-next';
import StudioSelect from '@/components/ui/StudioSelect';
import { SHADER_LAB_KINDS, SHADER_LAB_SOURCES, type ShaderLabKind, type ShaderLabSource } from '@/lib/shaderLab';

/** Source and kind filters shared by every shader library. */
export default function ShaderLibraryFilters({
  className = '',
  compact = false,
  kind,
  onKindChange,
  onSourceChange,
  source,
}: {
  className?: string;
  compact?: boolean;
  kind: ShaderLabKind;
  onKindChange: (kind: ShaderLabKind) => void;
  onSourceChange: (source: ShaderLabSource) => void;
  source: ShaderLabSource;
}) {
  const gt = useGT();
  const size = compact ? 'h-7 text-[10px]' : 'h-8';
  return (
    <div className={`mt-2 grid grid-cols-2 gap-1.5 ${className}`}>
      <StudioSelect
        ariaLabel={gt('Shader source filter')}
        className={size}
        onValueChange={(value) => onSourceChange(SHADER_LAB_SOURCES.find(({ id }) => id === value)?.id ?? 'all')}
        options={SHADER_LAB_SOURCES.map(({ id, label }) => ({ label: gt(label), value: id }))}
        value={source}
      />
      <StudioSelect
        ariaLabel={gt('Shader kind filter')}
        className={size}
        onValueChange={(value) => onKindChange(SHADER_LAB_KINDS.find(({ id }) => id === value)?.id ?? 'all')}
        options={SHADER_LAB_KINDS.map(({ id, label }) => ({ label: gt(label), value: id }))}
        value={kind}
      />
    </div>
  );
}
