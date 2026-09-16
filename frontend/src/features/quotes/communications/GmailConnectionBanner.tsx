import { Mail, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConnectGmail, useDisconnectGmail, useGmailStatus } from './useCommunications';

/** Estado da conexão do operador com o Gmail — sem ela, o envio fica bloqueado. */
export function GmailConnectionBanner() {
  const { data: status, isLoading } = useGmailStatus();
  const connect = useConnectGmail();
  const disconnect = useDisconnectGmail();

  if (isLoading) return null;

  if (status?.connected) {
    return (
      <div className="flex items-center justify-between rounded-md border border-success/30 bg-success/8 px-3.5 py-2.5 text-[13px]">
        <span className="flex items-center gap-2 text-foreground">
          <Mail className="h-4 w-4 text-success" />
          Enviando como <strong className="font-medium">{status.email}</strong>
        </span>
        <Button variant="ghost" size="sm" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
          <Unlink className="h-3.5 w-3.5" />
          Desconectar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-md border border-warning/30 bg-warning/8 px-3.5 py-2.5 text-[13px]">
      <span className="flex items-center gap-2 text-foreground">
        <Mail className="h-4 w-4 text-warning" />
        Conecte sua conta Gmail para enviar mensagens a partir deste processo.
      </span>
      <Button size="sm" onClick={connect}>
        Conectar Gmail
      </Button>
    </div>
  );
}
