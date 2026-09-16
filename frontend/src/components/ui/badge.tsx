import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5',
  {
    variants: {
      variant: {
        neutral: 'bg-muted text-muted-foreground',
        quote: 'bg-quote/12 text-quote',
        provisional: 'bg-provisional/12 text-provisional',
        final: 'bg-final/12 text-final',
        success: 'bg-success/12 text-success',
        warning: 'bg-warning/15 text-warning',
        danger: 'bg-danger/12 text-danger',
        info: 'bg-navy/10 text-navy',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Ponto colorido à esquerda — usado nos status de processo. */
  dot?: boolean;
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
