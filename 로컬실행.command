#!/bin/bash
# AI 온라인 마케팅 사전진단 — 맥북 로컬 실행 (더블클릭)
cd "$(dirname "$0")"
echo "=========================================="
echo " AI 온라인 마케팅 사전진단 (v4) 로컬 실행"
echo "=========================================="

# 1) Node.js 확인
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js가 없습니다. https://nodejs.org 에서 22.13 이상(LTS)을 설치 후 다시 실행하세요."
  read -p "엔터를 누르면 종료합니다..."; exit 1
fi
echo "✅ Node.js $(node -v)"

# 2) .env.local에서 로컬 OAuth 공급자 확인 — whoami 등 인터랙티브로 빠질 수 있는
#    서브커맨드는 쓰지 않고, CLI 설치 여부만 표시한다. 실제 로그인 상태는
#    진단 실행 시 서버가 자동 확인한다.
AI_PROVIDER_LOCAL=""
if [ -f .env.local ]; then
  AI_PROVIDER_LOCAL=$(grep -E '^AI_PROVIDER=' .env.local | tail -1 | cut -d= -f2 | tr -d '[:space:]')
fi

check_grok() {
  if command -v grok >/dev/null 2>&1; then
    echo "✅ Grok CLI 설치됨 (경로: $(command -v grok))"
    echo "   로그인 안 되어 있으면: grok login --oauth  (브라우저에서 charlychoi2027@gmail.com 선택)"
  else
    echo "⚠️ Grok CLI 미설치 — 설치: curl -fsSL https://x.ai/cli/install.sh | bash"
  fi
}
check_codex() {
  if command -v codex >/dev/null 2>&1; then
    echo "✅ Codex CLI 설치됨 (경로: $(command -v codex))"
    echo "   로그인 안 되어 있으면: codex login"
  else
    echo "⚠️ Codex CLI 미설치 — https://github.com/openai/codex 안내에 따라 설치 후 codex login"
  fi
}

case "$AI_PROVIDER_LOCAL" in
  grok)
    echo "🔧 설정된 AI 공급자: Grok 4.5 OAuth"
    check_grok
    ;;
  codex|chatgpt|gpt|openai)
    echo "🔧 설정된 AI 공급자: Codex(ChatGPT) OAuth"
    check_codex
    ;;
  *)
    echo "ℹ️ .env.local에 AI_MODE=local-oauth가 설정되지 않았습니다 — 규칙 기반으로 동작합니다."
    echo "   Grok 또는 Codex OAuth로 전환하려면 .env.local의 AI_MODE/AI_PROVIDER를 확인하세요."
    check_grok
    check_codex
    ;;
esac

# 3) 의존성 설치(최초 1회)
if [ ! -d node_modules ]; then
  echo "📦 최초 실행 — 패키지 설치 중 (1~2분)..."
  npm install --no-audit --no-fund || { read -p "설치 실패. 엔터로 종료..."; exit 1; }
fi

# 4) 개발 서버 실행
echo ""
echo "🚀 서버 시작 → 브라우저에서 http://127.0.0.1:3000 을 여세요"
echo "   AI 연결 확인: http://127.0.0.1:3000/api/health?ai=1"
echo "   종료: 이 창에서 Ctrl+C"
sleep 2
open "http://127.0.0.1:3000" 2>/dev/null &
npm run dev
