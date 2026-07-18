import type { Metadata } from "next";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HashNav } from "./HashNav";
import "./manual.css";

export const metadata: Metadata = {
  title: "AI 온라인 마케팅 사전진단 사용자 설명서",
  description:
    "AI 온라인 마케팅 사전진단 사용법 — URL·회사명 입력, Markdown·HTML·PDF 보고서 저장",
};

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
  const md = readFileSync(join(process.cwd(), "USER_MANUAL.md"), "utf8");

  return (
    <div className="manual-shell">
      <HashNav />
      <header className="manual-topbar">
        <div className="manual-topbar-inner">
          <Link href="/" className="manual-brand">
            <strong>AI 온라인 마케팅 사전진단</strong>
            <span>사용자 설명서</span>
          </Link>
          <nav className="manual-nav">
            <a href="/api/diagnose">API</a>
            <a href="/api/health">Health</a>
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
          온라인 진단:{" "}
          <a href="https://diagnose.charlychoi.chatgpt.site">
            diagnose.charlychoi.chatgpt.site
          </a>
          {" · "}
          소스:{" "}
          <a href="https://github.com/charlychoi/diagonse">
            github.com/charlychoi/diagonse
          </a>
        </p>
        <p className="manual-footer-note">
          GitHub 복제 사용자는 자신의 xAI API 키를 로컬 환경 변수로 설정합니다.
        </p>
      </footer>
    </div>
  );
}
