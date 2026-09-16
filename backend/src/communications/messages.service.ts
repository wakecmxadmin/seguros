import { BadRequestException, Injectable } from '@nestjs/common';
import { MessageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GmailService } from '../gmail/gmail.service';
import { SendMessageDto } from './dto/communications.dto';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private gmail: GmailService,
  ) {}

  async list(quoteId: string) {
    return this.prisma.message.findMany({
      where: { quoteId },
      orderBy: { sentAt: 'desc' },
      include: { sentBy: { select: { id: true, name: true } }, attachments: { include: { attachment: true } } },
    });
  }

  /**
   * Envia a mensagem e registra o histórico no mesmo fluxo — diferente do
   * padrão observado no WBX, onde o log era inserido pelo cliente após o
   * envio e podia se perder se aquele insert falhasse.
   */
  async send(quoteId: string, dto: SendMessageDto, userId: string) {
    const attachments = dto.attachmentIds?.length
      ? await this.prisma.attachment.findMany({ where: { id: { in: dto.attachmentIds }, quoteId } })
      : [];
    if (dto.attachmentIds?.length && attachments.length !== dto.attachmentIds.length) {
      throw new BadRequestException('Um ou mais anexos não pertencem a este processo.');
    }

    let status: MessageStatus = MessageStatus.SENT;
    let errorMessage: string | null = null;
    let gmailMessageId: string | null = null;

    try {
      const payloadAttachments = await Promise.all(
        attachments.map(async (attachment) => ({
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          content: await this.storage.readBuffer(attachment.storageKey),
        })),
      );

      gmailMessageId = await this.gmail.send(userId, {
        to: dto.to,
        cc: dto.cc,
        subject: dto.subject,
        html: dto.bodyHtml,
        attachments: payloadAttachments,
      });
    } catch (error) {
      status = MessageStatus.FAILED;
      errorMessage = error instanceof Error ? error.message : 'Falha desconhecida ao enviar.';
    }

    const message = await this.prisma.message.create({
      data: {
        quoteId,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        bodyText: dto.bodyText,
        toAddresses: dto.to,
        ccAddresses: dto.cc ?? [],
        status,
        errorMessage,
        gmailMessageId,
        sentById: userId,
        attachments: { create: attachments.map((a) => ({ attachmentId: a.id })) },
      },
      include: { sentBy: { select: { id: true, name: true } }, attachments: { include: { attachment: true } } },
    });

    if (status === MessageStatus.FAILED) {
      throw new BadRequestException(errorMessage ?? 'Não foi possível enviar o e-mail.');
    }
    return message;
  }
}
