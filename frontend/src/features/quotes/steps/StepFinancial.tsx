import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { api } from '@/lib/api';
import { BillingVia, BudgetMode, DeclaredValue, Incoterm } from '@/lib/enums';
import { SectionTitle, type StepProps } from './types';

export function StepFinancial({ values, set, errors }: StepProps) {
  const isImport = values.kind === 'IMPORT';

  const { data: currencies } = useQuery({
    queryKey: ['catalog-options', 'currencies'],
    queryFn: async () => {
      const { data } = await api.get('/catalog/currencies/options');
      return data as Array<{ id: string; label: string }>;
    },
  });

  const { data: salespeople } = useQuery({
    queryKey: ['salespeople'],
    queryFn: async () => {
      const { data } = await api.get('/employees/salespeople');
      return data as Array<{ id: string; label: string }>;
    },
  });

  return (
    <div>
      <SectionTitle>Condições</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label="Condição de venda" htmlFor="incoterm" className="sm:col-span-2">
          <Select
            id="incoterm"
            value={values.incoterm}
            onChange={(e) => set('incoterm', e.target.value)}
          >
            {Object.keys(Incoterm).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Moeda" htmlFor="currencyId" required error={errors.currencyId} className="sm:col-span-2">
          <Select
            id="currencyId"
            value={values.currencyId ?? ''}
            invalid={!!errors.currencyId}
            onChange={(e) => set('currencyId', e.target.value || null)}
          >
            <option value="">Selecione…</option>
            {currencies?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Referência" htmlFor="reference" className="sm:col-span-2">
          <Input
            id="reference"
            value={values.reference}
            onChange={(e) => set('reference', e.target.value)}
          />
        </Field>

        <Field label="Cobrança via" htmlFor="billingVia" className="sm:col-span-2">
          <Select
            id="billingVia"
            value={values.billingVia}
            onChange={(e) => set('billingVia', e.target.value as 'BROKER' | 'PARTNER')}
          >
            {Object.entries(BillingVia).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Orçamento por" htmlFor="budgetMode" className="sm:col-span-2">
          <Select
            id="budgetMode"
            value={values.budgetMode}
            onChange={(e) => set('budgetMode', e.target.value as 'RATES' | 'VALUES')}
          >
            {Object.entries(BudgetMode).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Valor declarado" htmlFor="declaredValue" className="sm:col-span-2">
          <Select
            id="declaredValue"
            value={values.declaredValue}
            onChange={(e) => set('declaredValue', e.target.value)}
          >
            {Object.entries(DeclaredValue).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Over (%)" htmlFor="overPercent" className="sm:col-span-2">
          <Input
            id="overPercent"
            className="tabular text-right"
            inputMode="decimal"
            value={values.overPercent}
            onChange={(e) => set('overPercent', e.target.value)}
          />
        </Field>

        {isImport ? (
          <>
            <Field label="Desconto cliente (%)" htmlFor="clientDiscount" className="sm:col-span-2">
              <Input
                id="clientDiscount"
                className="tabular text-right"
                inputMode="decimal"
                value={values.clientDiscount}
                onChange={(e) => set('clientDiscount', e.target.value)}
              />
            </Field>
            <Field label="Desconto seguradora (%)" htmlFor="insurerDiscount" className="sm:col-span-2">
              <Input
                id="insurerDiscount"
                className="tabular text-right"
                inputMode="decimal"
                value={values.insurerDiscount}
                onChange={(e) => set('insurerDiscount', e.target.value)}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Desconto padrão (%)" htmlFor="standardDiscount" className="sm:col-span-2">
              <Input
                id="standardDiscount"
                className="tabular text-right"
                inputMode="decimal"
                value={values.standardDiscount}
                onChange={(e) => set('standardDiscount', e.target.value)}
              />
            </Field>
            <Field label="Adicional carta (%)" htmlFor="letterAdditionalPercent" className="sm:col-span-2">
              <Input
                id="letterAdditionalPercent"
                className="tabular text-right"
                inputMode="decimal"
                value={values.letterAdditionalPercent}
                onChange={(e) => set('letterAdditionalPercent', e.target.value)}
              />
            </Field>
          </>
        )}
      </div>

      <SectionTitle>Comissões</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Vendedor" htmlFor="salespersonId" className="sm:col-span-2">
          <Select
            id="salespersonId"
            value={values.salespersonId ?? ''}
            onChange={(e) => set('salespersonId', e.target.value || null)}
          >
            <option value="">Selecione…</option>
            {salespeople?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Parceiro (%)" htmlFor="partnerPercent">
          <Input
            id="partnerPercent"
            className="tabular text-right"
            inputMode="decimal"
            value={values.partnerPercent}
            onChange={(e) => set('partnerPercent', e.target.value)}
          />
        </Field>

        <Field label="Corretora (%)" htmlFor="brokerPercent">
          <Input
            id="brokerPercent"
            className="tabular text-right"
            inputMode="decimal"
            value={values.brokerPercent}
            onChange={(e) => set('brokerPercent', e.target.value)}
          />
        </Field>

        <Field label="Vendedor (%)" htmlFor="salespersonPercent">
          <Input
            id="salespersonPercent"
            className="tabular text-right"
            inputMode="decimal"
            value={values.salespersonPercent}
            onChange={(e) => set('salespersonPercent', e.target.value)}
          />
        </Field>

        {!isImport && (
          <>
            <Field label="Valor IRB" htmlFor="irbValue">
              <Input
                id="irbValue"
                className="tabular text-right"
                inputMode="decimal"
                value={values.irbValue}
                onChange={(e) => set('irbValue', e.target.value)}
              />
            </Field>
            <Field label="Moeda IRB" htmlFor="irbCurrencyId">
              <Select
                id="irbCurrencyId"
                value={values.irbCurrencyId ?? ''}
                onChange={(e) => set('irbCurrencyId', e.target.value || null)}
              >
                <option value="">Selecione…</option>
                {currencies?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
      </div>
    </div>
  );
}
