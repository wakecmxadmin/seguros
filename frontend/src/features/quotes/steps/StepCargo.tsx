import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { api } from '@/lib/api';
import { CargoCondition } from '@/lib/enums';
import { SectionTitle, type StepProps } from './types';

export function StepCargo({ values, set }: StepProps) {
  const { data: coverages } = useQuery({
    queryKey: ['coverages'],
    queryFn: async () => {
      const { data } = await api.get('/coverages');
      return data as Array<{ id: string; name: string; accessory: boolean }>;
    },
  });

  const { data: packagings } = useQuery({
    queryKey: ['catalog-options', 'packagings'],
    queryFn: async () => {
      const { data } = await api.get('/catalog/packagings/options');
      return data as Array<{ id: string; label: string }>;
    },
  });

  const { data: commodityTypes } = useQuery({
    queryKey: ['catalog-options', 'commodity-types'],
    queryFn: async () => {
      const { data } = await api.get('/catalog/commodity-types/options');
      return data as Array<{ id: string; label: string }>;
    },
  });

  const mainCoverages = coverages?.filter((c) => !c.accessory) ?? [];

  return (
    <div>
      <SectionTitle>Mercadoria</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label="Descrição da mercadoria" htmlFor="commodityDescription" className="sm:col-span-6">
          <textarea
            id="commodityDescription"
            rows={3}
            value={values.commodityDescription}
            onChange={(e) => set('commodityDescription', e.target.value)}
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-foreground shadow-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </Field>

        <Field label="Tipo de mercadoria" htmlFor="commodityTypeId" className="sm:col-span-2">
          <Select
            id="commodityTypeId"
            value={values.commodityTypeId ?? ''}
            onChange={(e) => set('commodityTypeId', e.target.value || null)}
          >
            <option value="">Selecione…</option>
            {commodityTypes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Situação" htmlFor="cargoCondition" className="sm:col-span-2">
          <Select
            id="cargoCondition"
            value={values.cargoCondition}
            onChange={(e) => set('cargoCondition', e.target.value as 'NEW' | 'USED')}
          >
            {Object.entries(CargoCondition).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Embalagem" htmlFor="packagingId" className="sm:col-span-2">
          <Select
            id="packagingId"
            value={values.packagingId ?? ''}
            onChange={(e) => set('packagingId', e.target.value || null)}
          >
            <option value="">Selecione…</option>
            {packagings?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="NCM" htmlFor="ncm" className="sm:col-span-2">
          <Input id="ncm" value={values.ncm} onChange={(e) => set('ncm', e.target.value)} />
        </Field>

        <Field label="Marca" htmlFor="brand" className="sm:col-span-2">
          <Input id="brand" value={values.brand} onChange={(e) => set('brand', e.target.value)} />
        </Field>

        <Field label="Peso (kg)" htmlFor="weightKg" className="sm:col-span-2">
          <Input
            id="weightKg"
            className="tabular text-right"
            inputMode="decimal"
            value={values.weightKg}
            onChange={(e) => set('weightKg', e.target.value)}
          />
        </Field>

        <Field label="Fatura / Proforma" htmlFor="invoiceNumber" className="sm:col-span-3">
          <Input
            id="invoiceNumber"
            value={values.invoiceNumber}
            onChange={(e) => set('invoiceNumber', e.target.value)}
          />
        </Field>

        <Field
          label="Cobertura"
          htmlFor="coverageId"
          className="sm:col-span-3"
          hint="A cláusula define a taxa sugerida por modal."
        >
          <Select
            id="coverageId"
            value={values.coverageId ?? ''}
            onChange={(e) => set('coverageId', e.target.value || null)}
          >
            <option value="">Selecione…</option>
            {mainCoverages.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <SectionTitle>Observações</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Observação" htmlFor="notes" hint="Sai na proposta enviada ao cliente.">
          <textarea
            id="notes"
            rows={3}
            value={values.notes}
            onChange={(e) => set('notes', e.target.value)}
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-foreground shadow-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </Field>
        <Field label="Observação interna" htmlFor="internalNotes" hint="Visível apenas para a equipe.">
          <textarea
            id="internalNotes"
            rows={3}
            value={values.internalNotes}
            onChange={(e) => set('internalNotes', e.target.value)}
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-foreground shadow-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </Field>
      </div>
    </div>
  );
}
