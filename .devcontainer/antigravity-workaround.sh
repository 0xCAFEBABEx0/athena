#!/bin/bash
# Antigravity IDE v1.16.5 Workaround
# Bug: getRemoteServerNodePath() omits the IDE version prefix from the node binary path.
# Expected: ~/.antigravity-server/bin/{version}-{commitHash}/node
# Actual:   ~/.antigravity-server/bin/{commitHash}/node
# Fix: Create symlinks so the incorrect path resolves correctly.

SERVER_DIR="$HOME/.antigravity-server/bin"
mkdir -p "$SERVER_DIR"

(
  while true; do
    for dir in "$SERVER_DIR"/*-*; do
      if [ -d "$dir" ]; then
        dirname=$(basename "$dir")
        commit="${dirname#*-}"
        symlink="$SERVER_DIR/$commit"
        if [ ! -e "$symlink" ]; then
          ln -s "$dir" "$symlink" 2>/dev/null &&
            echo "Antigravity workaround: Created symlink $commit -> $dirname"
        fi
      fi
    done
    sleep 5
  done
) >/dev/null 2>&1 &
