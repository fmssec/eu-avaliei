# syntax=docker/dockerfile:1

# Debian (glibc), não Alpine: sharp e @resvg/resvg-js têm binários pré-compilados
# para linux-x64-gnu. Em musl o npm cairia em build a partir do fonte, o que é
# lento e frágil para o que aqui é o caminho crítico do produto.
ARG NODE_VERSION=22-bookworm-slim

# ---- deps ------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build -----------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# As fontes ficam fora do git e o Satori não lê woff2: sem este passo o
# renderizador falha em runtime. Por isso ele é parte do build, não do deploy.
RUN node scripts/fetch-fonts.mjs

RUN npm run build

# ---- runner ----------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# `output: standalone` já traz o server e só as dependências rastreadas.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# public precisa vir à mão: o standalone não a copia, e é de lá que o
# renderizador carrega as fontes TTF.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Store em arquivo do MVP. Monte um volume aqui para os cards sobreviverem ao
# recriar o container — sem ele, cada `docker compose up` começa do zero.
RUN mkdir -p /app/.data && chown nextjs:nodejs /app/.data
VOLUME ["/app/.data"]

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/search?q=ab').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
