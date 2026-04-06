#!/bin/bash
# ─────────────────────────────────────────────────────────────
# setup-github.sh — Tworzy repo na GitHub i wgrywa pliki projektu
# Użycie: ./setup-github.sh TWOJ_GITHUB_LOGIN
# ─────────────────────────────────────────────────────────────

set -e

GITHUB_USER="${1:-TWOJ_LOGIN}"
REPO_NAME="jarvis-ai"
REPO_DESC="J.A.R.V.I.S — lokalna aplikacja głosowa AI (Ollama + Whisper + Piper + Android)"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║         J.A.R.V.I.S — GitHub Setup              ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Sprawdź git ───────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  echo "❌ git nie jest zainstalowany"
  exit 1
fi

# ── Sprawdź token ─────────────────────────────────────────────
if [ -z "$GITHUB_TOKEN" ]; then
  echo "🔑 Wprowadź GitHub Personal Access Token (scope: repo):"
  echo "   (Utwórz na: https://github.com/settings/tokens/new)"
  read -rs GITHUB_TOKEN
  echo ""
fi

# ── Utwórz repo przez API ─────────────────────────────────────
echo "📦 Tworzę repozytorium ${GITHUB_USER}/${REPO_NAME} ..."
HTTP_CODE=$(curl -s -o /tmp/gh_response.json -w "%{http_code}" \
  -X POST "https://api.github.com/user/repos" \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "{
    \"name\": \"${REPO_NAME}\",
    \"description\": \"${REPO_DESC}\",
    \"private\": false,
    \"auto_init\": false
  }")

if [ "$HTTP_CODE" = "201" ]; then
  echo "✅ Repozytorium utworzone!"
elif [ "$HTTP_CODE" = "422" ]; then
  echo "⚠️  Repozytorium już istnieje — kontynuuję..."
else
  echo "❌ Błąd API GitHub (HTTP $HTTP_CODE):"
  cat /tmp/gh_response.json
  exit 1
fi

# ── Init git i push ───────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

git init
git add .
git commit -m "🤖 Initial commit — J.A.R.V.I.S AI Voice Assistant

- Android app (Expo + TypeScript) with JARVIS HUD animation
- Gateway server (Fastify) bridging Ollama / OpenClaw
- Whisper STT + Piper TTS (Polish voice) in Docker
- Full docker-compose stack
"

git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${REPO_NAME}.git"
git push -u origin main

echo ""
echo "🚀 Gotowe! Repozytorium dostępne na:"
echo "   https://github.com/${GITHUB_USER}/${REPO_NAME}"
echo ""
echo "Następne kroki:"
echo "  1. cd docker-compose && docker-compose up -d"
echo "  2. docker exec -it jarvis-ollama ollama pull llama3.2"
echo "  3. cd android-app && npm install && npm start"
