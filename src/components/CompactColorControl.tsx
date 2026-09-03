import ColorControl from '@/components/ui/ColorControl';

export default function CompactColorControl({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <ColorControl ariaLabel={`${label} color`} compact label={label} onChange={onChange} value={value} />
  );
}
