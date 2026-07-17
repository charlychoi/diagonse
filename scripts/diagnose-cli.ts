#!/usr/bin/env tsx
/**
 * Local CLI: npx tsx scripts/diagnose-cli.ts <url> <company> [keywords]
 * Writes Markdown to ./out/
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runAutoDiagnose } from "../lib/auto-diagnose";

async function main() {
  const [url, company, keywords] = process.argv.slice(2);
  if (!url || !company) {
    console.error(
      "Usage: npx tsx scripts/diagnose-cli.ts <url> <company> [keywords-comma]",
    );
    process.exit(1);
  }
  console.error("Diagnosing…", url, company);
  const result = await runAutoDiagnose({
    url,
    company,
    keywords: keywords || undefined,
  });
  const dir = resolve(process.cwd(), "out");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, result.filename);
  writeFileSync(path, result.markdown, "utf8");
  console.error("Wrote", path);
  console.error(
    "Scores:",
    result.scores.surfaceScore,
    result.scores.brandServiceLevel,
    result.scores.naverGuideScore,
  );
  console.log(path);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
