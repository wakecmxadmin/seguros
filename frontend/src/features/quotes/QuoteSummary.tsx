import { Loader2, TrendingUp, TriangleAlert } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import type { CalculationResult } from './useQuoteForm';

interface QuoteSummaryProps {
  result: CalculationResult | null;
  calculating: boolean;
  currencyCode?: string;
}

/**
 * Resumo fixo com I.S. e prêmio. No legado era preciso rolar até o fim do
 * formulário e clicar em "Calcular" para ver qualquer total.
 */
export function QuoteSummary({ result, calculating, currencyCode = '' }: QuoteSummaryProps) {
  return (
    <aside className="lg:sticky lg:top-8 lg:self-start">
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        <header className="flex items-center justify-between border-b border-border bg-surface-alt/60 px-4 py-2.5">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Resumo do cálculo
          </span>
          {calculating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </header>

        {!result ? (
          <p className="px-4 py-8 text-center text-[13.5px] leading-relaxed text-muted-foreground">
            Selecione a moeda e informe os valores para ver o cálculo.
          </p>
        ) : (
          <div className="divide-y divide-border">
            <div className="px-4 py-3.5">
              <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
                Importância segurada
              </p>
              <p className="tabular mt-0.5 text-[22px] font-semibold tracking-tight text-foreground">
                {formatMoney(result.insuredAmount)}
                <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">
                  {currencyCode}
                </span>
              </p>
              {result.exchangeRate > 0 && (
                <p className="tabular mt-0.5 text-[12.5px] text-muted-foreground">
                  R$ {formatMoney(result.insuredAmountBrl)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 divide-x divide-border">
              <div className="px-4 py-3.5">
                <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
                  Prêmio cliente
                </p>
                <p className="tabular mt-0.5 text-[17px] font-semibold text-foreground">
                  {formatMoney(result.premiumClient)}
                </p>
                {result.minimumPremiumUsed && (
                  <p className="mt-1 flex items-start gap-1 text-[11.5px] leading-snug text-warning">
                    <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
                    piso da apólice aplicado (calculado: {formatMoney(result.premiumClientRaw)})
                  </p>
                )}
              </div>
              <div className="px-4 py-3.5">
                <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
                  Custo seguradora
                </p>
                <p className="tabular mt-0.5 text-[17px] font-semibold text-foreground">
                  {formatMoney(result.premiumInsurer)}
                </p>
                {result.insurerSurcharge > 0 && (
                  <p className="tabular mt-1 text-[11.5px] text-muted-foreground">
                    a pagar c/ agravo: {formatMoney(result.insurerPayable)}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-definitiva/6 px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[12px] uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                Margem bruta
              </p>
              <p className="tabular mt-0.5 text-[17px] font-semibold text-final">
                {formatMoney(result.grossMargin)}
                <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">
                  {result.marginPercent}% do prêmio
                </span>
              </p>
            </div>

            {result.commissions.total > 0 && (
              <div className="px-4 py-3.5">
                <p className="mb-1.5 text-[12px] uppercase tracking-wide text-muted-foreground">
                  Comissões
                </p>
                <dl className="space-y-1 text-[13px]">
                  {result.commissions.partner > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Parceiro</dt>
                      <dd className="tabular text-foreground">
                        {formatMoney(result.commissions.partner)}
                      </dd>
                    </div>
                  )}
                  {result.commissions.broker > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Corretora</dt>
                      <dd className="tabular text-foreground">
                        {formatMoney(result.commissions.broker)}
                      </dd>
                    </div>
                  )}
                  {result.commissions.salesperson > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Vendedor</dt>
                      <dd className="tabular text-foreground">
                        {formatMoney(result.commissions.salesperson)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {result.exchangeRate > 0 && (
              <p className="tabular px-4 py-2.5 text-[12px] text-muted-foreground">
                Câmbio: {result.exchangeRate.toFixed(4).replace('.', ',')}
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
