#!/usr/bin/env bash
set -e

# ==============================================================================
# One-Click Android Release Rebuilder
#
# Usage:
#   ./scripts/rebuild-app.sh           # Auto-increments minor version (e.g. 1.1.0 -> 1.2.0)
#   ./scripts/rebuild-app.sh 1.3.0     # Explicit custom version
#
# Attribution:
#   App Creator & Architect: Amit Kumar
#   Curriculum Source: AI Engineering from Scratch Contributors
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure Android SDK and Java 21 are exported
export ANDROID_HOME="${ANDROID_HOME:-/home/amihkum/Android/Sdk}"
export JAVA_HOME="${JAVA_HOME:-/home/amihkum/.jdk/jdk-21}"
export PATH="$JAVA_HOME/bin:$PATH"

# Run the deterministic Node.js release builder
node "$SCRIPT_DIR/rebuild_release.js" "$@"
