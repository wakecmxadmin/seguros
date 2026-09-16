-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "errorMessage" TEXT,
    "gmailMessageId" TEXT,
    "sentById" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "messageId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("messageId","attachmentId")
);

-- CreateTable
CREATE TABLE "gmail_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gmailEmail" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_quoteId_idx" ON "attachments"("quoteId");

-- CreateIndex
CREATE INDEX "messages_quoteId_sentAt_idx" ON "messages"("quoteId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_accounts_userId_key" ON "gmail_accounts"("userId");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_accounts" ADD CONSTRAINT "gmail_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
