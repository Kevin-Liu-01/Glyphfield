import SourceCodeDrawer from '@/components/SourceCodeDrawer';

export function AnimationError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className='border-t border-status-error-border bg-status-error-background px-4 py-3 text-sm text-status-error' role='alert'>
      {error}
    </div>
  );
}

export function AnimationSourceDrawer({
  onApply,
  onClose,
  open,
  source,
  title,
}: {
  onApply: (source: string) => Promise<void>;
  onClose: () => void;
  open: boolean;
  source: string | null;
  title: string;
}) {
  if (!open || source === null) return null;
  return (
    <SourceCodeDrawer
      format='JSON · animation scene'
      onApply={onApply}
      onClose={onClose}
      source={source}
      title={title}
    />
  );
}
