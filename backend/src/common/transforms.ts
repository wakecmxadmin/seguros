import { Transform } from 'class-transformer';

/**
 * Converte string vazia em `undefined`, para que `@IsOptional()` funcione com
 * formulários — campos não preenchidos chegam como "" e não como ausentes.
 */
export const EmptyToUndefined = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value));
