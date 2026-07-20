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

# 2) Grok CLI(OAuth) 확인 — whoami 등 인터랙티브로 빠질 수 있는 서브커맨드는 쓰지 않음
if command -v grok >/dev/null 2>&1; then
  echo "✅ Grok CLI 설치됨 (경로: $(command -v grok))"
  echo "   로그인 여부는 실제 진단 시 자동 확인됩니다. 안 되어 있으면: grok login --oauth"
else
  echo "⚠️ Grok CLI 미설치 — AI 없이 규칙 기반으로 동작합니다."
  echo "   설치: curl -fsSL https://x.ai/cli/install.sh | bash"
  echo "   로그인: grok login --oauth  (브라우저에서 charlychoi2027@gmail.com 선택)"
fi

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
