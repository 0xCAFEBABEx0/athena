# Dev-container image for the Athena monorepo (docker-compose `app` service,
# target: development). Production runs on Vercel (functions on Bun 1.4) —
# there is no container runtime stage.
#
# Both runtimes are installed, matching the repo:
# - Bun (pinned to `packageManager` in the root package.json): package manager,
#   web dev server (`bun --bun astro dev`) and production builds.
# - Node.js 24: the CMS dev server (`next dev` under Bun fails to resolve
#   Turbopack's hashed externals) and tooling (`astro check`, Payload CLI).
#
# Using Docker Hardened Images (DHI) for enhanced security.

ARG BUN_VERSION=1.4.4

FROM dhi.io/node:24-debian13-sfw-dev AS base
ARG BUN_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl unzip ca-certificates \
  && rm -rf /var/lib/apt/lists/*
# Installs to /usr/local/bin/bun, so every user (root, vscode) gets the same Bun.
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash -s "bun-v${BUN_VERSION}" \
  && bun --version

# Install dependencies (Bun only: bun.lock is the single lockfile).
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/cms/package.json apps/cms/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
ARG BUN_FROZEN_LOCKFILE=true
RUN if [ "$BUN_FROZEN_LOCKFILE" = "true" ]; then bun install --frozen-lockfile; else bun install; fi

# Development stage for Dev Container
FROM base AS development
# Packages for the vscode user and Cursor/VS Code Server
RUN apt-get update && apt-get install -y --no-install-recommends \
  sudo git procps libatomic1 tar gzip which wget passwd \
  && rm -rf /var/lib/apt/lists/*

# Create vscode user for devcontainer (handle existing UID/GID)
RUN (getent group 1000 || groupadd --gid 1000 vscode) && \
  (id -u 1000 > /dev/null 2>&1 && usermod -l vscode -d /home/vscode -m $(id -nu 1000) || useradd --uid 1000 --gid 1000 -m -s /bin/bash vscode) && \
  echo "vscode ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Install claude-code globally
RUN npm install -g @anthropic-ai/claude-code

# Set up workspace
RUN mkdir -p /workspace && chown 1000:1000 /workspace
USER vscode
WORKDIR /workspace

# Workspace manifests + every node_modules (root and nested, e.g. apps/cms's
# TypeScript 7), then the source on top.
COPY --from=deps --chown=1000:1000 /app ./
COPY --chown=1000:1000 . .

ENV NODE_ENV=development
# CMS (next dev) and web (astro dev)
EXPOSE 3000 4321
CMD ["sleep", "infinity"]
