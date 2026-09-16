import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Paperclip, Send, X, File as FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { errorMessage } from '@/lib/api';
import { EmailChipsInput } from './EmailChipsInput';
import {
  useAttachments, useSendMessage, useUploadAttachment, type Attachment,
} from './useCommunications';

interface MessageComposerProps {
  quoteId: string;
  defaultTo?: string[];
  defaultSubject?: string;
  onSent?: () => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Composição de e-mail dentro do processo — Para/Cc, assunto, corpo rico e anexos. */
export function MessageComposer({ quoteId, defaultTo, defaultSubject, onSent }: MessageComposerProps) {
  const [to, setTo] = useState<string[]>(defaultTo ?? []);
  const [cc, setCc] = useState<string[]>([]);
  const [subject, setSubject] = useState(defaultSubject ?? '');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: attachments = [] } = useAttachments(quoteId);
  const upload = useUploadAttachment(quoteId);
  const send = useSendMessage(quoteId);

  const selectedAttachments = attachments.filter((a) => selectedAttachmentIds.includes(a.id));

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        const attachment = await upload.mutateAsync(file);
        setSelectedAttachmentIds((ids) => [...ids, attachment.id]);
      } catch (error) {
        toast.error(errorMessage(error, `Não foi possível anexar "${file.name}".`));
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleExisting = (attachment: Attachment) => {
    setSelectedAttachmentIds((ids) =>
      ids.includes(attachment.id) ? ids.filter((id) => id !== attachment.id) : [...ids, attachment.id],
    );
  };

  const reset = () => {
    setTo(defaultTo ?? []);
    setCc([]);
    setSubject(defaultSubject ?? '');
    setBodyHtml('');
    setBodyText('');
    setSelectedAttachmentIds([]);
  };

  const handleSend = async () => {
    if (to.length === 0) {
      toast.error('Informe ao menos um destinatário.');
      return;
    }
    if (!subject.trim()) {
      toast.error('Informe o assunto.');
      return;
    }
    if (!bodyText.trim()) {
      toast.error('O corpo do e-mail não pode ficar vazio.');
      return;
    }
    try {
      await send.mutateAsync({
        to, cc: cc.length ? cc : undefined, subject, bodyHtml, bodyText,
        attachmentIds: selectedAttachmentIds.length ? selectedAttachmentIds : undefined,
      });
      toast.success('E-mail enviado.');
      reset();
      onSent?.();
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível enviar o e-mail.'));
    }
  };

  const otherAttachments = attachments.filter((a) => !selectedAttachmentIds.includes(a.id));

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Para" required>
          <EmailChipsInput value={to} onChange={setTo} placeholder="destinatario@empresa.com" />
        </Field>
        <Field label="Cc">
          <EmailChipsInput value={cc} onChange={setCc} placeholder="opcional" />
        </Field>
      </div>

      <Field label="Assunto" required>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto do e-mail" />
      </Field>

      <Field label="Mensagem" required>
        <RichTextEditor value={bodyHtml} onChange={(html, text) => { setBodyHtml(html); setBodyText(text); }} />
      </Field>

      {(selectedAttachments.length > 0 || otherAttachments.length > 0) && (
        <div className="space-y-2">
          {selectedAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedAttachments.map((attachment) => (
                <span
                  key={attachment.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface-alt px-2.5 py-1 text-[13px] text-foreground"
                >
                  <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {attachment.fileName}
                  <span className="text-muted-foreground">({formatSize(attachment.sizeBytes)})</span>
                  <button
                    type="button"
                    onClick={() => toggleExisting(attachment)}
                    className="text-muted-foreground hover:text-danger"
                    aria-label={`Remover anexo ${attachment.fileName}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {otherAttachments.length > 0 && (
            <details className="text-[13px]">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Anexar documento já enviado no processo ({otherAttachments.length})
              </summary>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {otherAttachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() => toggleExisting(attachment)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border-strong px-2.5 py-1 text-muted-foreground hover:border-teal hover:text-teal"
                  >
                    <FileIcon className="h-3.5 w-3.5" />
                    {attachment.fileName}
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={upload.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-3.5 w-3.5" />
          Anexar arquivo
        </Button>
        <Button type="button" size="sm" loading={send.isPending} onClick={handleSend}>
          <Send className="h-3.5 w-3.5" />
          Enviar
        </Button>
      </div>
    </div>
  );
}
