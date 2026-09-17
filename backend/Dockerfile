# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Prisma engines precisam de openssl no Alpine
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

# npm ci + prisma generate de novo aqui: o cliente Prisma gerado no build
# fica em node_modules/@prisma/client, e essa stage parte de node_modules
# limpo, então precisa gerar os engines de novo para o runtime.
COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=build /app/dist ./dist

RUN addgroup -S app && adduser -S app -G app \
  && mkdir -p /app/certs \
  && chown -R app:app /app
USER app

EXPOSE 3000

CMD ["node", "dist/main"]
