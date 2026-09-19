FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --ignore-scripts
COPY src ./src
COPY build.mjs ./
COPY public ./public
RUN node build.mjs
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY package.json server.mjs identity.mjs ./
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173
EXPOSE 4173
# Mount private data and persistent runtime storage; supply Microsoft settings.
USER node
CMD ["node", "server.mjs"]
