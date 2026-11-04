import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient, QuoteKind } from '@prisma/client';
import { clean, emptyStats, ImportStats, readLegacyFile } from './helpers';

/**
 * Importa os **Modelos de Proposta** do legado (`#/ModelosPropostaSelecao/Menu`,
 * endpoint `obterTodosModelosPropostas`).
 *
 * O cadastro legado só expõe o **nome** do arquivo; o binário `.docx` vem pelo
 * botão "Download modelo". Por isso o import roda em dois tempos:
 *
 *  1. metadados (sempre) — uma linha por versão, chave Tipo × Cobertura × versão;
 *  2. binário (quando disponível) — se existir `prisma/data/proposal-templates/<deArquivo>.docx`
 *     o conteúdo sobe para o S3 e a linha passa a ter `storageKey`.
 *
 * Rodar de novo depois de baixar os `.docx` completa o passo 2 sem duplicar nada.
 */

const TEMPLATE_DIR = 'prisma/data/proposal-templates';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface LegacyProposalTemplate {
  id?: { cdTipo?: string; cdCobertura?: string; dtVersao?: string };
  deArquivo?: string;
  flArquivoDisponivel?: boolean;
}

/** `cdTipo` do legado: 0 = Importação, 1 = Exportação (confirmado pelos nomes). */
const KIND_BY_LEGACY_CODE: Record<string, QuoteKind> = {
  '0': QuoteKind.IMPORT,
  '1': QuoteKind.EXPORT,
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * `dtVersao` chega no formato en-US do Java ("Jul 3, 2026, 12:00:01 AM").
 * Parse explícito para UTC: `new Date(...)` interpretaria no fuso local e, em
 * fuso positivo, a coluna `DATE` cairia no dia anterior.
 */
export function parseLegacyVersionDate(raw: string | null | undefined): Date | null {
  const text = clean(raw);
  if (!text) return null;
  const match = /^([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})/.exec(text);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Credenciais do S3 lidas direto do `.env` — o script roda fora do Nest. */
function readS3Env(): Record<string, string> | null {
  const envPath = resolve(process.cwd(), '.env');
  const env: Record<string, string> = {};
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  const keys = ['AWS_S3_BUCKET', 'AWS_S3_REGION', 'AWS_S3_ACCESS_KEY_ID', 'AWS_S3_SECRET_ACCESS_KEY'];
  const resolved: Record<string, string> = {};
  for (const key of keys) {
    const value = process.env[key] ?? env[key];
    if (!value) return null;
    resolved[key] = value;
  }
  return resolved;
}

export async function importProposalTemplates(
  prisma: PrismaClient,
  path: string,
): Promise<ImportStats> {
  const records = readLegacyFile<LegacyProposalTemplate>(path);
  console.log(`\n▸ Modelos de Proposta: ${records.length} registros lidos de ${path}`);

  const stats = emptyStats();

  // `cdCobertura` do legado → nossa Coverage, pelo `legacyCode` já gravado.
  const coverages = await prisma.coverage.findMany({
    where: { legacyCode: { not: null } },
    select: { id: true, legacyCode: true, name: true },
  });
  const coverageByLegacyCode = new Map(coverages.map((c) => [c.legacyCode!, c]));

  // O legado repete o mesmo `deArquivo` em versões diferentes (ex.: "MODELO PROP
  // IMP COB AMPLA A 2026 (1)" em 02/07 e 03/07). O arquivo baixado é sempre o da
  // tela, isto é, o da versão mais recente — associá-lo às anteriores atribuiria
  // a elas um conteúdo que não é o delas.
  const newestVersionByFileName = new Map<string, number>();
  for (const record of records) {
    const name = clean(record.deArquivo);
    const v = parseLegacyVersionDate(record.id?.dtVersao);
    if (!name || !v) continue;
    const current = newestVersionByFileName.get(name);
    if (current === undefined || v.getTime() > current) {
      newestVersionByFileName.set(name, v.getTime());
    }
  }

  const s3Env = readS3Env();
  const uploader = s3Env ? await createUploader(s3Env) : null;
  let uploaded = 0;
  let withoutFile = 0;

  for (const record of records) {
    const kind = KIND_BY_LEGACY_CODE[record.id?.cdTipo ?? ''];
    const coverage = coverageByLegacyCode.get(record.id?.cdCobertura ?? '');
    const version = parseLegacyVersionDate(record.id?.dtVersao);
    const fileName = clean(record.deArquivo);

    if (!kind || !coverage || !version || !fileName) {
      stats.skipped++;
      continue;
    }

    const existing = await prisma.proposalTemplate.findUnique({
      where: { kind_coverageId_version: { kind, coverageId: coverage.id, version } },
    });

    // O binário só é reenviado se ainda não houver um gravado.
    let file: { storageKey: string; mimeType: string; sizeBytes: number } | null = null;
    const isNewestOfName = newestVersionByFileName.get(fileName) === version.getTime();
    const localPath = resolve(process.cwd(), TEMPLATE_DIR, `${fileName}.docx`);
    if (existsSync(localPath) && isNewestOfName) {
      if (!existing?.storageKey && uploader) {
        const buffer = readFileSync(localPath);
        const storageKey = await uploader(fileName, buffer, version);
        file = { storageKey, mimeType: DOCX_MIME, sizeBytes: statSync(localPath).size };
        uploaded++;
      }
    } else {
      withoutFile++;
    }

    const data = {
      kind,
      coverageId: coverage.id,
      version,
      fileName,
      active: record.flArquivoDisponivel !== false,
      ...(file ?? {}),
    };

    if (existing) {
      await prisma.proposalTemplate.update({ where: { id: existing.id }, data });
      stats.updated++;
    } else {
      await prisma.proposalTemplate.create({ data });
      stats.created++;
    }
  }

  await markCurrentVersions(prisma);

  console.log(
    `  criados ${stats.created} · atualizados ${stats.updated} · ignorados ${stats.skipped}`,
  );
  if (withoutFile > 0) {
    console.log(
      `  ${withoutFile} sem o .docx local (esperado em ${TEMPLATE_DIR}/<nome>.docx) — ` +
        `só os metadados foram gravados.`,
    );
  }
  if (uploaded > 0) console.log(`  ${uploaded} arquivo(s) enviados ao S3.`);
  if (!s3Env) console.log('  AWS_S3_* ausente no .env — upload de binário desativado.');

  return stats;
}

/**
 * Marca como vigente a versão mais recente de cada combinação Tipo × Cobertura.
 * O legado não tem esse flag: lá a tela simplesmente lista tudo e o operador
 * escolhe pelo nome — origem das duplicatas "(1)" / "(cópia)".
 */
async function markCurrentVersions(prisma: PrismaClient): Promise<void> {
  const templates = await prisma.proposalTemplate.findMany({
    select: { id: true, kind: true, coverageId: true, version: true, current: true },
    orderBy: { version: 'desc' },
  });

  const newestByCombo = new Map<string, string>();
  for (const t of templates) {
    const key = `${t.kind}:${t.coverageId}`;
    if (!newestByCombo.has(key)) newestByCombo.set(key, t.id);
  }
  const currentIds = new Set(newestByCombo.values());

  for (const t of templates) {
    const shouldBeCurrent = currentIds.has(t.id);
    if (t.current !== shouldBeCurrent) {
      await prisma.proposalTemplate.update({
        where: { id: t.id },
        data: { current: shouldBeCurrent },
      });
    }
  }
  console.log(`  ${currentIds.size} versões marcadas como vigentes.`);
}

async function createUploader(
  env: Record<string, string>,
): Promise<(fileName: string, buffer: Buffer, version: Date) => Promise<string>> {
  const { PutObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    region: env.AWS_S3_REGION,
    credentials: {
      accessKeyId: env.AWS_S3_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_S3_SECRET_ACCESS_KEY,
    },
  });
  return async (fileName, buffer, version) => {
    // Prefixo próprio: os anexos de cotação usam `<quoteId>/...` (ver StorageService).
    // A data da versão entra na chave porque o legado repete o mesmo `deArquivo`
    // em versões diferentes — sem ela, uma sobrescreveria a outra no S3.
    const day = version.toISOString().slice(0, 10);
    const key = `proposal-templates/${day}-${fileName.replace(/[^\w.() -]/g, '_')}.docx`;
    await client.send(
      new PutObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key, Body: buffer }),
    );
    return key;
  };
}
