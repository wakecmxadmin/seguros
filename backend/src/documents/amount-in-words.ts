/**
 * Valor por extenso em português, para o recibo. O legado recebia o extenso
 * pronto do servidor Java (`vlPremioOverRealExtenso`) — aqui é feito no domínio.
 *
 *   1234,56 → "mil duzentos e trinta e quatro reais e cinquenta e seis centavos"
 */

const UNITS = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete',
  'dezoito', 'dezenove',
];
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const HUNDREDS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos',
  'setecentos', 'oitocentos', 'novecentos',
];

/** 0–999 por extenso ("" para zero). */
function hundreds(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest) {
    if (rest < 20) parts.push(UNITS[rest]);
    else {
      const t = Math.floor(rest / 10);
      const u = rest % 10;
      parts.push(u ? `${TENS[t]} e ${UNITS[u]}` : TENS[t]);
    }
  }
  return parts.join(' e ');
}

const SCALES: [singular: string, plural: string][] = [
  ['', ''],
  ['mil', 'mil'],
  ['milhão', 'milhões'],
  ['bilhão', 'bilhões'],
];

/** Inteiro por extenso ("zero" para 0). */
export function integerInWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'zero';

  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }

  const words: { text: string; value: number }[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    let text: string;
    if (i === 1) text = g === 1 ? 'mil' : `${hundreds(g)} mil`;
    else if (i > 1) text = `${hundreds(g)} ${g === 1 ? SCALES[i][0] : SCALES[i][1]}`;
    else text = hundreds(g);
    words.push({ text, value: g });
  }

  // Regra do "e": entre grupos só quando o último grupo é < 100 ou centena
  // redonda ("mil e cem", "mil e vinte", mas "mil duzentos e trinta").
  return words
    .map((w, i) => {
      if (i === 0) return w.text;
      const isLast = i === words.length - 1;
      const joinWithE = isLast && (w.value < 100 || w.value % 100 === 0);
      return `${joinWithE ? 'e ' : ''}${w.text}`;
    })
    .join(' ');
}

/** Valor monetário em reais por extenso. */
export function amountInWords(value: number): string {
  const cents = Math.round(Math.abs(value) * 100);
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;

  const parts: string[] = [];
  if (reais > 0) {
    const words = integerInWords(reais);
    // "um milhão de reais", "dois milhões de reais" — mas "mil reais".
    const de = reais % 1_000_000 === 0 ? ' de' : '';
    parts.push(`${words}${de} ${reais === 1 ? 'real' : 'reais'}`);
  }
  if (centavos > 0) {
    parts.push(`${integerInWords(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  }
  return parts.length ? parts.join(' e ') : 'zero real';
}
