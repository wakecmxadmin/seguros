import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { formatMoney, formatRate } from '@/lib/format';
import { RateLineItem } from '@/lib/enums';
import { SectionTitle, type StepProps } from './types';

/** Coberturas acessórias por ramo — a exportação tem um conjunto próprio. */
const ACCESSORY_IMPORT = [
  { key: 'warStrike', label: 'Guerra e Greve', hint: 'Soma o GTM/GMCC à taxa.' },
  { key: 'machineryStoppage', label: 'Paralisação Máquina/Refrigeração' },
  { key: 'expensesCovered', label: 'Despesas', hint: 'Inclui a verba de despesas na I.S.' },
  { key: 'expectedProfitCovered', label: 'Lucros Esperados', hint: 'Inclui a verba de lucros na I.S.' },
  { key: 'minimumPremiumApplied', label: 'Prêmio Mínimo', hint: 'Aplica o piso da apólice.' },
  { key: 'transshipment', label: 'Transbordo' },
] as const;

const ACCESSORY_EXPORT = [
  { key: 'warStrike', label: 'Guerra e Greve', hint: 'Soma o GTM/GMCC à taxa.' },
  { key: 'machineryStoppage', label: 'Paralisação Máquina/Refrigeração' },
  { key: 'creditLetter', label: 'Carta de Crédito' },
  { key: 'minimumPremiumApplied', label: 'Prêmio Mínimo', hint: 'Aplica o piso da apólice.' },
] as const;

const TAXES = [
  { key: 'taxImportDuty', label: 'I.I' },
  { key: 'taxIpi', label: 'IPI' },
  { key: 'taxIcms', label: 'ICMS' },
  { key: 'taxPis', label: 'PIS' },
  { key: 'taxCofins', label: 'COFINS' },
] as const;

export function StepRates({ values, set, result }: StepProps) {
  const isImport = values.kind === 'IMPORT';
  const accessories = isImport ? ACCESSORY_IMPORT : ACCESSORY_EXPORT;

  return (
    <div>
      <SectionTitle>Verbas</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Custo da mercadoria" htmlFor="cost">
          <Input
            id="cost"
            className="tabular text-right"
            inputMode="decimal"
            value={values.cost}
            onChange={(e) => set('cost', e.target.value)}
          />
        </Field>

        <Field label="Frete" htmlFor="freight">
          <Input
            id="freight"
            className="tabular text-right"
            inputMode="decimal"
            value={values.freight}
            onChange={(e) => set('freight', e.target.value)}
          />
        </Field>

        {isImport ? (
          <>
            <Field
              label="Despesas (%)"
              htmlFor="expensePercent"
              hint="Sobre custo + frete."
            >
              <Input
                id="expensePercent"
                className="tabular text-right"
                inputMode="decimal"
                value={values.expensePercent}
                onChange={(e) => set('expensePercent', e.target.value)}
              />
            </Field>
            <Field
              label="Lucros esperados (%)"
              htmlFor="profitPercent"
              hint="Sobre custo + frete."
            >
              <Input
                id="profitPercent"
                className="tabular text-right"
                inputMode="decimal"
                value={values.profitPercent}
                onChange={(e) => set('profitPercent', e.target.value)}
              />
            </Field>
            <Field label="Impostos" htmlFor="taxes" hint="Entram na I.S., mas não são tarifados.">
              <Input
                id="taxes"
                className="tabular text-right"
                inputMode="decimal"
                value={values.taxes}
                onChange={(e) => set('taxes', e.target.value)}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Valor CIF" htmlFor="cifValue">
              <Input
                id="cifValue"
                className="tabular text-right"
                inputMode="decimal"
                value={values.cifValue}
                onChange={(e) => set('cifValue', e.target.value)}
              />
            </Field>
            <Field
              label="Adicional navio (%)"
              htmlFor="vesselAdditionalPercent"
              hint="Acréscimo por idade ou tipo da embarcação."
            >
              <Input
                id="vesselAdditionalPercent"
                className="tabular text-right"
                inputMode="decimal"
                value={values.vesselAdditionalPercent}
                onChange={(e) => set('vesselAdditionalPercent', e.target.value)}
              />
            </Field>
          </>
        )}
      </div>

      <SectionTitle>Taxas</SectionTitle>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-[13px] font-semibold text-foreground">
            Cliente
            <span className="ml-1.5 font-normal text-muted-foreground">— o que é cobrado</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Básica (%)" htmlFor="clientBaseRate">
              <Input
                id="clientBaseRate"
                className="tabular text-right"
                inputMode="decimal"
                value={values.clientBaseRate}
                onChange={(e) => set('clientBaseRate', e.target.value)}
              />
            </Field>
            <Field label="Adicional (%)" htmlFor="clientExtraRate">
              <Input
                id="clientExtraRate"
                className="tabular text-right"
                inputMode="decimal"
                value={values.clientExtraRate}
                onChange={(e) => set('clientExtraRate', e.target.value)}
              />
            </Field>
            <Field label="GTM/GMCC (%)" htmlFor="clientWarRate">
              <Input
                id="clientWarRate"
                className="tabular text-right"
                inputMode="decimal"
                value={values.clientWarRate}
                onChange={(e) => set('clientWarRate', e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-[13px] font-semibold text-foreground">
            Seguradora
            <span className="ml-1.5 font-normal text-muted-foreground">— custo de repasse</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Básica (%)" htmlFor="insurerBaseRate">
              <Input
                id="insurerBaseRate"
                className="tabular text-right"
                inputMode="decimal"
                value={values.insurerBaseRate}
                onChange={(e) => set('insurerBaseRate', e.target.value)}
              />
            </Field>
            <Field label="Adicional (%)" htmlFor="insurerExtraRate">
              <Input
                id="insurerExtraRate"
                className="tabular text-right"
                inputMode="decimal"
                value={values.insurerExtraRate}
                onChange={(e) => set('insurerExtraRate', e.target.value)}
              />
            </Field>
            <Field label="GTM/GMCC (%)" htmlFor="insurerWarRate">
              <Input
                id="insurerWarRate"
                className="tabular text-right"
                inputMode="decimal"
                value={values.insurerWarRate}
                onChange={(e) => set('insurerWarRate', e.target.value)}
              />
            </Field>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field
          label="Prêmio mínimo"
          htmlFor="minimumPremium"
          hint="Piso da apólice, aplicado só ao cliente."
        >
          <Input
            id="minimumPremium"
            className="tabular text-right"
            inputMode="decimal"
            value={values.minimumPremium}
            onChange={(e) => set('minimumPremium', e.target.value)}
          />
        </Field>
        <Field
          label="Agravo seguradora (%)"
          htmlFor="insurerSurchargePercent"
          hint="A confirmar com o cliente: 20% ou 25%."
        >
          <Input
            id="insurerSurchargePercent"
            className="tabular text-right"
            inputMode="decimal"
            value={values.insurerSurchargePercent}
            onChange={(e) => set('insurerSurchargePercent', e.target.value)}
          />
        </Field>
      </div>

      <SectionTitle>Coberturas acessórias</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accessories.map((item) => (
          <label
            key={item.key}
            className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-surface p-3 transition-colors hover:border-border-strong"
          >
            <Switch
              checked={values[item.key] as boolean}
              onCheckedChange={(v) => set(item.key as any, v as any)}
            />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium text-foreground">{item.label}</span>
              {'hint' in item && item.hint && (
                <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                  {item.hint}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>

      {isImport && (
        <>
          <SectionTitle>Impostos na base da I.S.</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {TAXES.map((tax) => {
              const on = values[tax.key] as boolean;
              return (
                <button
                  key={tax.key}
                  type="button"
                  onClick={() => set(tax.key as any, !on as any)}
                  className={`rounded-md border px-4 py-2 text-[13.5px] font-medium transition-colors ${
                    on
                      ? 'border-teal bg-teal/8 text-teal'
                      : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground'
                  }`}
                >
                  {tax.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Grade calculada */}
      {result && (
        <>
          <SectionTitle>Cálculo</SectionTitle>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-surface-alt/60">
                  <th className="px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Verba
                  </th>
                  <th className="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Valor
                  </th>
                  <th className="border-l border-border px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Taxa cliente
                  </th>
                  <th className="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Prêmio cliente
                  </th>
                  <th className="border-l border-border px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Taxa seg.
                  </th>
                  <th className="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Prêmio seg.
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map((line) => (
                  <tr key={line.item} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-[13.5px] text-foreground">
                      {RateLineItem[line.item as keyof typeof RateLineItem] ?? line.item}
                    </td>
                    <td className="tabular px-3 py-2 text-right text-[13.5px] text-foreground">
                      {formatMoney(line.amount)}
                    </td>
                    <td className="tabular border-l border-border px-3 py-2 text-right text-[13.5px] text-muted-foreground">
                      {formatRate(line.client.total)}
                    </td>
                    <td className="tabular px-3 py-2 text-right text-[13.5px] text-foreground">
                      {formatMoney(line.client.premium)}
                    </td>
                    <td className="tabular border-l border-border px-3 py-2 text-right text-[13.5px] text-muted-foreground">
                      {formatRate(line.insurer.total)}
                    </td>
                    <td className="tabular px-3 py-2 text-right text-[13.5px] text-foreground">
                      {formatMoney(line.insurer.premium)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-alt/60 font-semibold">
                  <td className="px-3 py-2.5 text-[13.5px] text-foreground">Total</td>
                  <td className="tabular px-3 py-2.5 text-right text-[13.5px] text-foreground">
                    {formatMoney(result.insuredAmount)}
                  </td>
                  <td className="border-l border-border" />
                  <td className="tabular px-3 py-2.5 text-right text-[13.5px] text-foreground">
                    {formatMoney(result.premiumClient)}
                  </td>
                  <td className="border-l border-border" />
                  <td className="tabular px-3 py-2.5 text-right text-[13.5px] text-foreground">
                    {formatMoney(result.premiumInsurer)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
