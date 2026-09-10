import { forwardRef } from 'react';
import type { Icon, IconProps } from '@phosphor-icons/react';

export function weightedIcon(Source: Icon, displayName: string, defaultWeight: NonNullable<IconProps['weight']>): Icon {
  const WeightedIcon = forwardRef<SVGSVGElement, IconProps>(({ weight = defaultWeight, ...props }, ref) => (
    <Source ref={ref} weight={weight} {...props} />
  ));
  WeightedIcon.displayName = displayName;
  return WeightedIcon;
}
