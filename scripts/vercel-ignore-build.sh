#!/usr/bin/env bash
# Vercel "Ignored Build Step" for both apps (see apps/*/vercel.json).
# Usage, from the app's Root Directory: bash ../../scripts/vercel-ignore-build.sh
# Exit 0 skips the build, exit 1 builds. When in doubt, build.
#
# Skips when:
# 1. The branch is `preview` and HEAD is a `preview -> main` release merge
#    (the post-release sync): that exact tree was just built for Production.
# 2. Nothing this app depends on changed since the branch's last successful
#    deployment ($VERCEL_GIT_PREVIOUS_SHA). On Hobby only one build runs at a
#    time, so skipping the untouched app also stops it from queueing ahead of
#    the one that changed.
#
# Always builds a redeploy of the same commit (the Redeploy button, usually
# to pick up changed environment variables): there is nothing to compare.
set -u

if [ "${VERCEL_GIT_COMMIT_REF:-}" = "preview" ] &&
  git log -1 --pretty=%s | grep -qE '^Merge pull request #[0-9]+ from [^ ]+/preview$'; then
  echo "Release merge already built for Production; skipping."
  exit 0
fi

previous="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$previous" ]; then
  echo "No previous deployment on this branch; building."
  exit 1
fi

if [ "$previous" = "${VERCEL_GIT_COMMIT_SHA:-}" ] || [ "$(git rev-parse HEAD 2>/dev/null)" = "$(git rev-parse --verify --quiet "$previous^{commit}" 2>/dev/null)" ]; then
  echo "Redeploy of ${previous:0:7}; building."
  exit 1
fi

# This app, the shared package, the build scripts and the root files every
# build reads.
git diff --quiet "$previous" HEAD -- . ../../packages ../../scripts ../../package.json ../../bun.lock ../../.nvmrc
case $? in
  0)
    echo "No changes for this app since ${previous:0:7}; skipping."
    exit 0
    ;;
  1)
    echo "Changes since ${previous:0:7}; building."
    exit 1
    ;;
  *)
    # The previous commit is outside the shallow clone, or git failed.
    echo "Cannot compare with ${previous:0:7}; building."
    exit 1
    ;;
esac
