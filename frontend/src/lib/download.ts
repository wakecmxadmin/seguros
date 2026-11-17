import { api, errorMessage } from './api';

/**
 * Baixa um arquivo gerado pelo backend. Em erro, a mensagem vem dentro do
 * Blob (o axios não a decodifica com `responseType: 'blob'`), então é lida aqui
 * e relançada como `Error` com o texto do backend.
 */
export async function downloadFile(
  url: string,
  params: Record<string, unknown> | undefined,
  fallbackName: string,
  fallbackError = 'Não foi possível gerar o arquivo.',
) {
  try {
    const response = await api.get(url, { params, responseType: 'blob' });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
    const href = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(href);
    return response;
  } catch (error) {
    let message = errorMessage(error, fallbackError);
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text()).message;
        message = (Array.isArray(parsed) ? parsed[0] : parsed) ?? message;
      } catch {
        /* mantém a mensagem genérica */
      }
    }
    throw new Error(message);
  }
}
