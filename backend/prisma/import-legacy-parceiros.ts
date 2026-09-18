import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Importa o cadastro de Parceiros do sistema legado (`#/ParceirosSelecao/Menu`,
 * `pinho.rest/cadastro/obterTodosParceiros`) para `companies` (papel PARTNER).
 *
 * Roda **manualmente** — nunca automatizado — a partir de um arquivo JSON extraído
 * por leitura real das respostas da tela (nunca por chamada direta ao legado a
 * partir daqui, ver CLAUDE.md § Trabalho no sistema legado). O arquivo não é
 * commitado (contém CNPJ/endereço/telefone reais) — ver `.gitignore`.
 *
 * Uso:
 *   npm run import:legacy-parceiros -- caminho/para/legacy-parceiros.json
 *   npm run import:legacy-parceiros   # usa prisma/data/legacy-parceiros.json
 */

interface LegacyParceiro {
  id: { cdParceiro: number };
  nuCnpj?: string;
  deRazaoSocial?: string;
  deNomeFantasia?: string;
  deEndereco?: string;
  deComplemento?: string;
  deSite?: string;
  deEmail?: string;
  nuTelefone?: string;
  nuFax?: string;
  nuCep?: string;
  nuDddTelefone?: string;
  nuDddFax?: string;
  dePais?: string;
  deEstado?: string;
  deCidade?: string;
}

const clean = (v: string | null | undefined): string | null => {
  const trimmed = v?.trim();
  return trimmed ? trimmed : null;
};

/** Dígito verificador de CNPJ (mod-11, dois dígitos). */
function isValidCnpj(digits: number[]): boolean {
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
function isValidCpf(digits: number[]): boolean {
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
function normalizeDocument(raw: string | null | undefined): string | null {
  const digitsStr = (raw ?? '').replace(/\D/g, '');
  const digits = digitsStr.split('').map(Number);
  if (isValidCnpj(digits) || isValidCpf(digits)) return digitsStr;
  return null;
}

/**
 * Alguns registros do legado (12 dos 287, todos com nome de pessoa física e CNPJ
 * placeholder — um deles é a própria funcionária da Pinho, "Bruna Pietra Appi",
 * ver docs/05-cadastros.md) não têm nenhum dado de endereço: são lançamentos de
 * teste, não parceiros de verdade. Diferente de casos como "Savino Del Bene" ou
 * "Masterport", que são empresas reais só com o CNPJ mal digitado no legado —
 * esses têm endereço/cidade preenchidos e continuam sendo importados (sem CNPJ).
 */
function looksLikeRealRecord(record: LegacyParceiro): boolean {
  return Boolean(clean(record.deEndereco) || clean(record.deCidade));
}

function formatPhone(ddd: string | null | undefined, number: string | null | undefined): string | null {
  const cleanNumber = clean(number);
  if (!cleanNumber) return null;
  const cleanDdd = clean(ddd)?.replace(/\D/g, '');
  return cleanDdd ? `(${cleanDdd}) ${cleanNumber}` : cleanNumber;
}

async function main() {
  const path = resolve(process.cwd(), process.argv[2] ?? 'prisma/data/legacy-parceiros.json');
  const records: LegacyParceiro[] = JSON.parse(readFileSync(path, 'utf8'));
  console.log(`Lidos ${records.length} parceiros de ${path}`);

  let created = 0;
  let updated = 0;
  let skippedInvalidDoc = 0;
  let skippedJunk = 0;

  for (const record of records) {
    const legalName = clean(record.deRazaoSocial);
    if (!legalName) {
      console.warn(`  ⚠ parceiro #${record.id.cdParceiro} sem razão social — ignorado.`);
      continue;
    }

    const document = normalizeDocument(record.nuCnpj);

    if (!document && !looksLikeRealRecord(record)) {
      console.warn(
        `  ⚠ parceiro #${record.id.cdParceiro} "${legalName}" sem CNPJ válido e sem endereço ` +
          `— parece lançamento de teste, não importado.`,
      );
      skippedJunk++;
      continue;
    }
    if (!document) skippedInvalidDoc++;

    const data = {
      legalName,
      tradeName: clean(record.deNomeFantasia),
      email: clean(record.deEmail),
      phone: formatPhone(record.nuDddTelefone, record.nuTelefone),
      zipCode: clean(record.nuCep),
      address: clean(record.deEndereco),
      district: clean(record.deComplemento),
      cityName: clean(record.deCidade),
      stateName: clean(record.deEstado),
      countryName: clean(record.dePais),
      // Flag "Ativo" do legado não é confiável — todo o cadastro vem marcado como
      // inativo mesmo para parceiros correntes (ver docs/05-cadastros.md), então
      // trazemos tudo como ativo e deixa o operador desativar manualmente.
      active: true,
      notes: `Importado do legado (Parceiro #${record.id.cdParceiro}).`,
    };

    let company;
    if (document) {
      const existing = await prisma.company.findUnique({ where: { document } });
      company = await prisma.company.upsert({
        where: { document },
        update: data,
        create: { ...data, document },
      });
      existing ? updated++ : created++;
    } else {
      // Sem CNPJ confiável: evita duplicar em reexecuções comparando por nome.
      const existing = await prisma.company.findFirst({
        where: { legalName, document: null },
      });
      company = existing
        ? await prisma.company.update({ where: { id: existing.id }, data })
        : await prisma.company.create({ data });
      existing ? updated++ : created++;
    }

    await prisma.companyRole.upsert({
      where: { companyId_role: { companyId: company.id, role: 'PARTNER' } },
      update: {},
      create: { companyId: company.id, role: 'PARTNER' },
    });
  }

  console.log(
    `\nCriados: ${created} · Atualizados: ${updated} · ` +
      `Sem CNPJ válido (importados mesmo assim): ${skippedInvalidDoc} · ` +
      `Ignorados por parecer teste: ${skippedJunk}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
