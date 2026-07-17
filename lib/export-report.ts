import { marked } from "marked";

/** Base name without extension: 마케팅_사전진단_회사_날짜 */
export function reportBaseName(filename: string, company?: string): string {
  const fromApi = filename?.replace(/\.md$/i, "").trim();
  if (fromApi) return fromApi;
  const slug = (company || "report")
    .replace(/[^\w가-힣\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 40);
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `마케팅_사전진단_${slug}_${day}`;
}

export function downloadBlob(content: string | Blob, filename: string, mime: string) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const REPORT_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 28px 48px;
    font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo",
      "Noto Sans KR", "Malgun Gothic", sans-serif;
    color: #0f2341;
    line-height: 1.7;
    max-width: 860px;
    margin-inline: auto;
    background: #fff;
  }
  h1 { font-size: 1.75rem; letter-spacing: -0.03em; margin: 0 0 12px; }
  h2 {
    font-size: 1.25rem;
    margin: 28px 0 10px;
    padding-top: 8px;
    border-top: 1px solid #e6ecf4;
  }
  h3 { font-size: 1.05rem; margin: 20px 0 8px; color: #0a326f; }
  p, li { font-size: 14.5px; }
  a { color: #0d6ed8; }
  blockquote {
    margin: 12px 0;
    padding: 10px 14px;
    border-left: 4px solid #03c75a;
    background: #f0faf4;
    border-radius: 0 10px 10px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 18px;
    font-size: 13px;
  }
  th, td {
    border: 1px solid #d9e2ef;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
  }
  th { background: #eef5ff; }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.9em;
    background: #eef3f9;
    padding: 1px 5px;
    border-radius: 4px;
  }
  pre {
    background: #0b1b33;
    color: #e8eef8;
    padding: 14px;
    border-radius: 10px;
    overflow-x: auto;
    font-size: 12px;
  }
  pre code { background: none; color: inherit; padding: 0; }
  .report-meta {
    font-size: 13px;
    color: #687992;
    margin-bottom: 20px;
  }
  @media print {
    body { padding: 12mm; max-width: none; }
    a { color: inherit; text-decoration: none; }
    h2 { break-after: avoid; }
    table, pre, blockquote { break-inside: avoid; }
  }
`;

export async function markdownToHtmlBody(markdown: string): Promise<string> {
  marked.setOptions({ gfm: true, breaks: false });
  return marked.parse(markdown, { async: true }) as Promise<string>;
}

export async function buildStandaloneHtml(
  markdown: string,
  opts: { title?: string; company?: string },
): Promise<string> {
  const body = await markdownToHtmlBody(markdown);
  const title =
    opts.title ||
    `마케팅 사전진단${opts.company ? ` — ${opts.company}` : ""} | Diagonse`;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700;900&display=swap" rel="stylesheet" />
  <style>${REPORT_CSS}
  body { font-family: "Noto Sans KR", -apple-system, BlinkMacSystemFont, sans-serif; }
  </style>
</head>
<body>
  <p class="report-meta">Diagonse · https://diagonse.vercel.app · ${new Date().toLocaleString("ko-KR")}</p>
  ${body}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Open print dialog so user can Save as PDF (best Korean font support). */
export async function openPrintPdf(
  markdown: string,
  opts: { company?: string },
): Promise<void> {
  const html = await buildStandaloneHtml(markdown, {
    title: `마케팅 사전진단${opts.company ? ` — ${opts.company}` : ""}`,
    company: opts.company,
  });
  const w = window.open("", "_blank");
  if (!w) {
    throw new Error(
      "팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도해 주세요.",
    );
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Wait for fonts/layout
  await new Promise((r) => setTimeout(r, 400));
  w.focus();
  w.print();
}
