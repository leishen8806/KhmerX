FROM node:22.22.1-bookworm-slim
WORKDIR /app
COPY deploy/standalone/package.json ./package.json
COPY deploy/standalone/package-lock.json ./package-lock.json
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY deploy/standalone/*.mjs ./
COPY dist-separated/api/server ./dist/server
COPY dist-separated/client ./dist/client
COPY dist-separated/api/drizzle ./drizzle
ENV NODE_ENV=production
USER node
CMD ["node","server.mjs"]
