/** Formatação numérica pt-BR, seguindo o padrão do legado. */

export function formatMoney(value: number | string | null | undefined, digits = 2) {
  const n = Number(value ?? 0);
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Taxas têm 5 casas decimais, como na grade do legado. */
export function formatRate(value: number | string | null | undefined) {
  return formatMoney(value, 5);
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** Data e hora locais — usado em registros com horário relevante (ex.: mensagens enviadas). */
export function formatDateTime(value?: string | Date | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Converte "1.234,56" (digitado) para 1234.56. */
export function parseNumber(input: string): number {
  const clean = input.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}
