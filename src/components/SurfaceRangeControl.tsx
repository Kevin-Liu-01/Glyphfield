import StudioRangeLabel from '@/components/StudioRangeLabel';
import StudioRange from '@/components/ui/StudioRange';

export default function SurfaceRangeControl({
  disabled = false,
  label,
  max,
  min,
  onChange,
  step = 1,
  suffix = '%',
  value,
}: {
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  value: number;
}) {
  return (
    <label className='design-lab-range' data-disabled={disabled ? 'true' : 'false'}>
      <StudioRangeLabel label={label} value={<output>{Math.round(value * 100) / 100}{suffix}</output>} />
      <StudioRange aria-label={label} disabled={disabled} max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} value={value} />
    </label>
  );
}
