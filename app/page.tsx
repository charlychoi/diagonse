import Link from "next/link";
import { DiagnoseApp } from "./DiagnoseApp";
import "./home.css";

export default function Home() {
  return (
    <div className="home-shell">
      <header className="home-topbar">
        <div className="home-topbar-inner">
          <Link href="/" className="home-brand">
            <strong>AI 온라인 마케팅 사전진단</strong>
            <span>광고 전 온라인 상태 진단</span>
          </Link>
          <nav className="home-nav">
            <Link href="/manual">사용자 설명서</Link>
            <a
              href="https://github.com/charlychoi/diagonse"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <Link href="/manual" className="ghost">
              도움말
            </Link>
          </nav>
        </div>
      </header>

      <main className="home-main">
        <DiagnoseApp />

        <footer className="home-footer">
          <p>
            서비스:{" "}
            <a href="https://diagnose.charlychoi.chatgpt.site">
              diagnose.charlychoi.chatgpt.site
            </a>
            {" · "}
            매뉴얼: <Link href="/manual">/manual</Link>
            {" · "}
            저장소:{" "}
            <a
              href="https://github.com/charlychoi/diagonse"
              target="_blank"
              rel="noreferrer"
            >
              github.com/charlychoi/diagonse
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
