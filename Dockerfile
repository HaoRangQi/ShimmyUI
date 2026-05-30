FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=37645
ENV HOSTNAME=0.0.0.0
ENV SHIMMY_UI_HOME=/data
ENV SHIMMY_UI_CONFIG_PATH=/data/config.json
ENV SHIMMY_UI_RUNTIME_PATH=/data/runtime.json

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 37645
CMD ["node", "server.js"]
