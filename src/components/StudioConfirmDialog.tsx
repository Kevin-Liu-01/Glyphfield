'use client';

import { useId, useRef, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { useExitGhost } from '@/hooks/useExitGhost';
import { useMountEffect } from '@/hooks/useMountEffect';

type StudioConfirmDialogProps = {
  cancelLabel: string;
  confirmLabel: string;
  description: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
};

/**
 * Modal confirmation for a destructive action, on the native dialog like the
 * Studio search. Mount it only while it is open. Focus starts on Cancel;
 * Escape and the backdrop cancel; focus returns to where it was.
 */
export default function StudioConfirmDialog({
  cancelLabel,
  confirmLabel,
  description,
  onCancel,
  onConfirm,
  title,
}: StudioConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useExitGhost(dialogRef, true);

  useMountEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  });

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal='true'
      className='studio-command-overlay studio-confirm-overlay'
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialogRef}
      role='alertdialog'
    >
      <button aria-label={cancelLabel} className='studio-modal-backdrop' onClick={onCancel} tabIndex={-1} type='button' />
      <section className='studio-confirm-dialog'>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className='studio-confirm-actions'>
          <Button onClick={onCancel} ref={cancelRef} size='sm' type='button' variant='outline'>{cancelLabel}</Button>
          <Button onClick={onConfirm} size='sm' type='button' variant='destructive'>{confirmLabel}</Button>
        </div>
      </section>
    </dialog>
  );
}
