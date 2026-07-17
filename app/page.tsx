import Link from "next/link";
import { DiagnoseApp } from "./DiagnoseApp";
import "./home.css";

export default function Home() {
  return (
    <div className="home-shell">
      <header className="home-topbar">
        <div className="home-topbar-inner">
          <Link href="/" className="home-brand">
            <strong>검색진단소</strong>
            <span>홈페이지 검색 노출 진단</span>
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
            <a href="https://diagonse.vercel.app">https://diagonse.vercel.app</a>
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
          <p style={{ marginTop: 8 }}>
            올바른 주소는 <strong>diagonse</strong>.vercel.app 입니다 (
            diagnose 아님).
          </p>
        </footer>
      </main>
    </div>
  );
}
