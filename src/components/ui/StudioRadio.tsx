'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

type StudioRadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

const StudioRadio = forwardRef<HTMLInputElement, StudioRadioProps>(function StudioRadio({
  className = '',
  ...props
}, ref) {
  return (
    <span className={`studio-radio-control ${className}`.trim()}>
      <input {...props} className='studio-choice-native' data-studio-radio='true' ref={ref} type='radio' />
      <span aria-hidden='true' className='studio-radio-indicator'><span /></span>
    </span>
  );
});

export default StudioRadio;
