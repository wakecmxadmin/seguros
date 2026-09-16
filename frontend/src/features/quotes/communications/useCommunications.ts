import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface Message {
  id: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  toAddresses: string[];
  ccAddresses: string[];
  status: 'SENT' | 'FAILED';
  errorMessage: string | null;
  sentAt: string;
  sentBy: { id: string; name: string } | null;
  attachments: { attachment: Attachment }[];
}

export interface GmailStatus {
  connected: boolean;
  email: string | null;
}

export function useGmailStatus() {
  return useQuery({
    queryKey: ['gmail-status'],
    queryFn: async () => {
      const { data } = await api.get<GmailStatus>('/gmail/status');
      return data;
    },
    staleTime: 10_000,
  });
}

/** Abre o popup de OAuth e recarrega o status quando ele fechar. */
export function useConnectGmail() {
  const queryClient = useQueryClient();
  return async () => {
    try {
      const { data } = await api.get<{ url: string }>('/gmail/auth-url');
      const popup = window.open(data.url, 'gmail-oauth', 'width=520,height=680');
      const timer = window.setInterval(() => {
        if (popup?.closed) {
          window.clearInterval(timer);
          queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
        }
      }, 500);
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível iniciar a conexão com o Gmail.'));
    }
  };
}

export function useDisconnectGmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => api.delete('/gmail/disconnect'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gmail-status'] }),
  });
}

export function useMessages(quoteId: string) {
  return useQuery({
    queryKey: ['quote-messages', quoteId],
    queryFn: async () => {
      const { data } = await api.get<Message[]>(`/quotes/${quoteId}/messages`);
      return data;
    },
  });
}

export interface SendMessageInput {
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  attachmentIds?: string[];
}

export function useSendMessage(quoteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const { data } = await api.post<Message>(`/quotes/${quoteId}/messages`, input);
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['quote-messages', quoteId] }),
  });
}

export function useAttachments(quoteId: string) {
  return useQuery({
    queryKey: ['quote-attachments', quoteId],
    queryFn: async () => {
      const { data } = await api.get<Attachment[]>(`/quotes/${quoteId}/attachments`);
      return data;
    },
  });
}

export function useUploadAttachment(quoteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post<Attachment>(`/quotes/${quoteId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quote-attachments', quoteId] }),
  });
}

export async function downloadAttachment(quoteId: string, attachment: Attachment) {
  const { data } = await api.get(`/quotes/${quoteId}/attachments/${attachment.id}/download`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.fileName;
  link.click();
  URL.revokeObjectURL(url);
}
