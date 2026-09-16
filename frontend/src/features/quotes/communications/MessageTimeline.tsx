import { useState } from 'react';
import { ChevronDown, ChevronUp, File as FileIcon, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Loading, LoadError } from '@/components/ui/states';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { downloadAttachment, useMessages, type Message } from './useCommunications';

function MessageCard({ quoteId, message }: { quoteId: string; message: Message }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[14px] font-medium text-foreground">{message.subject}</p>
            {message.status === 'FAILED' && (
              <Badge variant="danger">
                <TriangleAlert className="h-3 w-3" /> falhou
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
            Para: {message.toAddresses.join(', ')}
            {message.ccAddresses.length > 0 && ` · Cc: ${message.ccAddresses.join(', ')}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[12.5px] text-muted-foreground">
          <span className="text-right">
            {formatDateTime(message.sentAt)}
            {message.sentBy && <span className="block">{message.sentBy.name}</span>}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3.5">
          {message.status === 'FAILED' && message.errorMessage && (
            <p className="mb-3 flex items-start gap-1.5 rounded-md bg-danger/10 px-3 py-2 text-[13px] text-danger">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
              {message.errorMessage}
            </p>
          )}
          <div
            className="rich-text-content text-[13.5px] text-foreground"
            dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
          />
          {message.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              {message.attachments.map(({ attachment }) => (
                <button
                  key={attachment.id}
                  type="button"
                  onClick={() => downloadAttachment(quoteId, attachment)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1 text-[12.5px] text-foreground hover:border-teal hover:text-teal"
                >
                  <FileIcon className="h-3.5 w-3.5" />
                  {attachment.fileName}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Histórico de mensagens do processo — substitui a caixa de entrada (tarefa 31). */
export function MessageTimeline({ quoteId }: { quoteId: string }) {
  const { data: messages, isLoading, isError, error } = useMessages(quoteId);

  if (isLoading) return <Loading text="Carregando mensagens…" />;
  if (isError) return <LoadError message={errorMessage(error)} />;
  if (!messages?.length) {
    return (
      <EmptyState
        title="Nenhuma mensagem ainda"
        description="Os e-mails enviados a partir deste processo aparecem aqui, com anexos e histórico completo."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {messages.map((message) => (
        <MessageCard key={message.id} quoteId={quoteId} message={message} />
      ))}
    </div>
  );
}
