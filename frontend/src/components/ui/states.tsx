import { ReactNode } from 'react';
import { Loader2, SearchX, AlertTriangle } from 'lucide-react';

export function Loading({ text = 'Carregando…' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-[14px] text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-surface-alt">
        <SearchX className="h-5 w-5 text-muted-foreground" />
      </span>
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[13.5px] text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadError({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-danger/10">
        <AlertTriangle className="h-5 w-5 text-danger" />
      </span>
      <p className="text-[15px] font-medium text-foreground">Não foi possível carregar</p>
      <p className="mt-1 max-w-sm text-[13.5px] text-muted-foreground">
        {message ?? 'Tente novamente em instantes.'}
      </p>
    </div>
  );
}
