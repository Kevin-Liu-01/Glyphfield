'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

import { Check } from '@/components/ui/SolidIcons';

type StudioCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  variant?: 'check' | 'dot' | 'switch';
};

const StudioCheckbox = forwardRef<HTMLInputElement, StudioCheckboxProps>(function StudioCheckbox({
  className = '',
  variant = 'check',
  ...props
}, ref) {
  return (
    <span className={`studio-checkbox-control ${className}`.trim()} data-variant={variant}>
      <input {...props} className='studio-choice-native' data-studio-checkbox='true' ref={ref} type='checkbox' />
      <span aria-hidden='true' className='studio-checkbox-indicator'>
        {variant === 'check' ? <Check /> : <span className='studio-checkbox-glyph' />}
      </span>
    </span>
  );
});

export default StudioCheckbox;
