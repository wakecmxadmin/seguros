import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loading, LoadError } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import logo from '@/assets/logo.jpeg';

interface SelectionItem {
  id: string;
  number: string;
  provisional: string | null;
  issuedAt: string;
  quoteNumber: number;
  reference: string | null;
  client: string;
  policyNumber: string | null;
  insurer: string | null;
  commodity: string | null;
  origin: string | null;
  destination: string | null;
  modal: string;
  blNumber: string | null;
  vessel: string | null;
  currencyCode: string;
  insuredAmount: number;
  premiumInsurer: number;
}

interface SelectionData {
  type: 'PROVISIONAL' | 'FINAL';
  insurer: string | null;
  items: SelectionItem[];
  totals: { currencyCode: string; count: number; insuredAmount: number; premiumInsurer: number }[];
}

/**
 * Relação de averbações por faixa, para imprimir ou salvar em PDF — a
 * "Impressão de Provisórias/Definitivas" do legado.
 */
export default function EndorsementSelectionPrint() {
  const [params] = useSearchParams();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['endorsement-selection-print', params.toString()],
    queryFn: async () =>
      (await api.get('/endorsements/selection/print', { params: Object.fromEntries(params) }))
        .data as SelectionData,
  });

  const title = data?.type === 'FINAL' ? 'Relação de averbações definitivas' : 'Relação de averbações provisórias';
  const range = [params.get('numberFrom'), params.get('numberTo')];
  const period = [params.get('from'), params.get('to')];

  return (
    <div className="min-h-screen bg-surface-alt print:bg-white">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-4 print:hidden">
        <p className="text-[13px] text-muted-foreground">
          Confira a seleção e imprima — ou escolha “Salvar como PDF” na janela de impressão.
        </p>
        <Button onClick={() => window.print()} disabled={!data?.items.length}>
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>

      <div className="mx-auto max-w-[1100px] bg-white px-8 py-8 text-[11.5px] text-black shadow-card print:max-w-none print:p-0 print:shadow-none">
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <LoadError message={errorMessage(error)} />
        ) : data ? (
          <>
            <header className="mb-5 flex items-start justify-between border-b border-black/20 pb-3">
              <img src={logo} alt="Coomex" className="h-12 w-28 object-contain" />
              <div className="text-right">
                <h1 className="text-[16px] font-semibold uppercase tracking-wide">{title}</h1>
                <p className="mt-1">{data.insurer ?? 'Todas as seguradoras'}</p>
                <p className="text-black/60">
                  {range[0] || range[1] ? `Averbações ${range[0] ?? '…'} a ${range[1] ?? '…'}` : 'Todas as averbações'}
                  {(period[0] || period[1]) &&
                    ` · emitidas de ${period[0] ? formatDate(period[0]) : '…'} a ${period[1] ? formatDate(period[1]) : '…'}`}
                </p>
              </div>
            </header>

            {data.items.length === 0 ? (
              <p className="py-10 text-center text-black/60">Nenhuma averbação na seleção.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-black/40 text-left align-bottom">
                    <th className="py-1.5 pr-2 font-semibold">Averbação</th>
                    <th className="py-1.5 pr-2 font-semibold">Data</th>
                    <th className="py-1.5 pr-2 font-semibold">Proc.</th>
                    <th className="py-1.5 pr-2 font-semibold">Segurado</th>
                    <th className="py-1.5 pr-2 font-semibold">Apólice</th>
                    <th className="py-1.5 pr-2 font-semibold">Mercadoria</th>
                    <th className="py-1.5 pr-2 font-semibold">Trajeto</th>
                    <th className="py-1.5 pr-2 font-semibold">Conhec. / navio</th>
                    <th className="py-1.5 pr-2 text-right font-semibold">I.S.</th>
                    <th className="py-1.5 text-right font-semibold">Prêmio seg.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} className="break-inside-avoid border-b border-black/10 align-top">
                      <td className="py-1.5 pr-2 font-medium">
                        {item.number}
                        {item.provisional && <span className="block text-black/50">{item.provisional}</span>}
                      </td>
                      <td className="py-1.5 pr-2">{formatDate(item.issuedAt)}</td>
                      <td className="py-1.5 pr-2">{item.quoteNumber}</td>
                      <td className="py-1.5 pr-2">
                        {item.client}
                        {item.reference && <span className="block text-black/50">Ref. {item.reference}</span>}
                      </td>
                      <td className="py-1.5 pr-2">{item.policyNumber ?? '—'}</td>
                      <td className="py-1.5 pr-2">{item.commodity ?? '—'}</td>
                      <td className="py-1.5 pr-2">
                        {[item.origin, item.destination].filter(Boolean).join(' → ') || '—'}
                        <span className="block text-black/50">{item.modal}</span>
                      </td>
                      <td className="py-1.5 pr-2">
                        {item.blNumber ?? '—'}
                        {item.vessel && <span className="block text-black/50">{item.vessel}</span>}
                      </td>
                      <td className="tabular whitespace-nowrap py-1.5 pr-2 text-right">
                        {item.currencyCode} {formatMoney(item.insuredAmount)}
                      </td>
                      <td className="tabular whitespace-nowrap py-1.5 text-right">
                        {formatMoney(item.premiumInsurer)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {data.totals.map((t) => (
                    <tr key={t.currencyCode} className="border-t border-black/40 font-semibold">
                      <td colSpan={8} className="py-1.5 pr-2">
                        Total {t.currencyCode} · {t.count} averbaç{t.count === 1 ? 'ão' : 'ões'}
                      </td>
                      <td className="tabular whitespace-nowrap py-1.5 pr-2 text-right">
                        {t.currencyCode} {formatMoney(t.insuredAmount)}
                      </td>
                      <td className="tabular whitespace-nowrap py-1.5 text-right">{formatMoney(t.premiumInsurer)}</td>
                    </tr>
                  ))}
                </tfoot>
              </table>
            )}

            <footer className="mt-6 text-[11px] text-black/60">
              COOMEX INTELIGENCIA LOGISTICA LTDA · emitido em {formatDate(new Date().toISOString())}
            </footer>
          </>
        ) : null}
      </div>

      <style>{`@page { size: A4 landscape; margin: 1cm; } @media print { body { -webkit-print-color-adjust: exact; } }`}</style>
    </div>
  );
}
