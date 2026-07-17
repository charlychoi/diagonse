import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Diagonse API — AI Auto Marketing Diagnosis",
  description:
    "Generative-AI agent API: homepage URL + company name → full marketing diagnosis Markdown report.",
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
