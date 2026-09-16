import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

/**
 * Armazenamento local de anexos em disco, um diretório por processo.
 * Isolado atrás de uma interface simples para poder virar S3 depois sem
 * tocar em `communications` — ver tarefa 31.
 */
@Injectable()
export class StorageService {
  private readonly baseDir: string;

  constructor(private config: ConfigService) {
    this.baseDir = resolve(this.config.get<string>('ATTACHMENTS_DIR', './storage/attachments'));
  }

  /** Salva o conteúdo e retorna a chave relativa a persistir no banco. */
  async save(quoteId: string, originalName: string, buffer: Buffer): Promise<string> {
    const dir = join(this.baseDir, quoteId);
    await mkdir(dir, { recursive: true });
    const key = join(quoteId, `${randomUUID()}${extname(originalName)}`);
    await writeFile(join(this.baseDir, key), buffer);
    return key;
  }

  /** Stream de leitura para servir o download. Lança se o arquivo não existir. */
  async readStream(storageKey: string) {
    const path = join(this.baseDir, storageKey);
    await stat(path);
    return createReadStream(path);
  }

  async readBuffer(storageKey: string): Promise<Buffer> {
    return readFile(join(this.baseDir, storageKey));
  }

  async delete(storageKey: string) {
    await rm(join(this.baseDir, storageKey), { force: true });
  }
}
