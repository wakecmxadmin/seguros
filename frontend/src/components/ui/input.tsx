import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-md border bg-surface px-3 text-base text-foreground shadow-sm transition-colors',
        'placeholder:text-muted-foreground/70',
        'focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
        invalid ? 'border-danger focus:border-danger focus:ring-danger/30' : 'border-border-strong',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
