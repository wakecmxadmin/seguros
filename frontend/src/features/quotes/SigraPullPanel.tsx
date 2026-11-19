import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Download, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import type { QuoteFormValues } from './useQuoteForm';

export interface SigraDraft {
  sigraId: string;
  kind: 'IMPORT' | 'EXPORT';
  suggestion: {
    modal: QuoteFormValues['modal'] | null;
    incoterm: QuoteFormValues['incoterm'] | null;
    weightKg: number | null;
    ncm: string | null;
    invoiceNumber: string | null;
    commodityDescription: string | null;
    cost: number | null;
    freight: number | null;
    taxes: number | null;
    reference: string | null;
    clientId: string | null;
    currencyId: string | null;
    originCountryId: string | null;
    originPortId: string | null;
    destinationCountryId: string | null;
  };
  info: {
    clientName: string | null;
    documentNumber: string | null;
    ceMercante: string | null;
    departureDate: string | null;
    arrivalDate: string | null;
    vessel: string | null;
    origin: string | null;
    destination: string | null;
    exporterName: string | null;
    exchangeRate: number | null;
  };
  missing: string[];
}

type SetValue = <K extends keyof QuoteFormValues>(key: K, value: QuoteFormValues[K]) => void;

/** O mesmo extrator do backend: id de 7 dígitos dentro da referência do legado. */
export function extractSigraId(text: string): string | null {
  const matches = text.match(/(?<!\d)[12]\d{6}(?!\d)/g);
  return matches ? matches[matches.length - 1] : null;
}

/**
 * Aplica as sugestões nos campos do formulário — o operador ainda revisa tudo
 * antes de salvar. Só sobrescreve a referência se ela estiver vazia.
 */
function applyDraft(set: SetValue, values: QuoteFormValues, draft: SigraDraft) {
  const s = draft.suggestion;
  if (s.clientId) set('clientId', s.clientId);
  if (s.currencyId) set('currencyId', s.currencyId);
  if (s.modal) set('modal', s.modal);
  if (s.incoterm) set('incoterm', s.incoterm);
  if (s.weightKg !== null) set('weightKg', formatMoney(s.weightKg));
  if (s.ncm) set('ncm', s.ncm);
  if (s.invoiceNumber) set('invoiceNumber', s.invoiceNumber);
  if (s.commodityDescription) set('commodityDescription', s.commodityDescription);
  if (s.cost !== null) set('cost', formatMoney(s.cost));
  if (s.freight !== null) set('freight', formatMoney(s.freight));
  if (s.taxes !== null) set('taxes', formatMoney(s.taxes));
  if (s.originCountryId) set('originCountryId', s.originCountryId);
  if (s.originPortId) set('originPortId', s.originPortId);
  if (s.destinationCountryId) set('destinationCountryId', s.destinationCountryId);
  if (s.reference && !values.reference.trim()) set('reference', s.reference);
}

interface SigraPullPanelProps {
  values: QuoteFormValues;
  linked: SigraDraft | null;
  set: SetValue;
  onLinked: (draft: SigraDraft) => void;
}

/**
 * Busca um processo do SIGRA e pré-preenche o formulário. Importação vem do
 * despacho; exportação, do agenciamento — que não tem o valor da mercadoria
 * nem o frete segurado (docs/21). Nada é gravado até o operador salvar; a
 * referência SIGRA é criada junto com a cotação.
 */
export function SigraPullPanel({ values, linked, set, onLinked }: SigraPullPanelProps) {
  const [input, setInput] = useState('');
  const detected = extractSigraId(values.reference);

  const pull = useMutation({
    mutationFn: async (sigraId: string) => {
      const { data } = await api.get<SigraDraft>(`/quotes/sigra-draft/${sigraId}`);
      return data;
    },
    onSuccess: (data) => {
      if (data.kind !== values.kind) {
        toast.error(
          data.kind === 'EXPORT'
            ? `O processo ${data.sigraId} é de exportação. Abra uma cotação de exportação para ele.`
            : `O processo ${data.sigraId} é de importação. Abra uma cotação de importação para ele.`,
        );
        return;
      }
      applyDraft(set, values, data);
      onLinked(data);
      toast.success(`Processo ${data.sigraId} encontrado — confira os campos preenchidos.`);
    },
    onError: (error) => toast.error(errorMessage(error, 'Processo não encontrado no SIGRA.')),
  });

  if (linked) {
    const i = linked.info;
    const rows: Array<[string, string | null]> = [
      ['Cliente no SIGRA', i.clientName],
      ['Conhecimento', i.documentNumber],
      ['Navio / voo', i.vessel],
      ['Origem', i.origin],
      ['Destino', i.destination],
      ['Exportador', i.exporterName],
      ['Embarque', i.departureDate ? formatDate(i.departureDate) : null],
      ['Chegada', i.arrivalDate ? formatDate(i.arrivalDate) : null],
      ['Câmbio do processo', i.exchangeRate !== null ? formatMoney(i.exchangeRate, 5) : null],
    ];

    return (
      <div className="rounded-md border border-border bg-surface-alt p-3 text-[13px]">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
          Vinculado ao processo SIGRA {linked.sigraId}
        </p>
        <dl className="mt-1.5 grid gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-2">
          {rows
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label}>
                <dt className="inline">{label}: </dt>
                <dd className="inline text-foreground">{value}</dd>
              </div>
            ))}
        </dl>
        {linked.missing.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Não veio do SIGRA, preencha: {linked.missing.join(', ')}.</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {detected && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-alt px-3 py-2 text-[13px]">
          <span className="text-foreground">
            A referência contém o processo SIGRA <strong className="tabular">{detected}</strong>.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={pull.isPending && pull.variables === detected}
            onClick={() => pull.mutate(detected)}
          >
            <Download className="h-3.5 w-3.5" />
            Puxar dados
          </Button>
        </div>
      )}
      <Field
        label="Puxar do SIGRA"
        htmlFor="sigra-process-id"
        hint={
          values.kind === 'EXPORT'
            ? 'Preenche cliente, incoterm, modal e destino. Valor da mercadoria e frete continuam com você.'
            : 'Preenche cliente, moeda, incoterm, valores, peso, NCM e invoice — confira tudo antes de salvar.'
        }
      >
        <div className="flex gap-2">
          <Input
            id="sigra-process-id"
            inputMode="numeric"
            placeholder="Nº do processo SIGRA (7 dígitos)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim()) {
                e.preventDefault();
                pull.mutate(input.trim());
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            loading={pull.isPending && pull.variables === input.trim()}
            disabled={!input.trim()}
            onClick={() => pull.mutate(input.trim())}
          >
            <Download className="h-4 w-4" />
            Buscar
          </Button>
        </div>
      </Field>
    </div>
  );
}
