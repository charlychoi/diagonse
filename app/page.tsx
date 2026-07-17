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
        DIAGONSE · GENERATIVE AI SKILL
      </p>
      <h1 style={{ fontSize: 36, letterSpacing: "-0.04em", margin: "8px 0 16px" }}>
        생성형 AI 스킬 · 마케팅 사전진단
      </h1>
      <p style={{ fontSize: 17, color: "#40536f", fontWeight: 650 }}>
        REST “서비스 제품”이 아니라, Grok·Claude·Cursor 등{" "}
        <strong>생성형 AI가 로드하는 스킬</strong>입니다. 대화에서 URL + 회사명만
        주면 에이전트가 헤드리스 진단을 돌리고{" "}
        <strong>Markdown 보고서</strong>를 남깁니다. 사람용 입력 UI와 분리되어
        있습니다.
      </p>
      <p style={{ fontSize: 15, fontWeight: 750 }}>
        스킬 설치: 저장소 <code>skills/diagonse/SKILL.md</code> →{" "}
        <code>~/.grok/skills/diagonse</code> 또는{" "}
        <code>.claude/skills/diagonse</code>
        <br />
        슬래시: <code>/diagonse https://example.com 회사명</code>
      </p>
      <p style={{ marginTop: 20 }}>
        <a
          href="/manual"
          style={{
            display: "inline-flex",
            padding: "14px 22px",
            borderRadius: 999,
            background: "#061f43",
            color: "#fff",
            fontWeight: 900,
            textDecoration: "none",
            boxShadow: "0 12px 28px rgba(6,31,67,.18)",
          }}
        >
          📖 사용자 매뉴얼 전체 보기 →
        </a>
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
