import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loading, LoadError } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import logo from '@/assets/logo.jpeg';

/**
 * Emitente dos documentos. No legado estava fixo no template (docs/16 § 4–5);
 * aqui fica num lugar só até virar parâmetro.
 */
const ISSUER = 'COOMEX INTELIGENCIA LOGISTICA LTDA';

interface EndorsementDocument {
  document: 'certificate' | 'coverage';
  quoteNumber: number;
  kind: 'IMPORT' | 'EXPORT';
  reference: string | null;
  client: { name: string; document: string };
  insurer: string | null;
  policyNumber: string | null;
  endorsement: {
    number: string;
    issuedAt: string;
    berthingDate: string | null;
    blNumber: string | null;
    containerNumber: string | null;
    vessel: string | null;
  };
  provisional: { number: string; issuedAt: string } | null;
  /** Presente no certificado de prorrogação: prêmio e data passam a ser os dela. */
  extension: { sequence: number; issuedAt: string; coverageUntil: string | null; percent: number } | null;
  commodity: string | null;
  invoiceNumber: string | null;
  origin: string | null;
  destination: string | null;
  modal: 'AIR' | 'SEA' | 'ROAD' | 'RAIL';
  modalLabel: string;
  departureForecast: string | null;
  incoterm: string;
  currencyCode: string;
  insuredAmount: number;
  premiumClient: number;
  premiumClientBrl: number;
  exchangeRate: number;
  clientRate: number | null;
  composition: string[];
  guarantee: string | null;
}

/** "2026" de uma data ISO, para o sufixo das averbações (D-106493/26). */
const yy = (iso: string) => new Date(iso).getUTCFullYear().toString().slice(-2);

/** "D-106493/26" — ou "PRG- D-106493/26" na prorrogação, como no legado. */
function finalLabel(doc: EndorsementDocument) {
  const e = doc.endorsement;
  const base = `${e.number}/${yy(e.issuedAt)}`;
  return doc.extension ? `PRG-${doc.extension.sequence} ${base}` : base;
}

/** Data do documento: a da prorrogação, quando houver. */
const documentDate = (doc: EndorsementDocument) => doc.extension?.issuedAt ?? doc.endorsement.issuedAt;

/** Selo vermelho do legado para processo prorrogado. */
function ExtensionSeal({ doc }: { doc: EndorsementDocument }) {
  if (!doc.extension) return null;
  return (
    <div className="mb-5 border-2 border-red-700 px-3 py-2 text-center text-[13px] font-bold uppercase tracking-wider text-red-700">
      Prorrogação de seguro
      {doc.extension.coverageUntil && (
        <span className="block text-[11.5px] font-semibold normal-case tracking-normal">
          cobertura estendida até {formatDate(doc.extension.coverageUntil)}
        </span>
      )}
    </div>
  );
}

const KNOWLEDGE_LABEL: Record<EndorsementDocument['modal'], string> = {
  SEA: 'BL',
  AIR: 'AWB',
  ROAD: 'CRT',
  RAIL: 'TIF/DTA',
};

/**
 * Página de impressão do certificado (importação) e da solicitação de
 * cobertura (exportação). Fica fora do layout da aplicação para sair limpa no
 * papel — o operador imprime ou salva em PDF pelo navegador, como no legado.
 */
export default function EndorsementPrint() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const extension = params.get('extension');
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['endorsement-document', id, extension],
    queryFn: async () => {
      const { data } = await api.get(`/documents/endorsements/${id}`, {
        params: extension ? { extension } : undefined,
      });
      return data as EndorsementDocument;
    },
  });

  return (
    <div className="min-h-screen bg-surface-alt print:bg-white">
      <div className="mx-auto flex max-w-[820px] items-center justify-between px-4 py-4 print:hidden">
        <p className="text-[13px] text-muted-foreground">
          Confira os dados e imprima — ou escolha “Salvar como PDF” na janela de impressão.
        </p>
        <Button onClick={() => window.print()} disabled={!data}>
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>

      <div className="mx-auto max-w-[820px] bg-white px-10 py-10 text-[12.5px] leading-relaxed text-black shadow-card print:max-w-none print:p-0 print:shadow-none">
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <LoadError message={errorMessage(error)} />
        ) : data?.document === 'certificate' ? (
          <Certificate doc={data} />
        ) : data ? (
          <CoverageRequest doc={data} />
        ) : null}
      </div>

      <style>{`@page { margin: 1.2cm; } @media print { body { -webkit-print-color-adjust: exact; } }`}</style>
    </div>
  );
}

function Header({ title, aside }: { title: string; aside: React.ReactNode }) {
  return (
    <header className="mb-6 flex items-start justify-between border-b border-black/20 pb-4">
      <img src={logo} alt="Coomex" className="h-14 w-32 object-contain" />
      <div className="text-right">
        <h1 className="text-[17px] font-semibold uppercase tracking-wide">{title}</h1>
        <div className="mt-1 text-[12px]">{aside}</div>
      </div>
    </header>
  );
}

function Grid({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-black/10 align-top">
            <th className="w-[36%] py-1.5 pr-3 text-left font-medium text-black/60">{label}</th>
            <td className="py-1.5">{value || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Certificate({ doc }: { doc: EndorsementDocument }) {
  const e = doc.endorsement;
  return (
    <>
      <Header title="Certificado de seguro" aside={<>Processo {doc.quoteNumber}</>} />
      <ExtensionSeal doc={doc} />

      <p className="mb-5 text-justify">
        Certificamos que <strong>{doc.client.name.toUpperCase()}</strong>
        {doc.client.document && <> (CNPJ {doc.client.document})</>} contratou junto à{' '}
        <strong>{(doc.insurer ?? '').toUpperCase()}</strong>, segundo os termos e condições da apólice
        nº <strong>{doc.policyNumber ?? '—'}</strong> e da averbação definitiva nº{' '}
        <strong>{finalLabel(doc)}</strong> de {formatDate(documentDate(doc))}, o seguro de transportes dos bens abaixo identificados, com os
        seguintes valores.
      </p>

      <Grid
        rows={[
          ['Mercadoria', doc.commodity],
          [`Importância segurada (${doc.currencyCode})`, formatMoney(doc.insuredAmount)],
          ['Composição da I.S.', doc.composition.join(' + ')],
          ['Garantia', doc.guarantee],
          ['Fatura', doc.invoiceNumber],
          ['Local de início', doc.origin],
          ['Destino', doc.destination],
          ['Meio de transporte', doc.modalLabel],
          [
            'Provisória',
            doc.provisional ? `${doc.provisional.number}/${yy(doc.provisional.issuedAt)}` : null,
          ],
          ['Definitiva', finalLabel(doc)],
          [KNOWLEDGE_LABEL[doc.modal], e.blNumber],
          ...(doc.modal === 'SEA'
            ? ([
                ['Navio', e.vessel],
                ['Contêiner', e.containerNumber],
              ] as [string, string | null][])
            : []),
          [
            doc.extension ? `Prêmio da prorrogação (${doc.currencyCode})` : `Prêmio (${doc.currencyCode})`,
            formatMoney(doc.premiumClient),
          ],
          [doc.extension ? 'Prêmio da prorrogação (R$)' : 'Prêmio (R$)', formatMoney(doc.premiumClientBrl)],
          ['Data', formatDate(documentDate(doc))],
          ['Referência', doc.reference],
        ]}
      />

      <footer className="mt-10 text-[12px]">Emitido por: {ISSUER}</footer>
    </>
  );
}

function CoverageRequest({ doc }: { doc: EndorsementDocument }) {
  const e = doc.endorsement;
  return (
    <>
      <Header
        title="Solicitação de cobertura"
        aside={<>Cobertura nº {doc.extension ? `PRG-${doc.extension.sequence} ${e.number}` : e.number}</>}
      />
      <ExtensionSeal doc={doc} />

      <p className="mb-5">
        Solicitamos cobertura imediata para o embarque de exportação abaixo — apólice{' '}
        <strong>{doc.policyNumber ?? '—'}</strong>.
      </p>

      <Grid
        rows={[
          ['Processo', String(doc.quoteNumber)],
          ['Empresa', doc.client.name.toUpperCase()],
          ['Mercadoria', doc.commodity?.toUpperCase() ?? null],
          ['Início', doc.origin?.toUpperCase() ?? null],
          ['Destino', doc.destination?.toUpperCase() ?? null],
          ['Transporte', doc.modalLabel.toUpperCase()],
          ...(doc.modal === 'SEA' ? ([['Navio', e.vessel]] as [string, string | null][]) : []),
          ['Garantia', doc.guarantee?.toUpperCase() ?? null],
          ['Fatura', doc.invoiceNumber],
          // No legado o nº do conhecimento sumia no marítimo; aqui sai sempre que houver.
          [KNOWLEDGE_LABEL[doc.modal], e.blNumber],
          ['Data de saída', doc.departureForecast ? formatDate(doc.departureForecast) : null],
          [
            `Valor ${doc.incoterm} (${doc.currencyCode})`,
            formatMoney(doc.insuredAmount),
          ],
          [
            doc.extension ? `Prêmio da prorrogação (${doc.currencyCode})` : `Prêmio (${doc.currencyCode})`,
            formatMoney(doc.premiumClient),
          ],
          ['Taxa', doc.clientRate === null ? null : `${formatMoney(doc.clientRate, 5)} %`],
        ]}
      />

      <footer className="mt-10 text-[12px]">
        {ISSUER} · {formatDate(documentDate(doc))}
      </footer>
    </>
  );
}
