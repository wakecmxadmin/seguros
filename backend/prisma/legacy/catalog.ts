import { PrismaClient } from '@prisma/client';
import { clean, emptyStats, ImportStats, readLegacyFile } from './helpers';

/**
 * Importa Funcionários, Mercadorias ("meremb") e Navios do legado.
 */

interface LegacyEmployee {
  id?: { cdFuncionario?: number };
  deFuncionario?: string;
  deSetor?: string;
  deFuncao?: string;
  deEmail?: string;
  flStatus?: number;
}

interface LegacyCommodity {
  id?: { cdMercadoria?: number };
  /** O "Código da meremb" que aparece na tela. */
  cdMercadoriaEmbalagem?: string;
  deMercadoria?: string;
  vlMaritimo?: number;
  vlAereo?: number;
  vlTerrestre?: number;
  cdFranquia?: number;
}

interface LegacyVessel {
  id?: { cdNavio?: number };
  deNavio?: string;
  vlClassificacao?: number;
}

function nameKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export async function importEmployees(prisma: PrismaClient, path: string): Promise<ImportStats> {
  const records = readLegacyFile<LegacyEmployee>(path);
  console.log(`\n▸ Funcionários: ${records.length} registros lidos de ${path}`);

  const stats = emptyStats();

  for (const record of records) {
    const name = clean(record.deFuncionario);
    const legacyCode = record.id?.cdFuncionario;
    if (!name || legacyCode === undefined || legacyCode === null) {
      stats.skipped++;
      continue;
    }

    const data = {
      name,
      email: clean(record.deEmail),
      department: clean(record.deSetor),
      jobTitle: clean(record.deFuncao),
      // Aqui a flag é confiável: os 4 registros vêm com flStatus 1 (ativo).
      active: record.flStatus !== 0,
      legacyCode: String(legacyCode),
    };

    const existing =
      (await prisma.employee.findUnique({ where: { legacyCode: String(legacyCode) } })) ??
      (await prisma.employee.findFirst({ where: { name, legacyCode: null } }));

    if (existing) {
      await prisma.employee.update({ where: { id: existing.id }, data });
      stats.updated++;
    } else {
      await prisma.employee.create({ data });
      stats.created++;
    }
  }

  console.log(
    `  Funcionários: criados ${stats.created} · atualizados ${stats.updated} · ignorados ${stats.skipped}`,
  );
  return stats;
}

export async function importCommodityTypes(
  prisma: PrismaClient,
  path: string,
): Promise<ImportStats> {
  const records = readLegacyFile<LegacyCommodity>(path);
  console.log(`\n▸ Mercadorias: ${records.length} registros lidos de ${path}`);

  const stats = emptyStats();
  const existing = await prisma.commodityType.findMany();
  const byName = new Map(existing.map((c) => [nameKey(c.name), c]));

  for (const record of records) {
    const name = clean(record.deMercadoria);
    const code = clean(record.cdMercadoriaEmbalagem);
    if (!name || !code) {
      stats.skipped++;
      continue;
    }

    // Taxas e franquia do legado estão zeradas/genéricas — só aplicamos quando
    // há valor real, para não apagar o catálogo curado (tarefa 19).
    const rates = {
      ...(record.vlMaritimo ? { seaRoadRate: record.vlMaritimo } : {}),
      ...(record.vlAereo ? { airRate: record.vlAereo } : {}),
      ...(record.cdFranquia ? { deductible: record.cdFranquia } : {}),
    };

    const match = byName.get(nameKey(name)) ?? (await prisma.commodityType.findUnique({ where: { code } }));
    if (match) {
      await prisma.commodityType.update({ where: { id: match.id }, data: rates });
      stats.updated++;
      continue;
    }

    await prisma.commodityType.create({ data: { code, name, ...rates } });
    stats.created++;
  }

  console.log(
    `  Mercadorias: criadas ${stats.created} · atualizadas ${stats.updated} · ignoradas ${stats.skipped}`,
  );
  return stats;
}

export async function importVessels(prisma: PrismaClient, path: string): Promise<ImportStats> {
  const records = readLegacyFile<LegacyVessel>(path);
  console.log(`\n▸ Navios: ${records.length} registros lidos de ${path}`);

  const stats = emptyStats();
  let comClassificacao = 0;

  for (const record of records) {
    // Os nomes vêm cheios de espaços no legado (" AALDERDIJK  ").
    const name = clean(record.deNavio);
    const legacyCode = record.id?.cdNavio;
    if (!name || legacyCode === undefined || legacyCode === null) {
      stats.skipped++;
      continue;
    }

    // `vlClassificacao` (adicional por classificação da embarcação) está
    // preenchido em apenas 4 dos 1.357 navios e não tem campo equivalente —
    // fica registrado para não se perder.
    const classificacao = record.vlClassificacao;
    const temClassificacao = typeof classificacao === 'number' && classificacao !== 0;
    if (temClassificacao) comClassificacao++;

    const data = {
      name,
      active: true,
      legacyCode: String(legacyCode),
    };

    const existing =
      (await prisma.vessel.findUnique({ where: { legacyCode: String(legacyCode) } })) ??
      (await prisma.vessel.findFirst({ where: { name, legacyCode: null } }));

    if (existing) {
      await prisma.vessel.update({ where: { id: existing.id }, data });
      stats.updated++;
    } else {
      await prisma.vessel.create({ data });
      stats.created++;
    }

    if (temClassificacao) {
      console.warn(
        `  ⚠ navio "${name}" (#${legacyCode}) tem classificação ${classificacao} no legado — ` +
          `sem campo equivalente aqui, registrar manualmente se for relevante.`,
      );
    }
  }

  console.log(
    `  Navios: criados ${stats.created} · atualizados ${stats.updated} · ` +
      `ignorados ${stats.skipped} · com classificação no legado ${comClassificacao}`,
  );
  return stats;
}
