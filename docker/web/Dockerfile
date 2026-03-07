FROM node:20-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @skynet/web build

FROM node:20-bookworm-slim AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV="production"
ENV PORT="3000"

WORKDIR /app

RUN corepack enable

COPY --from=builder /app /app

EXPOSE 3000

CMD ["pnpm", "--filter", "@skynet/web", "exec", "next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
