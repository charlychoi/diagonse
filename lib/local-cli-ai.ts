/**
 * Local-only AI transports that reuse an authenticated desktop CLI session.
 *
 * These commands are never usable on Sites/Workers because they require a
 * locally installed executable and its OS-protected OAuth cache. No OAuth
 * token or account identifier is read, copied, logged, or sent to the app.
 */

import type { AiApiResult } from "./anthropic-api-client";

export type LocalCliProvider = "codex_cli" | "grok_cli";

type CommandSpec = {
  command: "codex" | "grok";
  args: string[];
  provider: "openai" | "xai";
  model: string;
};

type RunCommand = (
  command: string,
  args: string[],
  options: { timeoutMs: number },
) => Promise<{ stdout: string; stderr: string }>;

function extractCitations(text: string): string[] {
  return [...new Set(text.match(/https:\/\/[^\s)\]}>"']+/gi) ?? [])].slice(0, 12);
}

function constrainedPrompt(prompt: string, webSearch: boolean): string {
  return [
    "당신은 온라인 마케팅 사전진단의 로컬 AI 분석 엔진입니다.",
    webSearch
      ? "필요하면 공개 웹 검색을 사용하되, 검색 결과와 홈페이지 근거를 구분하세요."
      : "웹 검색을 사용하지 말고 제공된 내용만 분석하세요.",
    "로컬 파일, 셸, 코드 실행, 파일 수정, 외부 메시지 전송은 절대 하지 마세요.",
    "요청된 출력 형식을 정확히 지키고 결과 본문만 반환하세요.",
    "",
    prompt,
  ].join("\n");
}

export function buildLocalCliCommand(
  provider: LocalCliProvider,
  prompt: string,
  options: { webSearch?: boolean; env?: Record<string, string | undefined> } = {},
): CommandSpec {
  const env = options.env ?? process.env;
  const safePrompt = constrainedPrompt(prompt, options.webSearch !== false);

  if (provider === "codex_cli") {
    const model = env.CODEX_MODEL || "gpt-5.6";
    return {
      command: "codex",
      args: [
        "exec",
        "--ephemeral",
        "--sandbox",
        "read-only",
        "--ignore-rules",
        "--ignore-user-config",
        "--skip-git-repo-check",
        "--color",
        "never",
        "-m",
        model,
        safePrompt,
      ],
      provider: "openai",
      model,
    };
  }

  const model = env.GROK_MODEL || "grok-4.5";
  return {
    command: "grok",
    args: [
      "--no-auto-update",
      "-p",
      safePrompt,
      "-m",
      model,
      "--output-format",
      "plain",
      "--no-memory",
      "--no-plan",
      "--no-subagents",
    ],
    provider: "xai",
    model,
  };
}

async function defaultRunCommand(
  command: string,
  args: string[],
  options: { timeoutMs: number },
): Promise<{ stdout: string; stderr: string }> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.env.TMPDIR || "/tmp",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const maxBytes = 2 * 1024 * 1024;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} OAuth 분석이 제한 시간 안에 끝나지 않았습니다.`));
    }, options.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > maxBytes) child.kill("SIGTERM");
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (stderr.length > maxBytes) child.kill("SIGTERM");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(
        error.message.includes("ENOENT")
          ? new Error(`${command} CLI가 설치되어 있지 않습니다.`)
          : error,
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const output = stdout.trim();
      if (code !== 0 || !output) {
        reject(
          new Error(
            `${command} OAuth 분석 실패${code === null ? "" : ` (${code})`}: ${stderr.trim().slice(-800) || "출력 없음"}`,
          ),
        );
        return;
      }
      resolve({ stdout: output, stderr });
    });
  });
}

export async function callLocalCliAi(
  provider: LocalCliProvider,
  prompt: string,
  options: {
    webSearch?: boolean;
    timeoutMs?: number;
    env?: Record<string, string | undefined>;
    runCommand?: RunCommand;
  } = {},
): Promise<AiApiResult> {
  const spec = buildLocalCliCommand(provider, prompt, options);
  const result = await (options.runCommand || defaultRunCommand)(spec.command, spec.args, {
    timeoutMs: options.timeoutMs || 180_000,
  });
  return {
    provider: spec.provider,
    model: spec.model,
    output: result.stdout.trim(),
    citations: extractCitations(result.stdout),
  };
}
