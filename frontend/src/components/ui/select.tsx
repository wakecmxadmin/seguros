import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/** Select nativo estilizado — suficiente para listas curtas e fixas. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded-md border bg-surface px-3 pr-9 text-base text-foreground shadow-sm transition-colors',
          'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
          invalid ? 'border-danger focus:border-danger focus:ring-danger/30' : 'border-border-strong',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
);
Select.displayName = 'Select';
