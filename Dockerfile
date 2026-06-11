# To use this Dockerfile, you have to set `output: 'standalone'` in your next.config.js file.
# From https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile
# Using Docker Hardened Images (DHI) for enhanced security

# Base image for deps/builder (includes Bun)
FROM dhi.io/bun:1-debian13-dev AS base-bun

# Base image for development (includes both Node.js and Bun)
FROM dhi.io/node:22-debian13-sfw-dev AS base-node

# Install dependencies only when needed
FROM base-bun AS deps

WORKDIR /app

# Toggle reproducible installs when desired
ARG BUN_FROZEN_LOCKFILE=false

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* bun.lock* ./

RUN \
  if [ -f bun.lock ]; then if [ "$BUN_FROZEN_LOCKFILE" = "true" ]; then bun install --frozen-lockfile; else bun install --no-save; fi; \
  elif [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Development stage for Dev Container
FROM base-node AS development
# Install packages needed for vscode user, Bun installation, and Cursor/VS Code Server
RUN apt-get update && apt-get install -y --no-install-recommends \
  sudo curl unzip git procps libatomic1 ca-certificates tar gzip which wget passwd \
  && rm -rf /var/lib/apt/lists/*

# Create vscode user for devcontainer (handle existing UID/GID)
RUN (getent group 1000 || groupadd --gid 1000 vscode) && \
  (id -u 1000 > /dev/null 2>&1 && usermod -l vscode -d /home/vscode -m $(id -nu 1000) || useradd --uid 1000 --gid 1000 -m -s /bin/bash vscode) && \
  echo "vscode ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Install claude-code globally
RUN npm install -g @anthropic-ai/claude-code

# Install Bun for development
USER vscode
WORKDIR /home/vscode
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/home/vscode/.bun/bin:${PATH}"

# Set up workspace
USER root
RUN mkdir -p /workspace && chown 1000:1000 /workspace
USER vscode
WORKDIR /workspace

# Copy dependencies from deps stage
COPY --from=deps --chown=1000:1000 /app/node_modules ./node_modules
COPY --chown=1000:1000 . .

ENV NODE_ENV=development
EXPOSE 3000
CMD ["sleep", "infinity"]

# Rebuild the source code only when needed
FROM base-bun AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN \
  if [ -f bun.lock ]; then bun run build; \
  elif [ -f yarn.lock ]; then yarn run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
# Use DHI Node.js runtime image (minimal, hardened) for production
FROM dhi.io/node:22-debian13-sfw-dev AS runner
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Remove this line if you do not have this folder
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD HOSTNAME="0.0.0.0" node server.js
