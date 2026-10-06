FROM node:22.22.1-bookworm-slim
WORKDIR /app
COPY deploy/standalone/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY deploy/standalone/server.mjs ./server.mjs
COPY dist ./dist
COPY drizzle ./drizzle
ENV NODE_ENV=production
CMD ["node","server.mjs"]
