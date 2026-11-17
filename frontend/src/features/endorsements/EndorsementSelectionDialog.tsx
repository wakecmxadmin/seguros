import { useState } from 'react';
import { toast } from 'sonner';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { Combobox } from '@/components/ui/combobox';
import { downloadFile } from '@/lib/download';
import { useAuth } from '@/stores/auth';

export interface SelectionFilters {
  type: 'PROVISIONAL' | 'FINAL';
  insurerId: string;
  kind: '' | 'IMPORT' | 'EXPORT';
  numberFrom: string;
  numberTo: string;
  from: string;
  to: string;
}

/** Só os filtros preenchidos, com o número da averbação reduzido aos dígitos. */
export function selectionParams(f: SelectionFilters) {
  const params: Record<string, string> = { type: f.type };
  if (f.insurerId) params.insurerId = f.insurerId;
  if (f.kind) params.kind = f.kind;
  const from = f.numberFrom.replace(/\D/g, '');
  const to = f.numberTo.replace(/\D/g, '');
  if (from) params.numberFrom = String(Number(from));
  if (to) params.numberTo = String(Number(to));
  if (f.from) params.from = f.from;
  if (f.to) params.to = f.to;
  return params;
}

/**
 * Impressão e arquivo de provisórias/definitivas por faixa — as quatro telas
 * `ImpressaoProvisoria`, `ImpressaoDefinitiva`, `ArquivoProvisoria` e
 * `ArquivoDefinitiva` do legado num diálogo só, com os mesmos filtros
 * (faixa de averbação + seguradora) e o período como opção.
 */
export function EndorsementSelectionDialog({ onClose }: { onClose: () => void }) {
  const { can } = useAuth();
  const [filters, setFilters] = useState<SelectionFilters>({
    type: 'PROVISIONAL',
    insurerId: '',
    kind: '',
    numberFrom: '',
    numberTo: '',
    from: '',
    to: '',
  });
  const [exporting, setExporting] = useState(false);

  const set = <K extends keyof SelectionFilters>(key: K, value: SelectionFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const params = selectionParams(filters);
  const invalidRange =
    params.numberFrom !== undefined &&
    params.numberTo !== undefined &&
    Number(params.numberFrom) > Number(params.numberTo);
  const invalidPeriod = !!filters.from && !!filters.to && filters.from > filters.to;
  const invalid = invalidRange || invalidPeriod;

  function print() {
    const query = new URLSearchParams(params).toString();
    window.open(`/print/endorsement-selection?${query}`, '_blank', 'noopener');
  }

  async function exportFile() {
    setExporting(true);
    try {
      await downloadFile('/endorsements/selection/file', params, 'averbacoes.csv');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader
          title="Impressão e arquivo"
          description="Relação para imprimir ou arquivo de remessa à seguradora, por faixa de averbação. Canceladas ficam de fora."
        />
        <DialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Averbações" htmlFor="sel-type">
              <Select
                id="sel-type"
                value={filters.type}
                onChange={(e) => set('type', e.target.value as SelectionFilters['type'])}
              >
                <option value="PROVISIONAL">Provisórias</option>
                <option value="FINAL">Definitivas</option>
              </Select>
            </Field>
            <Field label="Ramo" htmlFor="sel-kind">
              <Select
                id="sel-kind"
                value={filters.kind}
                onChange={(e) => set('kind', e.target.value as SelectionFilters['kind'])}
              >
                <option value="">Importação e exportação</option>
                <option value="IMPORT">Importação</option>
                <option value="EXPORT">Exportação</option>
              </Select>
            </Field>
            <Field label="Seguradora" className="sm:col-span-2">
              <Combobox
                endpoint="/companies/options"
                params={{ role: 'INSURER' }}
                value={filters.insurerId}
                placeholder="Todas"
                onChange={(id) => set('insurerId', id ?? '')}
              />
            </Field>
            <Field
              label="Averbação inicial"
              htmlFor="sel-from-number"
              error={invalidRange ? 'Maior que a final.' : undefined}
            >
              <Input
                id="sel-from-number"
                inputMode="numeric"
                placeholder="ex.: 106400"
                value={filters.numberFrom}
                invalid={invalidRange}
                onChange={(e) => set('numberFrom', e.target.value)}
              />
            </Field>
            <Field label="Averbação final" htmlFor="sel-to-number">
              <Input
                id="sel-to-number"
                inputMode="numeric"
                placeholder="ex.: 106499"
                value={filters.numberTo}
                onChange={(e) => set('numberTo', e.target.value)}
              />
            </Field>
            <Field
              label="Emitidas de"
              htmlFor="sel-from"
              error={invalidPeriod ? 'Data inicial depois da final.' : undefined}
            >
              <Input
                id="sel-from"
                type="date"
                value={filters.from}
                invalid={invalidPeriod}
                onChange={(e) => set('from', e.target.value)}
              />
            </Field>
            <Field label="Até" htmlFor="sel-to">
              <Input id="sel-to" type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} />
            </Field>
          </div>
          <p className="mt-3 text-[12.5px] text-muted-foreground">
            Na faixa vale só a parte numérica — “D-106493” e “106493” são a mesma averbação.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {can('report:export') && (
            <Button type="button" variant="outline" disabled={invalid} loading={exporting} onClick={exportFile}>
              <FileSpreadsheet className="h-4 w-4" />
              Gerar arquivo
            </Button>
          )}
          {can('document:generate') && (
            <Button type="button" disabled={invalid} onClick={print}>
              <Printer className="h-4 w-4" />
              Imprimir relação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
