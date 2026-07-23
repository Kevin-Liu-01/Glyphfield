'use client';

import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

type ButtonVariant =
  | 'default'
  | 'rainbow'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'destructive';

type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm';

type ButtonProps = ComponentProps<'button'> & {
  asChild?: boolean;
  loading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const baseClassName =
  "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,opacity,transform] outline-none select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const variantClassNames: Record<ButtonVariant, string> = {
  default:
    'border-primary bg-primary text-primary-foreground hover:border-primary/80 hover:bg-primary/80',
  destructive:
    'border-transparent bg-status-error-background text-status-error hover:bg-status-error/20',
  ghost:
    'border-transparent hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground',
  outline:
    'border-border bg-background hover:bg-accent hover:text-accent-foreground aria-expanded:bg-muted',
  rainbow:
    'border-primary bg-primary text-primary-foreground hover:border-primary/80 hover:bg-primary/80',
  secondary:
    'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
};

const sizeClassNames: Record<ButtonSize, string> = {
  default: 'h-9 gap-1.5 px-2.5',
  icon: 'size-9',
  'icon-sm': 'size-8',
  'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
  lg: 'h-10 gap-1.5 px-4',
  sm: 'h-8 gap-1 px-2.5',
};

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function LoadingContent({ children }: { children: ReactNode }) {
  return (
    <>
      <span className='invisible contents'>{children}</span>
      <Loader2
        aria-hidden='true'
        className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin'
      />
    </>
  );
}

export function Button({
  asChild = false,
  children,
  className,
  disabled,
  loading = false,
  size = 'default',
  variant = 'default',
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  const showLoading = loading && !asChild;
  const button = (
    <Component
      aria-busy={loading || undefined}
      className={joinClassNames(
        baseClassName,
        variantClassNames[variant],
        sizeClassNames[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {showLoading ? <LoadingContent>{children}</LoadingContent> : children}
    </Component>
  );

  if (variant !== 'rainbow') return button;

  return (
    <span className={joinClassNames('group relative inline-flex', className?.includes('w-full') && 'w-full')}>
      {disabled || loading ? null : (
        <span className='absolute -inset-0.5 rounded-md bg-gradient-to-r from-pink-600 via-blue-600 via-purple-600 to-green-600 opacity-60 blur-sm transition-opacity group-hover:opacity-90' />
      )}
      {button}
    </span>
  );
}
