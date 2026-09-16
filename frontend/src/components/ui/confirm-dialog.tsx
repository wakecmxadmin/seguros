import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirmar',
  destructive,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <div className="flex gap-3.5 px-5 py-5">
          <span
            className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${
              destructive ? 'bg-danger/12' : 'bg-warning/12'
            }`}
          >
            <AlertTriangle
              className={`h-[18px] w-[18px] ${destructive ? 'text-danger' : 'text-warning'}`}
            />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
