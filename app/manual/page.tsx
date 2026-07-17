import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./manual.css";

export const metadata: Metadata = {
  title: "Diagonse 사용자 매뉴얼",
  description:
    "마케팅 사전진단 스킬·Vercel 백엔드·ChatGPT/Claude/Gemini/Grok 사용법 전체 매뉴얼",
};

function loadManual(): string {
  const candidates = [
    path.join(process.cwd(), "USER_MANUAL.md"),
    path.join(process.cwd(), "docs", "Diagonse_사용자_매뉴얼.md"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf8");
    }
  }
  return "# 매뉴얼을 찾을 수 없습니다\n\n저장소의 `USER_MANUAL.md`를 확인해 주세요.";
}

export default function ManualPage() {
  const md = loadManual();

  return (
    <div className="manual-shell">
      <header className="manual-topbar">
        <div className="manual-topbar-inner">
          <Link href="/" className="manual-brand">
            <strong>Diagonse</strong>
            <span>사용자 매뉴얼</span>
          </Link>
          <nav className="manual-nav">
            <a href="https://diagonse.vercel.app/api/diagnose">API</a>
            <a href="https://diagonse.vercel.app/api/health">Health</a>
            <a
              href="https://github.com/charlychoi/diagonse"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <Link href="/" className="manual-home-btn">
              ← 홈
            </Link>
          </nav>
        </div>
      </header>

      <article className="manual-doc">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children, ...props }) => (
              <a
                href={href}
                target={href?.startsWith("http") ? "_blank" : undefined}
                rel={href?.startsWith("http") ? "noreferrer" : undefined}
                {...props}
              >
                {children}
              </a>
            ),
          }}
        >
          {md}
        </ReactMarkdown>
      </article>

      <footer className="manual-footer">
        <p>
          백엔드:{" "}
          <a href="https://diagonse.vercel.app">https://diagonse.vercel.app</a>
          {" · "}
          스킬:{" "}
          <a href="https://github.com/charlychoi/diagonse/tree/main/skills/diagonse">
            skills/diagonse
          </a>
        </p>
        <p className="manual-footer-note">
          ⚠️ 올바른 주소는 <strong>diagonse</strong>.vercel.app 입니다 (diagnose
          아님).
        </p>
      </footer>
    </div>
  );
}
