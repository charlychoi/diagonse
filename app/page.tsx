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
          </nav>
        </div>
      </header>

      <main className="home-main">
        <DiagnoseApp />
      </main>
    </div>
  );
}
