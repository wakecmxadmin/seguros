import { CompanyRoleType, Prisma, PrismaClient } from '@prisma/client';
import {
  clean,
  emptyStats,
  formatPhone,
  ImportStats,
  normalizeDocument,
  readLegacyFile,
} from './helpers';

/**
 * Importa os cadastros de pessoa jurídica do legado — Clientes, Parceiros,
 * Seguradoras, Transportadoras e Vistoriadores — para `companies`.
 *
 * No legado são **cinco cadastros separados**, cada um com seu próprio código
 * (`cdCliente`, `cdParceiro`, `cdSeguradora`…). Aqui todos viram a mesma
 * `Company`, deduplicada por CNPJ, ganhando um `CompanyRole` por papel — que é
 * onde o código legado é guardado (ver `CompanyRole.legacyCode` no schema).
 * É assim que a Fidcargo deixa de existir duas vezes.
 */

/** Todos os cadastros de empresa do legado compartilham esta forma. */
export interface LegacyCompany {
  id?: Record<string, number>;
  nuCnpj?: string;
  nuCpf?: string;
  deRazaoSocial?: string;
  deNomeFantasia?: string;
  deEndereco?: string;
  deComplemento?: string;
  deBairro?: string;
  deSite?: string;
  deEmail?: string;
  nuTelefone?: string;
  nuCelular?: string;
  nuFax?: string;
  nuCep?: string;
  nuDddTelefone?: string;
  nuDddCelular?: string;
  nuDddFax?: string;
  nuInscricaoEstadual?: string;
  deInscricaoEstadual?: string;
  dePais?: string;
  deEstado?: string;
  deCidade?: string;
  /// Só no cadastro de Clientes — piso de prêmio negociado (ver tarefas 7 e 36).
  vlPremioMinimoCliente?: number;
  /// Só no cadastro de Seguradoras — taxa negociada e imposto (IOF?).
  txNegociada?: number;
  txImposto?: number;
  [key: string]: unknown;
}

const ROLE_LABEL: Record<CompanyRoleType, string> = {
  CLIENT: 'Cliente',
  PARTNER: 'Parceiro',
  INSURER: 'Seguradora',
  CARRIER: 'Transportadora',
  SURVEYOR: 'Vistoriador',
};

/** Código do registro no legado — a chave dentro de `id` muda de cadastro para cadastro. */
function legacyCodeOf(record: LegacyCompany): string | null {
  const id = record.id;
  if (!id || typeof id !== 'object') return null;
  const entry = Object.entries(id).find(([key]) => key.startsWith('cd'));
  return entry && entry[1] !== null && entry[1] !== undefined ? String(entry[1]) : null;
}

/**
 * Alguns registros do legado (12 dos 287 parceiros, todos com nome de pessoa
 * física e CNPJ placeholder — um deles é a própria funcionária da Pinho,
 * "Bruna Pietra Appi", ver docs/05-cadastros.md) não têm nenhum dado de
 * endereço: são lançamentos de teste, não empresas de verdade. Diferente de
 * casos como "Savino Del Bene" ou "Masterport", que são empresas reais só com o
 * CNPJ mal digitado no legado — esses têm endereço/cidade e continuam entrando.
 */
function looksLikeRealRecord(record: LegacyCompany): boolean {
  return Boolean(clean(record.deEndereco) || clean(record.deCidade));
}

/** Nome reduzido a letras e dígitos, para flagrar duplicata provável. */
function nameKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export async function importCompanies(
  prisma: PrismaClient,
  role: CompanyRoleType,
  path: string,
): Promise<ImportStats> {
  const records = readLegacyFile<LegacyCompany>(path);
  const label = ROLE_LABEL[role];
  console.log(`\n▸ ${label}: ${records.length} registros lidos de ${path}`);

  const stats = emptyStats();
  let withoutDocument = 0;
  let comPremioMinimo = 0;
  const seenNames = new Map<string, string>();

  for (const record of records) {
    const legalName = clean(record.deRazaoSocial);
    const legacyCode = legacyCodeOf(record);

    if (!legalName) {
      console.warn(`  ⚠ #${legacyCode ?? '?'} sem razão social — ignorado.`);
      stats.skipped++;
      continue;
    }

    // Registro sentinela "0" que encabeça as listagens do legado.
    if (legacyCode === '0' && !looksLikeRealRecord(record)) {
      stats.skipped++;
      continue;
    }

    const document = normalizeDocument(record.nuCnpj ?? record.nuCpf);

    if (!document && !looksLikeRealRecord(record)) {
      console.warn(
        `  ⚠ #${legacyCode ?? '?'} "${legalName}" sem CNPJ válido e sem endereço ` +
          `— parece lançamento de teste, não importado.`,
      );
      stats.skipped++;
      continue;
    }
    if (!document) withoutDocument++;

    const key = nameKey(legalName);
    const twin = seenNames.get(key);
    if (twin && twin !== legacyCode) {
      console.warn(
        `  ⚠ #${legacyCode} "${legalName}" tem o mesmo nome de #${twin} ` +
          `— possível duplicata no legado, importada como registro separado (CNPJ difere).`,
      );
    }
    seenNames.set(key, legacyCode ?? key);

    const data: Prisma.CompanyUncheckedCreateInput = {
      legalName,
      tradeName: clean(record.deNomeFantasia),
      stateReg: clean(record.nuInscricaoEstadual ?? record.deInscricaoEstadual),
      email: clean(record.deEmail),
      phone: formatPhone(record.nuDddTelefone, record.nuTelefone),
      mobile: formatPhone(record.nuDddCelular, record.nuCelular),
      zipCode: clean(record.nuCep),
      address: clean(record.deEndereco),
      district: clean(record.deBairro ?? record.deComplemento),
      cityName: clean(record.deCidade),
      stateName: clean(record.deEstado),
      countryName: clean(record.dePais),
      // Flag "Ativo" do legado não é confiável — todo o cadastro vem marcado como
      // inativo mesmo para empresas correntes (ver docs/05-cadastros.md), então
      // trazemos tudo como ativo e deixa o operador desativar manualmente.
      active: true,
    };

    const minimo = record.vlPremioMinimoCliente;
    if (typeof minimo === 'number' && minimo > 0) {
      data.minimumPremium = minimo;
      comPremioMinimo++;
    }

    // `txNegociada`/`txImposto` só existem no cadastro de Seguradoras e não têm
    // campo equivalente aqui — a semântica exata ainda não foi confirmada com o
    // cliente. Preservamos o valor em observações para não perder o dado.
    const taxas: string[] = [];
    if (typeof record.txNegociada === 'number' && record.txNegociada > 0) {
      taxas.push(`taxa negociada ${record.txNegociada.toFixed(4)}`);
    }
    if (typeof record.txImposto === 'number' && record.txImposto > 0) {
      taxas.push(`imposto ${record.txImposto.toFixed(4)}`);
    }
    if (taxas.length > 0) {
      data.notes = `Legado (${label} #${legacyCode}): ${taxas.join(' · ')}. Confirmar semântica.`;
    }

    const company = await upsertCompany(prisma, { data, document, legalName, role, legacyCode });
    company.wasCreated ? stats.created++ : stats.updated++;

    await linkRole(prisma, company.id, role, legacyCode, legalName);
  }

  console.log(
    `  ${label}: criados ${stats.created} · atualizados ${stats.updated} · ` +
      `ignorados ${stats.skipped} · sem CNPJ válido (importados mesmo assim) ${withoutDocument}` +
      (comPremioMinimo > 0 ? ` · com prêmio mínimo ${comPremioMinimo}` : ''),
  );
  return stats;
}

interface UpsertArgs {
  data: Prisma.CompanyUncheckedCreateInput;
  document: string | null;
  legalName: string;
  role: CompanyRoleType;
  legacyCode: string | null;
}

/**
 * Localiza a empresa, nesta ordem: pelo papel + código legado (reexecução),
 * pelo CNPJ (dedupe entre cadastros — é o que funde a Fidcargo) e, em último
 * caso, pela razão social exata sem CNPJ.
 */
async function upsertCompany(
  prisma: PrismaClient,
  { data, document, legalName, role, legacyCode }: UpsertArgs,
): Promise<{ id: string; wasCreated: boolean }> {
  if (legacyCode) {
    const byLegacy = await prisma.companyRole.findUnique({
      where: { role_legacyCode: { role, legacyCode } },
      select: { companyId: true },
    });
    if (byLegacy) {
      await prisma.company.update({
        where: { id: byLegacy.companyId },
        data: { ...data, document: document ?? undefined },
      });
      return { id: byLegacy.companyId, wasCreated: false };
    }
  }

  if (document) {
    const existing = await prisma.company.findUnique({ where: { document } });
    if (existing) {
      await prisma.company.update({ where: { id: existing.id }, data });
      return { id: existing.id, wasCreated: false };
    }
    const created = await prisma.company.create({ data: { ...data, document } });
    return { id: created.id, wasCreated: true };
  }

  const existing = await prisma.company.findFirst({ where: { legalName, document: null } });
  if (existing) {
    await prisma.company.update({ where: { id: existing.id }, data });
    return { id: existing.id, wasCreated: false };
  }
  const created = await prisma.company.create({ data });
  return { id: created.id, wasCreated: true };
}

/**
 * Vincula o papel e grava o código legado. Quando duas fichas do **mesmo**
 * cadastro legado colapsam na mesma empresa (duplicata por CNPJ repetido, como
 * o "Bradesco" cadastrado como seguradora 1 e 4), só cabe um código no papel:
 * mantemos o primeiro e registramos o outro em `notes`, para não perder a
 * rastreabilidade nem escolher silenciosamente por conta própria.
 */
async function linkRole(
  prisma: PrismaClient,
  companyId: string,
  role: CompanyRoleType,
  legacyCode: string | null,
  legalName: string,
): Promise<void> {
  const current = await prisma.companyRole.findUnique({
    where: { companyId_role: { companyId, role } },
  });

  if (!current) {
    await prisma.companyRole.create({ data: { companyId, role, legacyCode } });
    return;
  }
  if (!current.legacyCode) {
    await prisma.companyRole.update({
      where: { companyId_role: { companyId, role } },
      data: { legacyCode },
    });
    return;
  }
  if (current.legacyCode === legacyCode || !legacyCode) return;

  const note = `Também cadastrado no legado como ${ROLE_LABEL[role]} #${legacyCode}.`;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { notes: true },
  });
  if (!company?.notes?.includes(note)) {
    await prisma.company.update({
      where: { id: companyId },
      data: { notes: [company?.notes, note].filter(Boolean).join(' ') },
    });
  }
  console.warn(
    `  ⚠ "${legalName}" veio duplicado no cadastro de ${ROLE_LABEL[role]} ` +
      `(#${current.legacyCode} e #${legacyCode}, mesmo CNPJ) — fundidos em uma empresa só; ` +
      `o código extra ficou registrado nas observações.`,
  );
}
