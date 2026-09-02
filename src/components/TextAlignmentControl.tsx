import { AlignCenter, AlignLeft, AlignRight } from '@/components/ui/SolidIcons';

type TextAlignment = 'center' | 'left' | 'right';

const TEXT_ALIGNMENT_OPTIONS = [
  { Icon: AlignLeft, label: 'Left', value: 'left' as const },
  { Icon: AlignCenter, label: 'Center', value: 'center' as const },
  { Icon: AlignRight, label: 'Right', value: 'right' as const },
] as const;

export default function TextAlignmentControl({
  ariaLabel,
  onChange,
  value,
}: {
  ariaLabel: string;
  onChange: (value: TextAlignment) => void;
  value: TextAlignment;
}) {
  return (
    <div className='design-lab-segmented-field'>
      <span><AlignLeft aria-hidden='true' />Alignment</span>
      <div aria-label={ariaLabel} role='group'>
        {TEXT_ALIGNMENT_OPTIONS.map(({ Icon, label, value: optionValue }) => (
          <button
            aria-label={label}
            aria-pressed={value === optionValue}
            key={optionValue}
            onClick={() => onChange(optionValue)}
            title={label}
            type='button'
          ><Icon aria-hidden='true' /><span>{label}</span></button>
        ))}
      </div>
    </div>
  );
}
