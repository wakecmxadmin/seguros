/**
 * Smoke test manual da integração com o SIGRA — puxa **um único processo** direto do
 * `sigraweb`, sem subir a API inteira nem precisar de login/permissões.
 *
 * ⚠️ Só o usuário roda este script (nunca o Claude Code, ver CLAUDE.md § Trabalho no
 * banco do SIGRA) — ele conecta de verdade no banco de produção do SIGRA.
 *
 * Uso:
 *   npm run sigra:test -- 1935396   # importação (Multi Mercantes)
 *   npm run sigra:test -- 1921824   # exportação via agenciamento (Kalay)
 *   npm run sigra:test -- 1901475
 *   npm run sigra:test              # usa o processo de exemplo 1901475 (docs/13)
 */
import 'dotenv/config';
import type { ConfigService } from '@nestjs/config';
import { SigraConnectionService } from '../src/sigra/sigra-connection.service';
import { SigraProcessService } from '../src/sigra/sigra-process.service';
import { mapSigraAgencyToQuoteDraft, mapSigraToQuoteDraft } from '../src/quotes/sigra-draft-mapper';

const EXAMPLE_SIGRA_ID = 1901475; // PO 260098, Multi Mercantes — ver docs/13-sigra-campos-necessarios.md

const step = (msg: string) => console.log(`\n▶ ${msg}`);
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const fail = (msg: string) => console.log(`  ✗ ${msg}`);

async function main() {
  console.log('=== Teste manual — 1 processo do SIGRA ===');

  step('Lendo variáveis de ambiente (.env)');
  const required = [
    'DB_SIGRA_HOST', 'DB_SIGRA_PORT', 'DB_SIGRA_USERNAME', 'DB_SIGRA_PASSWORD', 'DB_SIGRA_DATABASE',
  ];
  for (const key of required) {
    const value = process.env[key];
    ok(`${key}=${key === 'DB_SIGRA_PASSWORD' ? (value ? '***' : '(vazio)') : value ?? '(vazio)'}`);
  }
  ok(`DB_SIGRA_SSL_CA=${process.env.DB_SIGRA_SSL_CA ?? '(vazio)'}`);
  ok(`DB_SIGRA_SSL_CERT=${process.env.DB_SIGRA_SSL_CERT ?? '(vazio)'}`);
  ok(`DB_SIGRA_SSL_KEY=${process.env.DB_SIGRA_SSL_KEY ?? '(vazio)'}`);

  const sigraId = Number(process.argv[2] ?? EXAMPLE_SIGRA_ID);
  if (!Number.isFinite(sigraId)) {
    fail(`ID de processo SIGRA inválido: "${process.argv[2]}"`);
    process.exit(1);
  }
  console.log(`\nProcesso alvo: ${sigraId}${process.argv[2] ? '' : ' (exemplo padrão, docs/13)'}`);

  step('Abrindo pool de conexão (SigraConnectionService)');
  const config = { get: (key: string) => process.env[key] } as unknown as ConfigService;
  const connection = new SigraConnectionService(config);
  connection.onModuleInit();

  if (!connection.isConfigured()) {
    fail('Integração desabilitada — alguma variável DB_SIGRA_* obrigatória está faltando.');
    process.exit(1);
  }
  ok('Pool configurada (ainda não conectou de fato — pg conecta na primeira query).');

  const service = new SigraProcessService(connection);

  try {
    step(`getKind(${sigraId}) — em qual módulo do SIGRA o processo está`);
    const kind = await service.getKind(sigraId);
    if (!kind) {
      fail(`Nenhuma linha em pinho.processo para id=${sigraId}.`);
      return;
    }
    ok(`Tipo: ${kind}`);

    if (kind === 'IMPORT') {
      step(`getFullProcess(${sigraId}) — imp_processo, cliente, fatura (moeda/incoterm), adições, itens`);
      const data = await service.getFullProcess(sigraId);
      console.log(JSON.stringify(data.summary, null, 2));
      ok(`${data.additions.length} adição(ões), ${data.items.length} item(ns), ${data.containers.length} contêiner(es).`);

      step('Rascunho que o formulário de cotação receberia (mapSigraToQuoteDraft)');
      console.log(JSON.stringify(mapSigraToQuoteDraft(data), null, 2));
    } else if (kind === 'EXPORT_AGENCY') {
      step(`getAgencyProcess(${sigraId}) — age_processo (exportação com seguro)`);
      const agency = await service.getAgencyProcess(sigraId);
      console.log(JSON.stringify(agency, null, 2));

      if (agency) {
        step('Rascunho que o formulário de cotação receberia (mapSigraAgencyToQuoteDraft)');
        console.log(JSON.stringify(mapSigraAgencyToQuoteDraft(agency), null, 2));
      }
    } else {
      ok('Processo fora de importação/agenciamento — o seguro não usa este tipo.');
    }

    step(`getDocuments(${sigraId}) — op_processo_documento → op_documento → sis_arquivo`);
    const documents = await service.getDocuments(sigraId);
    ok(`${documents.length} documento(s) com URL.`);
    for (const doc of documents.slice(0, 10)) {
      console.log(`  - ${doc.type ?? '(sem tipo)'} · ${doc.fileName ?? ''} · ${doc.url.slice(0, 60)}…`);
    }

    console.log('\n=== OK — processo lido com sucesso, nenhuma escrita foi feita ===');
  } catch (err) {
    fail('Erro durante a leitura:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    step('Fechando a pool de conexão');
    await connection.onModuleDestroy();
    ok('Pool fechada.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
