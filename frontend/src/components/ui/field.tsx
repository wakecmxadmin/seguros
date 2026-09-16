import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Envelope padrão de campo de formulário: rótulo, controle, dica e erro. */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('w-full', className)}>
      <label htmlFor={htmlFor} className="field-label">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p className="field-error">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
