import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";
import { HashNav } from "./HashNav";
import "./manual.css";

export const metadata: Metadata = {
  title: "Diagonse 사용자 매뉴얼",
  description:
    "마케팅 사전진단 웹 사용법 — URL·회사명 입력, Markdown·HTML·PDF 보고서 저장",
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

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return textOf(props?.children);
  }
  return "";
}

/**
 * Map numbered H2 titles → stable ASCII anchors (sec-1 … sec-12).
 * Avoids Korean percent-encoding mismatches in browsers.
 */
function sectionIdFromHeading(text: string, fallback?: string): string {
  const m = text.trim().match(/^(\d+)\.\s/);
  if (m) return `sec-${m[1]}`;
  // 부록 A/B
  const app = text.trim().match(/^부록\s*([A-Za-z])\./);
  if (app) return `app-${app[1].toLowerCase()}`;
  return fallback || "";
}

const markdownComponents: Components = {
  h2: ({ children, id, ...props }) => {
    const text = textOf(children);
    const stable = sectionIdFromHeading(text, typeof id === "string" ? id : undefined);
    return (
      <h2 id={stable || id} {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ children, id, ...props }) => (
    <h3 id={id} {...props}>
      {children}
    </h3>
  ),
  // Decode percent-encoded hashes; keep ASCII sec-* as-is
  a: ({ href, children, ...props }) => {
    const isExternal = Boolean(href?.startsWith("http"));
    let resolved = href;
    if (href?.startsWith("#")) {
      try {
        resolved = `#${decodeURIComponent(href.slice(1))}`;
      } catch {
        resolved = href;
      }
    }
    return (
      <a
        href={resolved}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noreferrer" : undefined}
        {...props}
      >
        {children}
      </a>
    );
  },
};

export default function ManualPage() {
  const md = loadManual();

  return (
    <div className="manual-shell">
      <HashNav />
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
          rehypePlugins={[rehypeSlug]}
          components={markdownComponents}
        >
          {md}
        </ReactMarkdown>
      </article>

      <footer className="manual-footer">
        <p>
          웹 진단:{" "}
          <a href="https://diagonse.vercel.app">https://diagonse.vercel.app</a>
          {" · "}
          소스:{" "}
          <a href="https://github.com/charlychoi/diagonse">
            github.com/charlychoi/diagonse
          </a>
        </p>
        <p className="manual-footer-note">
          ⚠️ 올바른 주소는 <strong>diagonse</strong>.vercel.app 입니다 (diagnose
          아님). 일반 사용자는 스킬 등록 없이 웹에서 바로 진단·다운로드하면
          됩니다.
        </p>
      </footer>
    </div>
  );
}
