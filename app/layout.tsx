import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "검색진단소 — 홈페이지 검색 노출 진단",
  description:
    "회사 홈페이지 URL과 회사명만 입력하면 마케팅·브랜드 검색 신호 보고서를 Markdown, HTML, PDF로 받을 수 있습니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif',
          background: "#f7fafc",
          color: "#0f2341",
          lineHeight: 1.65,
        }}
      >
        {children}
      </body>
    </html>
  );
}
