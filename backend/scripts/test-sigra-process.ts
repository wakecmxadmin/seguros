/**
 * Smoke test manual da integração com o SIGRA — puxa **um único processo** direto do
 * `sigraweb`, sem subir a API inteira nem precisar de login/permissões.
 *
 * ⚠️ Só o usuário roda este script (nunca o Claude Code, ver CLAUDE.md § Trabalho no
 * banco do SIGRA) — ele conecta de verdade no banco de produção do SIGRA.
 *
 * Uso:
 *   npm run sigra:test -- 1901475
 *   npm run sigra:test              # usa o processo de exemplo 1901475 (docs/13)
 */
import 'dotenv/config';
import type { ConfigService } from '@nestjs/config';
import { SigraConnectionService } from '../src/sigra/sigra-connection.service';
import { SigraProcessService } from '../src/sigra/sigra-process.service';

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
    step(`getSummary(${sigraId}) — pinho.imp_processo + pinho.processo`);
    const summary = await service.getSummary(sigraId);
    if (!summary) {
      fail(`Nenhuma linha em pinho.imp_processo para id=${sigraId}. Abortando os próximos passos.`);
      return;
    }
    ok('Linha encontrada:');
    console.log(JSON.stringify(summary, null, 2));

    step(`getAdditions(${sigraId}) — pinho.imp_adicao`);
    const additions = await service.getAdditions(sigraId);
    ok(`${additions.length} adição(ões) encontrada(s).`);
    if (additions.length) console.log(JSON.stringify(additions, null, 2));

    step(`getItems(${sigraId}) — pinho.imp_adicao_item`);
    const items = await service.getItems(sigraId);
    ok(`${items.length} item(ns) encontrado(s).`);
    if (items.length) console.log(JSON.stringify(items, null, 2));

    step(`getContainers(${sigraId}) — pinho.imp_processo_container`);
    const containers = await service.getContainers(sigraId);
    ok(`${containers.length} contêiner(es) encontrado(s).`);
    if (containers.length) console.log(JSON.stringify(containers, null, 2));

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
