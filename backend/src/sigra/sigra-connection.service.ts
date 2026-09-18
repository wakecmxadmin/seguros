import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type QueryResultRow } from 'pg';

/**
 * Conexão dedicada, só leitura, ao banco de terceiro `sigraweb` (SIGRA).
 * Nunca usar para escrita — ver CLAUDE.md § Trabalho no banco do SIGRA.
 *
 * Reforça "somente leitura" em duas camadas:
 * - `default_transaction_read_only=on` na sessão Postgres (mesma técnica do MCP `postgres-sigra`);
 * - `assertReadOnlyStatement` recusa qualquer SQL que não comece com SELECT/WITH antes de sair do processo.
 *
 * Se as variáveis `DB_SIGRA_*` não estiverem configuradas, o serviço fica desabilitado
 * sem derrubar o boot da aplicação (mesmo padrão de `GmailService.isConfigured()`).
 */
@Injectable()
export class SigraConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SigraConnectionService.name);
  private pool: Pool | null = null;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('DB_SIGRA_HOST');
    const port = this.config.get<string>('DB_SIGRA_PORT');
    const user = this.config.get<string>('DB_SIGRA_USERNAME');
    const password = this.config.get<string>('DB_SIGRA_PASSWORD');
    const database = this.config.get<string>('DB_SIGRA_DATABASE');

    if (!host || !port || !user || !password || !database) {
      this.logger.warn('Credenciais do SIGRA ausentes — integração desabilitada.');
      return;
    }

    const caPath = this.config.get<string>('DB_SIGRA_SSL_CA');
    const certPath = this.config.get<string>('DB_SIGRA_SSL_CERT');
    const keyPath = this.config.get<string>('DB_SIGRA_SSL_KEY');

    this.pool = new Pool({
      host,
      port: Number(port),
      user,
      password,
      database,
      // Sessão marcada como somente-leitura no próprio Postgres — qualquer
      // INSERT/UPDATE/DELETE falha no servidor, mesmo que escape ao guard local.
      options: '-c default_transaction_read_only=on',
      max: 5,
      ssl:
        caPath && certPath && keyPath
          ? {
              ca: readFileSync(resolve(process.cwd(), caPath), 'utf8'),
              cert: readFileSync(resolve(process.cwd(), certPath), 'utf8'),
              key: readFileSync(resolve(process.cwd(), keyPath), 'utf8'),
              rejectUnauthorized: true,
              // Certificado do servidor só tem DNS goog no SAN, não o IP — ver docs/SIGRA_DB.md.
              checkServerIdentity: () => undefined,
            }
          : undefined,
    });

    this.pool.on('error', (err) => this.logger.error('Erro na pool do SIGRA', err));
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  isConfigured(): boolean {
    return this.pool !== null;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    if (!this.pool) {
      throw new ServiceUnavailableException(
        'Integração com o SIGRA não está configurada. Defina as variáveis DB_SIGRA_* no .env.',
      );
    }
    this.assertReadOnlyStatement(sql);

    const result = await this.pool.query<T>(sql, params);
    return result.rows;
  }

  /** Defesa em profundidade: nenhuma query fora de SELECT/WITH sai deste serviço. */
  private assertReadOnlyStatement(sql: string) {
    if (!/^\s*(select|with)\b/i.test(sql)) {
      throw new Error(
        'SigraConnectionService só permite SELECT — nunca escrever no banco do SIGRA (ver CLAUDE.md).',
      );
    }
  }
}
