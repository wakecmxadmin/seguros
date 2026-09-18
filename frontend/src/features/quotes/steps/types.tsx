import type { CalculationResult, QuoteFormValues } from '../useQuoteForm';
import type { SigraDraft } from '../SigraPullPanel';

export interface StepProps {
  values: QuoteFormValues;
  set: <K extends keyof QuoteFormValues>(key: K, value: QuoteFormValues[K]) => void;
  errors: Record<string, string>;
  result: CalculationResult | null;
  /** Rótulos dos registros já vinculados, para exibir nos autocompletes ao editar. */
  initialLabels?: { client?: string | null; partner?: string | null };
  /** `false` só na criação — o botão "Puxar do SIGRA" não aparece ao editar. */
  isEditing?: boolean;
  sigraDraft?: SigraDraft | null;
  onSigraLinked?: (draft: SigraDraft) => void;
}

/** Título de bloco dentro de uma etapa. */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
      {children}
    </p>
  );
}
