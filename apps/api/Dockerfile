# Poyalo API image. Build from the repo root:
#   docker build -f apps/api/Dockerfile -t poyalo-api .
# Run migrations with the same image:
#   docker compose -f infra/docker/docker-compose.yml --profile app run --rm api pnpm --filter @poyalo/api prisma:migrate
#
# Simple single-stage layout for now (keeps the Prisma CLI available for migrations).
# Slimming it down (pnpm deploy + a separate migrate image) is a P9 task.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /repo
ENV CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Install dependencies first (cached unless a manifest or the lockfile changes)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @poyalo/contracts build && pnpm --filter @poyalo/api build

WORKDIR /repo/apps/api
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
