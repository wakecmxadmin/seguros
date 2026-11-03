import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Utilitários compartilhados pelos importadores de cadastro do sistema legado
 * ("Coomex Hub" / pinhoV2). Ver `prisma/import-legacy.ts`.
 */

export const clean = (v: string | null | undefined): string | null => {
  const trimmed = v?.trim();
  return trimmed ? trimmed : null;
};

/** Dígito verificador de CNPJ (mod-11, dois dígitos). */
export function isValidCnpj(digits: number[]): boolean {
  if (digits.length !== 14 || new Set(digits).size === 1) return false;
  const calc = (nums: number[], weights: number[]) => {
    const sum = nums.reduce((acc, n, i) => acc + n * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  if (calc(digits.slice(0, 12), w1) !== digits[12]) return false;
  return calc(digits.slice(0, 13), w2) === digits[13];
}

/** Dígito verificador de CPF (mod-11, dois dígitos). */
export function isValidCpf(digits: number[]): boolean {
  if (digits.length !== 11 || new Set(digits).size === 1) return false;
  const calc = (nums: number[], factor: number) => {
    const sum = nums.reduce((acc, n, i) => acc + n * (factor - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  if (calc(digits.slice(0, 9), 10) !== digits[9]) return false;
  return calc(digits.slice(0, 10), 11) === digits[10];
}

/**
 * CNPJ/CPF só com dígitos, validado por dígito verificador real — não basta contar
 * dígitos: o cadastro legado tem placeholders como "00000000000"/"1111111111" que
 * têm a quantidade certa de dígitos mas não são documentos de verdade.
 */
export function normalizeDocument(raw: string | null | undefined): string | null {
  const digitsStr = (raw ?? '').replace(/\D/g, '');
  const digits = digitsStr.split('').map(Number);
  if (isValidCnpj(digits) || isValidCpf(digits)) return digitsStr;
  return null;
}

export function formatPhone(
  ddd: string | null | undefined,
  number: string | null | undefined,
): string | null {
  const cleanNumber = clean(number);
  if (!cleanNumber) return null;
  const cleanDdd = clean(ddd)?.replace(/\D/g, '');
  return cleanDdd ? `(${cleanDdd}) ${cleanNumber}` : cleanNumber;
}

/**
 * Número vindo do legado. Chega ora como `number`, ora como string com vírgula
 * decimal ("0,10"), ora com separador de milhar ("4.000.000,00").
 */
export function toNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text) return null;
  // "1.234,56" (pt-BR) vs "1234.56" (ponto decimal puro).
  const normalized =
    text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/\s/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Data do legado (`"2026-03-13"`, `"13/03/2026"` ou epoch em ms). */
export function toDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (brazilian) {
    return new Date(`${brazilian[3]}-${brazilian[2]}-${brazilian[1]}T00:00:00.000Z`);
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Lê um arquivo de extração do legado. Os arquivos ficam em `prisma/data/` e
 * **não** são commitados (contêm CNPJ/endereço/telefone reais) — ver `.gitignore`.
 *
 * Aceita tanto um array puro quanto o envelope de paginação do legado
 * (`{ registros: [...] }`), e também uma lista de envelopes (uma por página).
 */
export function readLegacyFile<T>(path: string): T[] {
  const full = resolve(process.cwd(), path);
  const parsed: unknown = JSON.parse(readFileSync(full, 'utf8'));
  const records = flattenLegacy<T>(parsed);
  if (!records) {
    throw new Error(
      `Formato não reconhecido em ${full} — esperado um array, ` +
        `um envelope { registros: [...] } ou uma lista de envelopes.`,
    );
  }
  return records;
}

function flattenLegacy<T>(parsed: unknown): T[] | null {
  if (Array.isArray(parsed)) {
    // Lista de envelopes de paginação (uma entrada por página capturada).
    if (parsed.length > 0 && parsed.every((p) => isEnvelope(p))) {
      return parsed.flatMap((p) => (p as { registros: T[] }).registros);
    }
    return parsed as T[];
  }
  if (isEnvelope(parsed)) return (parsed as { registros: T[] }).registros;
  return null;
}

function isEnvelope(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { registros?: unknown }).registros)
  );
}

/** Contadores que cada importador devolve, para o relatório final. */
export interface ImportStats {
  created: number;
  updated: number;
  skipped: number;
}

export const emptyStats = (): ImportStats => ({ created: 0, updated: 0, skipped: 0 });
