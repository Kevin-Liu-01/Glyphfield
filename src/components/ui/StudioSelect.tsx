'use client';

import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from '@/components/ui/SolidIcons';

import type { ReactNode } from 'react';

type StudioSelectOption = {
  disabled?: boolean;
  label: ReactNode;
  value: string;
};

type StudioSelectProps = {
  ariaLabel: string;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  leadingIcon?: ReactNode;
  onValueChange?: (value: string) => void;
  options: readonly StudioSelectOption[];
  placeholder?: ReactNode;
  title?: string;
  value?: string;
};

export default function StudioSelect({
  ariaLabel,
  className = '',
  defaultValue,
  disabled = false,
  leadingIcon,
  onValueChange,
  options,
  placeholder = 'Select an option',
  title,
  value,
}: StudioSelectProps) {
  return (
    <Select.Root
      defaultValue={defaultValue}
      disabled={disabled}
      onValueChange={onValueChange}
      value={value}
    >
      <Select.Trigger
        aria-label={ariaLabel}
        className={`group flex h-9 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-md border border-input bg-background px-3 text-left text-xs whitespace-nowrap text-foreground outline-none transition-colors hover:border-foreground/45 focus:border-foreground disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
        data-studio-select='true'
        title={title}
      >
        {leadingIcon ? <span className='inline-flex shrink-0 text-muted-foreground' data-studio-select-leading>{leadingIcon}</span> : null}
        <Select.Value className='block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap' placeholder={placeholder} />
        <Select.Icon asChild>
          <ChevronDown className='size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180' />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className='z-[260] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-background text-foreground smooth-shadow-ring-lg'
          position='popper'
          sideOffset={5}
        >
          <Select.ScrollUpButton className='flex h-7 items-center justify-center border-b border-border bg-background text-muted-foreground'>
            <ChevronUp className='size-3.5' />
          </Select.ScrollUpButton>
          <Select.Viewport className='p-1'>
            {options.map((option) => (
              <Select.Item
                className='relative flex min-h-8 min-w-0 cursor-pointer select-none items-center overflow-hidden rounded-sm py-1.5 pr-8 pl-2.5 text-xs whitespace-nowrap outline-none data-[disabled]:cursor-not-allowed data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-foreground data-[highlighted]:text-background [&_[data-live-material-label]]:w-full'
                data-studio-select-option='true'
                disabled={option.disabled}
                key={option.value}
                value={option.value}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className='absolute right-2 inline-flex items-center'>
                  <Check className='size-3.5' />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className='flex h-7 items-center justify-center border-t border-border bg-background text-muted-foreground'>
            <ChevronDown className='size-3.5' />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
