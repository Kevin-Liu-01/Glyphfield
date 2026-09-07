import { memo } from 'react';

/** A single, static loading treatment—not an approximation of the saved shader. */
function ShaderSkeleton({
  className = '',
  state = 'loading',
}: {
  className?: string;
  state?: 'loading' | 'unavailable';
}) {
  return (
    <span
      aria-hidden='true'
      className={`shader-skeleton ${className}`}
      data-shader-skeleton={state}
    />
  );
}

export default memo(ShaderSkeleton);
