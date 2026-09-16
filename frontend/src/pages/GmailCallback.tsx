import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';

/**
 * Destino do redirect do backend após o OAuth do Gmail. Roda dentro do popup
 * aberto por `useConnectGmail` — fecha sozinha quando tem sucesso, o opener
 * detecta o fechamento e atualiza o status.
 */
export default function GmailCallback() {
  const [params] = useSearchParams();
  const success = params.get('status') === 'success';

  useEffect(() => {
    if (success && window.opener) {
      const timer = window.setTimeout(() => window.close(), 800);
      return () => window.clearTimeout(timer);
    }
  }, [success]);

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="max-w-sm text-center">
        <span
          className={`mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full ${success ? 'bg-success/12' : 'bg-danger/12'}`}
        >
          {success ? (
            <CheckCircle2 className="h-6 w-6 text-success" />
          ) : (
            <XCircle className="h-6 w-6 text-danger" />
          )}
        </span>
        <h1 className="text-[18px] font-semibold text-foreground">
          {success ? 'Gmail conectado' : 'Não foi possível conectar'}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          {success
            ? 'Esta janela vai fechar automaticamente.'
            : 'Feche esta janela e tente novamente.'}
        </p>
      </div>
    </div>
  );
}
