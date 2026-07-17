export default function Home() {
  return (
    <main
      style={{
        maxWidth: 820,
        margin: "0 auto",
        padding: "48px 20px 80px",
      }}
    >
      <p style={{ color: "#03c75a", fontWeight: 900, letterSpacing: "0.08em" }}>
        DIAGONSE · AGENT API
      </p>
      <h1 style={{ fontSize: 36, letterSpacing: "-0.04em", margin: "8px 0 16px" }}>
        생성형 AI용 마케팅 사전진단 API
      </h1>
      <p style={{ fontSize: 17, color: "#40536f", fontWeight: 650 }}>
        홈페이지 URL + 회사명만 넘기면 HTML 크롤·브랜드 검색 신호 정렬·네이버
        서치어드바이저 점검·Before→After 문안이 담긴{" "}
        <strong>Markdown 보고서</strong>를 자동 생성합니다. 인터랙티브 UI 진단과
        분리된 헤드리스 모듈입니다.
      </p>

      <section
        style={{
          marginTop: 28,
          padding: 20,
          background: "#fff",
          borderRadius: 16,
          border: "1px solid rgba(6,31,67,.1)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Quick start (for AI agents)</h2>
        <pre
          style={{
            background: "#0b1b33",
            color: "#e8eef8",
            padding: 16,
            borderRadius: 12,
            overflow: "auto",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >{`POST /api/diagnose
Content-Type: application/json

{
  "url": "https://sangsangwoori.com/",
  "company": "상상우리",
  "keywords": ["AI 컨설팅", "AI 교육"],
  "industry": "AI 컨설팅·교육"
}

# Markdown only:
GET /api/diagnose?url=https://sangsangwoori.com/&company=상상우리&format=md`}</pre>
        <p style={{ marginBottom: 0, fontSize: 14, color: "#687992" }}>
          응답 JSON의 <code>markdown</code> 필드를{" "}
          <code>filename</code> 이름으로 저장하세요. API 스키마:{" "}
          <a href="/api/diagnose">/api/diagnose</a> · Health:{" "}
          <a href="/api/health">/api/health</a>
        </p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>에이전트 프롬프트 예시</h2>
        <blockquote
          style={{
            margin: 0,
            padding: "14px 18px",
            background: "#fff8ef",
            borderLeft: "4px solid #ff7a1a",
            borderRadius: 8,
            fontWeight: 650,
          }}
        >
          웹사이트 https://example.com 회사명 OO컴퍼니를 Diagonse API로
          마케팅 사전진단하고, 반환된 markdown을 파일로 저장한 뒤 요약 보고해
          줘. POST /api/diagnose body: {"{"} url, company {"}"}
        </blockquote>
      </section>

      <section style={{ marginTop: 24, fontSize: 14, color: "#687992" }}>
        <h2 style={{ color: "#0f2341" }}>점수 해석</h2>
        <ul>
          <li>
            <b>surfaceScore</b> — HTML 표면 신호 (브랜드 검색 KPI와 별개)
          </li>
          <li>
            <b>brandServiceBinding</b> — 브랜드=서비스 연결 강도 (before_after
            전략)
          </li>
          <li>
            <b>naverGuideScore</b> — 서치어드바이저 기술 전제 점검
          </li>
        </ul>
        <p>
          소스:{" "}
          <a href="https://github.com/charlychoi/diagonse">
            github.com/charlychoi/diagonse
          </a>
        </p>
      </section>
    </main>
  );
}
