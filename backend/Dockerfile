# Production API image (Fastify + Prisma). Build from repo root: see docs/engineering/deployment.md
FROM node:20-bookworm-slim

WORKDIR /app
RUN echo "deb http://mirrors.aliyun.com/debian/ bookworm main non-free contrib" > /etc/apt/sources.list && echo "deb http://mirrors.aliyun.com/debian/ bookworm-updates main non-free contrib" >> /etc/apt/sources.list && echo "deb http://mirrors.aliyun.com/debian-security bookworm-security main non-free contrib" >> /etc/apt/sources.list

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate && npm run build

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENV NODE_ENV=production

ENTRYPOINT ["./docker-entrypoint.sh"]
