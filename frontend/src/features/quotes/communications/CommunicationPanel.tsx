import { useAuth } from '@/stores/auth';
import { GmailConnectionBanner } from './GmailConnectionBanner';
import { MessageComposer } from './MessageComposer';
import { MessageTimeline } from './MessageTimeline';
import { useGmailStatus } from './useCommunications';

interface CommunicationPanelProps {
  quoteId: string;
  defaultTo?: string[];
  defaultSubject?: string;
}

/**
 * Timeline de mensagens e anexos por processo — substitui a caixa de entrada
 * como sistema de registro. Ver docs/12-reuniao-cliente.md § 5 (tarefa 31).
 */
export function CommunicationPanel({ quoteId, defaultTo, defaultSubject }: CommunicationPanelProps) {
  const can = useAuth((s) => s.can);
  const { data: gmailStatus } = useGmailStatus();

  return (
    <div className="space-y-4">
      {can('gmail:connect') && <GmailConnectionBanner />}

      {can('message:send') && gmailStatus?.connected && (
        <MessageComposer quoteId={quoteId} defaultTo={defaultTo} defaultSubject={defaultSubject} />
      )}

      <MessageTimeline quoteId={quoteId} />
    </div>
  );
}
