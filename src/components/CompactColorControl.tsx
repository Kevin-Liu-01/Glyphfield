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
    <label className='design-lab-color'>
      <input aria-label={label} onChange={(event) => onChange(event.target.value.toUpperCase())} type='color' value={value} />
      <span>{label}</span>
      <code>{value}</code>
    </label>
  );
}
