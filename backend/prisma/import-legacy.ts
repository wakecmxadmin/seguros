import { existsSync } from 'fs';
import { resolve } from 'path';
import { CompanyRoleType, PrismaClient } from '@prisma/client';
import { ImportStats } from './legacy/helpers';
import { importCompanies } from './legacy/companies';
import { importCoverages, importPolicies } from './legacy/policies';
import { importCommodityTypes, importEmployees, importVessels } from './legacy/catalog';

/**
 * Importa os **cadastros** do sistema legado ("Coomex Hub" / pinhoV2) para o
 * banco do projeto. Só cadastros — histórico de transações permanece no legado
 * (tarefa 51).
 *
 * Roda **manualmente**, nunca automatizado, a partir de arquivos JSON extraídos
 * por leitura real das telas autenticadas — nunca por chamada direta à API do
 * legado a partir daqui (ver CLAUDE.md § Trabalho no sistema legado). Os
 * arquivos ficam em `prisma/data/` e não são commitados: contêm CNPJ, endereço
 * e telefone reais (ver `.gitignore`).
 *
 * Uso:
 *   npm run import:legacy -- clientes
 *   npm run import:legacy -- clientes seguradoras apolices
 *   npm run import:legacy -- all
 *   npm run import:legacy -- --list
 */

const prisma = new PrismaClient();

interface Importer {
  /** Rótulo em português, para o relatório. */
  label: string;
  /** Arquivo esperado em `prisma/data/`. */
  file: string;
  run: (path: string) => Promise<ImportStats>;
}

const IMPORTERS: Record<string, Importer> = {
  clientes: {
    label: 'Clientes',
    file: 'prisma/data/legacy-clientes.json',
    run: (path) => importCompanies(prisma, CompanyRoleType.CLIENT, path),
  },
  parceiros: {
    label: 'Parceiros',
    file: 'prisma/data/legacy-parceiros.json',
    run: (path) => importCompanies(prisma, CompanyRoleType.PARTNER, path),
  },
  seguradoras: {
    label: 'Seguradoras',
    file: 'prisma/data/legacy-seguradoras.json',
    run: (path) => importCompanies(prisma, CompanyRoleType.INSURER, path),
  },
  transportadoras: {
    label: 'Transportadoras',
    file: 'prisma/data/legacy-transportadoras.json',
    run: (path) => importCompanies(prisma, CompanyRoleType.CARRIER, path),
  },
  vistoriadores: {
    label: 'Vistoriadores',
    file: 'prisma/data/legacy-vistoriadores.json',
    run: (path) => importCompanies(prisma, CompanyRoleType.SURVEYOR, path),
  },
  apolices: {
    label: 'Apólices',
    file: 'prisma/data/legacy-apolices.json',
    run: (path) => importPolicies(prisma, path),
  },
  coberturas: {
    label: 'Coberturas',
    file: 'prisma/data/legacy-coberturas.json',
    run: (path) => importCoverages(prisma, path),
  },
  funcionarios: {
    label: 'Funcionários',
    file: 'prisma/data/legacy-funcionarios.json',
    run: (path) => importEmployees(prisma, path),
  },
  mercadorias: {
    label: 'Mercadorias',
    file: 'prisma/data/legacy-mercadorias.json',
    run: (path) => importCommodityTypes(prisma, path),
  },
  navios: {
    label: 'Navios',
    file: 'prisma/data/legacy-navios.json',
    run: (path) => importVessels(prisma, path),
  },
};

/**
 * Ordem de execução do `all`. Empresas primeiro: apólices dependem da
 * seguradora já existir.
 */
const ALL_ORDER = [
  'clientes',
  'parceiros',
  'seguradoras',
  'transportadoras',
  'vistoriadores',
  'apolices',
  'coberturas',
  'funcionarios',
  'mercadorias',
  'navios',
];

function usage(): void {
  console.log('Cadastros disponíveis:\n');
  for (const [key, importer] of Object.entries(IMPORTERS)) {
    const path = resolve(process.cwd(), importer.file);
    const mark = existsSync(path) ? '✓' : '·';
    console.log(`  ${mark} ${key.padEnd(18)} ${importer.label.padEnd(18)} ${importer.file}`);
  }
  console.log('\n  ✓ = arquivo de extração presente   · = ainda não extraído');
  console.log('\nUso: npm run import:legacy -- <cadastro> [<cadastro>…]   |   -- all');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== '--');

  if (args.length === 0 || args.includes('--list') || args.includes('--help')) {
    usage();
    return;
  }

  const requested = args.includes('all') ? ALL_ORDER : args;
  const unknown = requested.filter((name) => !IMPORTERS[name]);
  if (unknown.length > 0) {
    console.error(`Cadastro desconhecido: ${unknown.join(', ')}\n`);
    usage();
    process.exitCode = 1;
    return;
  }

  const totals: ImportStats = { created: 0, updated: 0, skipped: 0 };
  const missing: string[] = [];

  for (const name of requested) {
    const importer = IMPORTERS[name];
    const path = resolve(process.cwd(), importer.file);
    if (!existsSync(path)) {
      // No `all`, um cadastro ainda não extraído não é erro — só não roda.
      if (args.includes('all')) {
        missing.push(`${importer.label} (${importer.file})`);
        continue;
      }
      console.error(`Arquivo não encontrado: ${path}`);
      process.exitCode = 1;
      return;
    }
    const stats = await importer.run(importer.file);
    totals.created += stats.created;
    totals.updated += stats.updated;
    totals.skipped += stats.skipped;
  }

  console.log(
    `\n═ Total: criados ${totals.created} · atualizados ${totals.updated} · ` +
      `ignorados ${totals.skipped}`,
  );
  if (missing.length > 0) {
    console.log(`\nNão extraídos ainda (pulados): ${missing.join(', ')}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
