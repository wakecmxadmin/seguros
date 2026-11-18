/**
 * Arredondamento monetário idêntico ao do legado.
 *
 * O servidor do legado (Java) arredonda "meio para cima" sobre o valor
 * **exato** do double — como `new BigDecimal(double).setScale(2, HALF_UP)`.
 * Por isso 55,55 × 0,30 (que em binário é 16,66499999…) vira 16,66, e não
 * 16,67 como daria um arredondamento decimal "ideal".
 *
 * Conferido em 18/11/2026 contra 700 numerários pagos do legado: com
 * `valor × (percentual / 100)` e esta função, a comissão bate em 698/700 e o
 * prêmio de custo da seguradora em 700/700 (docs/19, rodada 2). Os dois
 * casos restantes já divergiam no próprio legado.
 *
 * Use sempre a forma `valor * (pct / 100)` — a ordem das operações muda o
 * double e, portanto, o arredondamento.
 */
export function roundHalfUpExact(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return -roundHalfUpExact(-value, digits);

  // toFixed(20) expõe a expansão decimal do double sem arredondar na 3ª casa.
  const [intPart, decPart = ''] = value.toFixed(20).split('.');
  let scaled = BigInt(intPart + decPart.slice(0, digits).padEnd(digits, '0'));
  if (decPart.charCodeAt(digits) >= 53 /* '5' */) scaled += BigInt(1);

  return Number(scaled) / 10 ** digits;
}

/** Valor monetário em 2 casas, com a regra do legado. */
export const money = (value: number) => roundHalfUpExact(value, 2);

/** Aplica um percentual: `valor × (pct / 100)`, na ordem que o legado usa. */
export const percentOf = (value: number, percent: number) => value * (percent / 100);
