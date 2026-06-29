#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-web}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

case "$MODE" in
  start|run)
    if command -v powershell.exe >/dev/null 2>&1; then
      exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./script/start_clean_local.ps1 start
    fi
    exec npx expo start --port 8081 --clear
    ;;
  --web|web)
    if command -v powershell.exe >/dev/null 2>&1; then
      exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./script/start_clean_local.ps1 web
    fi
    exec npx expo start --web --port 8081 --clear
    ;;
  --android|android)
    if command -v powershell.exe >/dev/null 2>&1; then
      exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./script/start_clean_local.ps1 android
    fi
    exec npx expo start --android --port 8081 --clear
    ;;
  --ios|ios)
    if command -v powershell.exe >/dev/null 2>&1; then
      exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./script/start_clean_local.ps1 ios
    fi
    exec npx expo start --ios --port 8081 --clear
    ;;
  --dev-client|dev-client)
    if command -v powershell.exe >/dev/null 2>&1; then
      exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./script/start_clean_local.ps1 dev-client
    fi
    exec npx expo start --dev-client --port 8081 --clear
    ;;
  --export-web|export-web)
    exec npx expo export --platform web
    ;;
  --help|help)
    cat <<'USAGE'
usage: ./script/build_and_run.sh [mode]

Modes:
  web, --web               Start Expo web on port 8081 with clean cache
  start, run               Start Expo on port 8081 with clean cache
  android, --android       Start Expo and open Android
  ios, --ios               Start Expo and open iOS
  dev-client, --dev-client Start Expo in development-client mode
  export-web, --export-web Export web build
  help, --help             Show this help
USAGE
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    exit 2
    ;;
esac
