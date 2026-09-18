import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { api, errorMessage } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';
import type { QuoteFormValues } from './useQuoteForm';

interface SigraDraft {
  sigraId: string;
  suggestion: {
    modal: 'AIR' | null;
    weightKg: number | null;
    ncm: string | null;
    invoiceNumber: string | null;
    commodityDescription: string | null;
    cost: number | null;
    freight: number | null;
    taxes: number | null;
    originCountryId: string | null;
    originPortId: string | null;
  };
  reference: {
    docCarga: string | null;
    ceMercante: string | null;
    dtEmbarque: string | null;
    dtPresencaCarga: string | null;
    exchangeRate: number | null;
    localEmbarque: string | null;
    exporterName: string | null;
  };
}

/** Aplica as sugestões nos campos do formulário — o operador ainda revisa tudo antes de salvar. */
function applyDraft(set: <K extends keyof QuoteFormValues>(key: K, value: QuoteFormValues[K]) => void, draft: SigraDraft) {
  const s = draft.suggestion;
  if (s.weightKg !== null) set('weightKg', formatMoney(s.weightKg));
  if (s.ncm) set('ncm', s.ncm);
  if (s.invoiceNumber) set('invoiceNumber', s.invoiceNumber);
  if (s.commodityDescription) set('commodityDescription', s.commodityDescription);
  if (s.modal) set('modal', s.modal);
  if (s.cost !== null) set('cost', formatMoney(s.cost));
  if (s.freight !== null) set('freight', formatMoney(s.freight));
  if (s.taxes !== null) set('taxes', formatMoney(s.taxes));
  if (s.originCountryId) set('originCountryId', s.originCountryId);
  if (s.originPortId) set('originPortId', s.originPortId);
}

interface SigraPullPanelProps {
  linked: SigraDraft | null;
  set: <K extends keyof QuoteFormValues>(key: K, value: QuoteFormValues[K]) => void;
  onLinked: (draft: SigraDraft) => void;
}

/**
 * Busca um processo do SIGRA e pré-preenche o formulário (peso, NCM, invoice,
 * valores). Nada é gravado até o operador clicar em "Criar cotação" — a
 * referência (tarefa 30) só é criada junto com a cotação.
 */
export function SigraPullPanel({ linked, set, onLinked }: SigraPullPanelProps) {
  const [input, setInput] = useState('');

  const pull = useMutation({
    mutationFn: async () => {
      const { data } = await api.get<SigraDraft>(`/quotes/sigra-draft/${input.trim()}`);
      return data;
    },
    onSuccess: (data) => {
      applyDraft(set, data);
      onLinked(data);
      toast.success(`Processo ${data.sigraId} encontrado — confira os campos preenchidos.`);
    },
    onError: (error) => toast.error(errorMessage(error, 'Processo não encontrado no SIGRA.')),
  });

  if (linked) {
    const r = linked.reference;
    return (
      <div className="rounded-md border border-border bg-surface-alt p-3 text-[13px]">
        <p className="font-medium text-foreground">
          Vinculado ao processo SIGRA {linked.sigraId}
        </p>
        <dl className="mt-1.5 grid gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-2">
          {r.docCarga && (
            <div><dt className="inline">BL/booking: </dt><dd className="inline text-foreground">{r.docCarga}</dd></div>
          )}
          {r.exporterName && (
            <div><dt className="inline">Exportador: </dt><dd className="inline text-foreground">{r.exporterName}</dd></div>
          )}
          {r.exchangeRate !== null && (
            <div><dt className="inline">Câmbio do processo: </dt><dd className="inline text-foreground">{formatMoney(r.exchangeRate, 5)}</dd></div>
          )}
          {r.dtEmbarque && (
            <div><dt className="inline">Embarque: </dt><dd className="inline text-foreground">{formatDate(r.dtEmbarque)}</dd></div>
          )}
        </dl>
      </div>
    );
  }

  return (
    <Field
      label="Puxar do SIGRA"
      htmlFor="sigra-process-id"
      hint="Preenche peso, NCM, invoice e valores a partir do processo — confira tudo antes de salvar."
    >
      <div className="flex gap-2">
        <Input
          id="sigra-process-id"
          placeholder="Nº do processo SIGRA"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.trim()) {
              e.preventDefault();
              pull.mutate();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          loading={pull.isPending}
          disabled={!input.trim()}
          onClick={() => pull.mutate()}
        >
          <Download className="h-4 w-4" />
          Buscar
        </Button>
      </div>
    </Field>
  );
}

export type { SigraDraft };
