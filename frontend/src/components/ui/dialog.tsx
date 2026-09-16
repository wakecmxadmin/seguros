import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { className?: string }
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy-deep/40 backdrop-blur-[1px] data-[state=open]:animate-fade-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-raised data-[state=open]:animate-slide-up',
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

export function DialogHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <DialogPrimitive.Title className="text-[17px] font-semibold tracking-tight text-foreground">
          {title}
        </DialogPrimitive.Title>
        {description && (
          <DialogPrimitive.Description className="mt-0.5 text-[13.5px] text-muted-foreground">
            {description}
          </DialogPrimitive.Description>
        )}
      </div>
      <DialogPrimitive.Close
        className="grid h-8 w-8 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-surface-alt hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </div>
  );
}

export function DialogBody({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>;
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-alt/50 px-5 py-3.5">
      {children}
    </div>
  );
}
