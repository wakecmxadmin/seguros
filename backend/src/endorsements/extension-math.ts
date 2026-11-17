/**
 * Valores de uma prorrogação. Função pura para testar sem banco.
 *
 * Regra do legado, conferida em 35 numerários: prorrogação do cliente =
 * round2(prêmio do cliente × 20 %). O lado da seguradora segue o mesmo
 * percentual (`vlProrrogadaSeguradoraDolar` não tinha fórmula visível).
 */
export function extensionFigures(input: {
  premiumClient: number;
  premiumInsurer: number;
  percent: number;
  exchangeRate: number;
}) {
  const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
  const premiumClient = round2((input.premiumClient * input.percent) / 100);
  const premiumInsurer = round2((input.premiumInsurer * input.percent) / 100);
  return {
    premiumClient,
    premiumInsurer,
    // Mesma regra do resto do sistema: R$ = valor já arredondado × taxa.
    premiumClientBrl: round2(premiumClient * input.exchangeRate),
  };
}
