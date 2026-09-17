import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

/**
 * Armazenamento de anexos no S3, um prefixo por processo — ver tarefa 31.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('AWS_S3_BUCKET');
    this.client = new S3Client({
      region: this.config.getOrThrow<string>('AWS_S3_REGION'),
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('AWS_S3_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('AWS_S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  /** Salva o conteúdo e retorna a chave relativa a persistir no banco. */
  async save(quoteId: string, originalName: string, buffer: Buffer): Promise<string> {
    const key = `${quoteId}/${randomUUID()}${extname(originalName)}`;
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer }),
    );
    return key;
  }

  /** Stream de leitura para servir o download. Lança se o arquivo não existir. */
  async readStream(storageKey: string): Promise<Readable> {
    const { Body } = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
    return Body as Readable;
  }

  async readBuffer(storageKey: string): Promise<Buffer> {
    const { Body } = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
    const bytes = await Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(storageKey: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
  }
}
