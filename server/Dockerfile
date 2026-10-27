FROM oven/bun:1-alpine

WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy application configuration and source code
COPY tsconfig.json ./
COPY mock-data.json ./
COPY src ./src

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

# Automatically run idempotent seed and launch server
CMD ["sh", "-c", "bun run seed && bun run start"]
