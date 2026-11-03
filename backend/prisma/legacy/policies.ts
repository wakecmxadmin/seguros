import { PrismaClient, QuoteKind } from '@prisma/client';
import { clean, emptyStats, ImportStats, readLegacyFile, toNumber } from './helpers';

/**
 * Importa Apólices e Coberturas do legado.
 *
 * O caso mais marcante da tarefa 24: no legado a **taxa vive dentro do texto do
 * nome da apólice** ("AKAD - 0.10% - PROBEXA"). Aqui ela é extraída para campo
 * estruturado quando aparece de forma inequívoca (com `%`), e o nome original é
 * preservado na descrição.
 */

interface LegacyPolicy {
  id?: { nuApolice?: string };
  deApolice?: string;
  vlImportanciaSegurada?: number | string;
  cdCorretor?: number;
  cdSeguradora?: number;
  /** 0 = Importação, 1 = Exportação. */
  tpApolice?: number;
  flAtivo?: number;
}

interface LegacyCoverage {
  id?: { cdCobertura?: number };
  deCobertura?: string;
  flCoberturaUnica?: boolean;
  txSeguradora?: number;
  txCliente?: number;
  txSeguradoraAereo?: number;
  txClienteAereo?: number;
}

/**
 * Extrai a taxa embutida no nome, mas **só** quando vem marcada com `%` —
 * "AKAD - 0.10% - PROBEXA" dá 0,10. Nomes como "ACE - IMP - 29.28" têm um número
 * solto cujo significado não foi confirmado (não é percentual plausível de
 * seguro), e por isso são deixados de fora em vez de virar taxa errada.
 */
export function extractRate(description: string | null): number | null {
  if (!description) return null;
  const match = /(\d+(?:[.,]\d+)?)\s*%/.exec(description);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/** Nome reduzido a letras e dígitos, para casar com o catálogo já curado. */
function nameKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export async function importPolicies(prisma: PrismaClient, path: string): Promise<ImportStats> {
  const records = readLegacyFile<LegacyPolicy>(path);
  console.log(`\n▸ Apólices: ${records.length} registros lidos de ${path}`);

  const stats = emptyStats();
  let comTaxa = 0;
  let semSeguradora = 0;

  // Seguradoras pelo código do legado — precisam ter sido importadas antes.
  const insurerRoles = await prisma.companyRole.findMany({
    where: { role: 'INSURER', NOT: { legacyCode: null } },
    select: { companyId: true, legacyCode: true },
  });
  const insurerByLegacy = new Map(insurerRoles.map((r) => [r.legacyCode as string, r.companyId]));

  for (const record of records) {
    const number = clean(record.id?.nuApolice);
    const description = clean(record.deApolice);

    // Registro sentinela "0" que encabeça as listagens do legado.
    if (!number || number === '0' || !description) {
      stats.skipped++;
      continue;
    }

    const insurerId = insurerByLegacy.get(String(record.cdSeguradora ?? ''));
    if (!insurerId) {
      console.warn(
        `  ⚠ apólice ${number} "${description}" aponta para a seguradora #${record.cdSeguradora} ` +
          `que não existe no nosso cadastro — não importada.`,
      );
      semSeguradora++;
      stats.skipped++;
      continue;
    }

    const rate = extractRate(description);
    if (rate !== null) comTaxa++;

    const data = {
      number,
      description,
      kind: record.tpApolice === 1 ? QuoteKind.EXPORT : QuoteKind.IMPORT,
      insurerId,
      insuredLimit: toNumber(record.vlImportanciaSegurada) ?? 0,
      brokerCode: record.cdCorretor ? String(record.cdCorretor) : null,
      // A taxa extraída do nome entra como taxa do cliente: é o percentual que
      // aparece no nome comercial da apólice. **Confirmar com o cliente** se é
      // mesmo o lado do cliente ou o da seguradora.
      ...(rate !== null ? { baseRateClient: rate } : {}),
      // Flag "Ativo" do legado não é confiável (60 das 67 apólices vêm inativas,
      // incluindo as que estão em uso), então entram todas ativas.
      active: true,
      legacyCode: number,
    };

    const existing = await prisma.policy.findUnique({ where: { legacyCode: number } });
    if (existing) {
      await prisma.policy.update({ where: { id: existing.id }, data });
      stats.updated++;
    } else {
      // `@@unique([number, insurerId])` pode colidir com uma apólice cadastrada à mão.
      const twin = await prisma.policy.findFirst({ where: { number, insurerId } });
      if (twin) {
        await prisma.policy.update({ where: { id: twin.id }, data });
        stats.updated++;
      } else {
        await prisma.policy.create({ data });
        stats.created++;
      }
    }
  }

  console.log(
    `  Apólices: criadas ${stats.created} · atualizadas ${stats.updated} · ` +
      `ignoradas ${stats.skipped} (sem seguradora: ${semSeguradora}) · ` +
      `com taxa extraída do nome: ${comTaxa}`,
  );
  return stats;
}

export async function importCoverages(prisma: PrismaClient, path: string): Promise<ImportStats> {
  const records = readLegacyFile<LegacyCoverage>(path);
  console.log(`\n▸ Coberturas: ${records.length} registros lidos de ${path}`);

  const stats = emptyStats();

  // O catálogo curado (seed da tarefa 19) já tem as três ICC com o mesmo nome.
  const existing = await prisma.coverage.findMany();
  const byName = new Map(existing.map((c) => [nameKey(c.name), c]));

  for (const record of records) {
    const name = clean(record.deCobertura);
    const legacyCode = record.id?.cdCobertura;

    if (!name || legacyCode === undefined || legacyCode === null) {
      stats.skipped++;
      continue;
    }

    // As taxas do legado estão **todas zeradas** (ver docs/05-cadastros.md).
    // Só sobrescrevemos as nossas quando o legado traz um valor de verdade —
    // caso contrário o import apagaria o catálogo curado com zeros.
    const rates = {
      ...(record.txSeguradora ? { seaRateInsurer: record.txSeguradora } : {}),
      ...(record.txCliente ? { seaRateClient: record.txCliente } : {}),
      ...(record.txSeguradoraAereo ? { airRateInsurer: record.txSeguradoraAereo } : {}),
      ...(record.txClienteAereo ? { airRateClient: record.txClienteAereo } : {}),
    };

    const match = byName.get(nameKey(name));
    if (match) {
      await prisma.coverage.update({
        where: { id: match.id },
        data: { legacyCode: String(legacyCode), ...rates },
      });
      stats.updated++;
      continue;
    }

    await prisma.coverage.create({
      data: { name, legacyCode: String(legacyCode), ...rates },
    });
    stats.created++;
  }

  console.log(
    `  Coberturas: criadas ${stats.created} · vinculadas ao catálogo existente ${stats.updated} · ` +
      `ignoradas ${stats.skipped}`,
  );
  return stats;
}
