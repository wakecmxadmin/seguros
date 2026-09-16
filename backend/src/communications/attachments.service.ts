import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class AttachmentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  /** Documentos já anexados ao processo — reaproveitáveis em qualquer mensagem futura. */
  async list(quoteId: string) {
    return this.prisma.attachment.findMany({
      where: { quoteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upload(quoteId: string, file: Express.Multer.File, uploadedById: string) {
    const storageKey = await this.storage.save(quoteId, file.originalname, file.buffer);
    return this.prisma.attachment.create({
      data: {
        quoteId,
        fileName: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        storageKey,
        uploadedById,
      },
    });
  }

  /** Garante que o anexo pertence ao processo antes de servir o download. */
  async getForQuote(quoteId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, quoteId },
    });
    if (!attachment) throw new NotFoundException('Anexo não encontrado.');
    return attachment;
  }
}
