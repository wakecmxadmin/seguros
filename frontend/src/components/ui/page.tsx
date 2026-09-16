import { ReactNode } from 'react';

interface PageProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Cabeçalho padrão das telas internas. */
export function Page({ title, description, actions, children }: PageProps) {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 text-[14px] text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
