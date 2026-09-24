#!/usr/bin/env bash
# Idempotent sandbox setup: JS deps + software GL (Mesa EGL) for headless browser tests.
set -euo pipefail
cd "$(dirname "$0")/.."
npm install --no-audit --no-fund
if ! ldconfig -p 2>/dev/null | grep -q libEGL_mesa; then
  export DEBIAN_FRONTEND=noninteractive
  SUDO=""; [ "$(id -u)" != "0" ] && SUDO="sudo -n"
  $SUDO apt-get install -y -q libegl1 libegl-mesa0 libgles2 >/dev/null 2>&1 || { $SUDO apt-get update -q >/dev/null 2>&1; $SUDO apt-get install -y -q libegl1 libegl-mesa0 libgles2 >/dev/null; }
fi
node tools/build.mjs
