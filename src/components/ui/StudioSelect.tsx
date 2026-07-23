'use client';

import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

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
  onValueChange?: (value: string) => void;
  options: readonly StudioSelectOption[];
  placeholder?: ReactNode;
  value?: string;
};

export default function StudioSelect({
  ariaLabel,
  className = '',
  defaultValue,
  disabled = false,
  onValueChange,
  options,
  placeholder = 'Select an option',
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
        className={`group flex h-9 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-input bg-background px-3 text-left text-sm text-foreground outline-none transition-colors hover:border-foreground/45 focus:border-foreground disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon asChild>
          <ChevronDown className='size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180' />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className='z-[120] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-background text-foreground shadow-[0_18px_50px_rgba(0,0,0,0.18)]'
          position='popper'
          sideOffset={5}
        >
          <Select.ScrollUpButton className='flex h-7 items-center justify-center border-b border-border bg-background text-muted-foreground'>
            <ChevronUp className='size-3.5' />
          </Select.ScrollUpButton>
          <Select.Viewport className='p-1'>
            {options.map((option) => (
              <Select.Item
                className='relative flex min-h-8 cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-foreground data-[highlighted]:text-background'
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

export type { StudioSelectOption };
