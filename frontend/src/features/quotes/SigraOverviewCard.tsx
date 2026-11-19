import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, Link2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/stores/auth';

export interface SigraDocument {
  type: string | null;
  number: string | null;
  createdAt: string | null;
  fileName: string | null;
  url: string;
  size: number | null;
}

export type SigraOverview =
  | { status: 'unlinked' }
  | { status: 'unavailable'; sigraId: number }
  | { status: 'not_found'; sigraId: number; linkedBy: 'link' | 'reference' }
  | {
      status: 'ok';
      sigraId: number;
      linkedBy: 'link' | 'reference';
      kind: 'IMPORT' | 'EXPORT_AGENCY' | 'EXPORT_CUSTOMS' | 'OTHER';
      code: string | null;
      clientName: string | null;
      arrivalDate: string | null;
      arrivalSource: string | null;
      departureDate: string | null;
      documentNumber: string | null;
      vessel: string | null;
      documents: SigraDocument[];
    };

/** Resumo do processo SIGRA da cotação — compartilhado com a emissão da definitiva. */
export function useSigraOverview(quoteId: string | null | undefined) {
  const { can } = useAuth();
  return useQuery({
    queryKey: ['quote-sigra-overview', quoteId],
    queryFn: async () => {
      const { data } = await api.get<SigraOverview>(`/quotes/${quoteId}/sigra/overview`);
      return data;
    },
    enabled: !!quoteId && can('sigra:read'),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * Dados do processo no SIGRA e os PDFs anexados lá (BL, invoice, packing list,
 * TFA, DI/DUIMP…). Os documentos abrem direto do SIGRA — nada é copiado.
 */
export function SigraOverviewCard({ quoteId }: { quoteId: string }) {
  const { can } = useAuth();
  const { data, isLoading, isError, error } = useSigraOverview(quoteId);

  if (!can('sigra:read')) return null;

  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <header className="flex items-center gap-1.5 border-b border-border bg-surface-alt/60 px-4 py-2.5">
        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          Processo no SIGRA
        </span>
      </header>

      <div className="px-4 py-3 text-[13px]">
        {isLoading && <p className="text-muted-foreground">Consultando o SIGRA…</p>}

        {isError && <p className="text-danger">{errorMessage(error, 'Não foi possível consultar o SIGRA.')}</p>}

        {data?.status === 'unlinked' && (
          <p className="leading-relaxed text-muted-foreground">
            Sem vínculo. Inclua o número do processo SIGRA (7 dígitos) na referência e salve.
          </p>
        )}

        {data?.status === 'unavailable' && (
          <p className="text-muted-foreground">
            Processo {data.sigraId}: a integração com o SIGRA não está ativa neste ambiente.
          </p>
        )}

        {data?.status === 'not_found' && (
          <p className="text-warning">
            O processo {data.sigraId}
            {data.linkedBy === 'reference' ? ' (lido da referência)' : ''} não existe no SIGRA.
          </p>
        )}

        {data?.status === 'ok' && (
          <>
            <p className="font-medium text-foreground">
              <span className="tabular">{data.sigraId}</span>
              {data.code && <span className="ml-1.5 font-normal text-muted-foreground">{data.code}</span>}
            </p>
            <dl className="mt-1.5 space-y-0.5 text-muted-foreground">
              {[
                ['Cliente', data.clientName],
                ['Conhecimento', data.documentNumber],
                ['Navio / voo', data.vessel],
                ['Embarque', data.departureDate ? formatDate(data.departureDate) : null],
                ['Chegada', data.arrivalDate ? formatDate(data.arrivalDate) : null],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt>{label}</dt>
                    <dd className="truncate text-right text-foreground">{value}</dd>
                  </div>
                ))}
            </dl>

            <p className="mb-1 mt-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Documentos
            </p>
            {data.documents.length === 0 ? (
              <p className="text-muted-foreground">Nenhum PDF anexado no SIGRA.</p>
            ) : (
              <ul className="space-y-1">
                {data.documents.map((doc) => (
                  <li key={doc.url}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-1.5 text-foreground hover:text-navy"
                      title={doc.fileName ?? undefined}
                    >
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{doc.type ?? doc.fileName ?? 'Documento'}</span>
                        {(doc.number || doc.createdAt) && (
                          <span className="block truncate text-[12px] text-muted-foreground">
                            {[doc.number, doc.createdAt ? formatDate(doc.createdAt) : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </span>
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
