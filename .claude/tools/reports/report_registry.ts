#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = 1;
const KINDS = new Set(["reviewer", "evaluator", "qa"] as const);

type ReportKind = "reviewer" | "evaluator" | "qa";
type JsonRecord = Record<string, unknown>;

const SCHEMA: Record<
  ReportKind,
  {
    verdicts: Set<string>;
    requiredKeys: Record<string, "number" | "string" | "array">;
    requiredSections: string[];
  }
> = {
  reviewer: {
    verdicts: new Set(["APPROVE", "REQUEST_CHANGES", "ESCALATE"]),
    requiredKeys: {
      schema_version: "number",
      report_type: "string",
      task_id: "string",
      generated_at: "string",
      verdict: "string",
      evaluator_signal: "string",
      files: "array",
      verification: "array",
      non_goals: "array",
      done_definition: "array",
    },
    requiredSections: [
      "## Code Review:",
      "### Summary",
      "### Spec Compliance",
      "### Task Contract Compliance",
    ],
  },
  evaluator: {
    verdicts: new Set(["PASS", "FAIL", "SKIP"]),
    requiredKeys: {
      schema_version: "number",
      report_type: "string",
      task_id: "string",
      generated_at: "string",
      verdict: "string",
      execution_channel: "string",
      verified_items: "array",
    },
    requiredSections: [
      "## Evaluation Report:",
      "### Summary",
      "### Findings",
      "### Verified Contract Items",
    ],
  },
  qa: {
    verdicts: new Set(["PASS", "FAIL", "SKIP"]),
    requiredKeys: {
      schema_version: "number",
      report_type: "string",
      task_id: "string",
      generated_at: "string",
      verdict: "string",
      execution_channel: "string",
      scenarios: "array",
      contract_items: "array",
    },
    requiredSections: [
      "## Crucible QA Report",
      "### Test Results",
      "### Contract Coverage",
    ],
  },
};

function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
}

function fail(message: string): never {
  throw new Error(message);
}

async function loadSettings(root: string): Promise<JsonRecord> {
  const settingsPath = resolve(root, ".claude/settings.json");
  if (!existsSync(settingsPath)) {
    fail(`settings.json을 찾을 수 없습니다: ${settingsPath}`);
  }
  return JSON.parse(await Bun.file(settingsPath).text()) as JsonRecord;
}

async function reportDir(root: string): Promise<string> {
  const settings = await loadSettings(root);
  const env = settings.env;
  if (!env || typeof env !== "object") {
    fail("settings.json의 env 섹션이 없습니다.");
  }
  const relative = (env as JsonRecord).CRUCIBLE_TASK_REPORT_DIR;
  if (typeof relative !== "string" || !relative.trim()) {
    fail("CRUCIBLE_TASK_REPORT_DIR 설정이 없습니다.");
  }
  const path = resolve(root, relative);
  await mkdir(path, { recursive: true });
  return path;
}

function canonicalPath(root: string, taskId: string, kind: ReportKind, dir: string): string {
  return resolve(dir, `${taskId}.${kind}.md`);
}

function splitFrontmatter(text: string): { frontmatter: string; body: string } {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || lines[0]?.trim() !== "+++") {
    fail("TOML frontmatter가 없습니다. 첫 줄은 `+++` 여야 합니다.");
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === "+++") {
      return {
        frontmatter: lines.slice(1, index).join("\n"),
        body: lines.slice(index + 1).join("\n"),
      };
    }
  }

  fail("frontmatter 종료 구분자 `+++`를 찾을 수 없습니다.");
}

async function parseReport(filePath: string): Promise<{ metadata: JsonRecord; body: string }> {
  if (!existsSync(filePath)) {
    fail(`report 파일이 없습니다: ${filePath}`);
  }

  const { frontmatter, body } = splitFrontmatter(await Bun.file(filePath).text());
  const parsed = Bun.TOML.parse(frontmatter);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("report frontmatter는 TOML object여야 합니다.");
  }
  return { metadata: parsed as JsonRecord, body };
}

function ensureListOfStrings(metadata: JsonRecord, key: string, errors: string[]): void {
  const value = metadata[key];
  if (!Array.isArray(value)) {
    errors.push(`\`${key}\`는 문자열 배열이어야 합니다.`);
    return;
  }
  if (value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    errors.push(`\`${key}\`에는 비어 있지 않은 문자열만 포함되어야 합니다.`);
  }
}

function validateReport(
  metadata: JsonRecord,
  body: string,
  taskId: string,
  kind: ReportKind,
  filePath: string,
): string[] {
  const schema = SCHEMA[kind];
  const errors: string[] = [];

  for (const [key, expectedType] of Object.entries(schema.requiredKeys)) {
    if (!(key in metadata)) {
      errors.push(`\`${key}\` 필드가 없습니다.`);
      continue;
    }

    const value = metadata[key];
    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (actualType !== expectedType) {
      errors.push(`\`${key}\` 필드 타입이 잘못되었습니다. expected=${expectedType}`);
    }
  }

  if (metadata.schema_version !== SCHEMA_VERSION) {
    errors.push(`\`schema_version\`은 ${SCHEMA_VERSION}이어야 합니다.`);
  }

  if (metadata.report_type !== kind) {
    errors.push(`\`report_type\`은 \`${kind}\`여야 합니다.`);
  }

  if (metadata.task_id !== taskId) {
    errors.push(`\`task_id\`는 \`${taskId}\`와 일치해야 합니다.`);
  }

  if (typeof metadata.verdict === "string" && !schema.verdicts.has(metadata.verdict)) {
    errors.push(`\`verdict\` 값이 잘못되었습니다. allowed=${JSON.stringify([...schema.verdicts].sort())}`);
  }

  for (const listKey of [
    "files",
    "verification",
    "non_goals",
    "done_definition",
    "verified_items",
    "scenarios",
    "contract_items",
  ]) {
    if (listKey in schema.requiredKeys) {
      ensureListOfStrings(metadata, listKey, errors);
    }
  }

  for (const section of schema.requiredSections) {
    if (!body.includes(section)) {
      errors.push(`본문에 필수 섹션이 없습니다: ${section}`);
    }
  }

  if (!body.trim()) {
    errors.push("본문이 비어 있습니다.");
  }

  if (!filePath.endsWith(`/${taskId}.${kind}.md`) && !filePath.endsWith(`\\${taskId}.${kind}.md`)) {
    errors.push(`파일명은 \`${taskId}.${kind}.md\` 형식을 따라야 합니다.`);
  }

  return errors;
}

function printPath(path: string, taskId: string, kind: ReportKind, bare: boolean): void {
  if (bare) {
    console.log(path);
    return;
  }

  console.log(`REPORT_PATH=${path}`);
  console.log(`TASK_ID=${taskId}`);
  console.log(`REPORT_KIND=${kind}`);
}

function printValidation(path: string, metadata: JsonRecord, kind: ReportKind, asJson: boolean): void {
  const payload = {
    valid: true,
    report_path: path,
    report_kind: kind,
    task_id: metadata.task_id,
    verdict: metadata.verdict,
  };

  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  for (const [key, value] of Object.entries(payload)) {
    console.log(`${key.toUpperCase()}=${value}`);
  }
}

function parseOptions(argv: string[]): {
  command: "path" | "validate";
  taskId: string;
  kind: ReportKind;
  bare: boolean;
  file?: string;
  json: boolean;
} {
  const [commandToken, ...rest] = argv;
  if (commandToken !== "path" && commandToken !== "validate") {
    fail("지원하지 않는 명령입니다. path 또는 validate를 사용하세요.");
  }

  let taskId = "";
  let kind = "" as ReportKind;
  let bare = false;
  let file: string | undefined;
  let json = false;

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    switch (token) {
      case "--task-id":
        taskId = rest[index + 1] ?? "";
        index += 1;
        break;
      case "--kind":
        kind = (rest[index + 1] ?? "") as ReportKind;
        index += 1;
        break;
      case "--file":
        file = rest[index + 1] ?? "";
        index += 1;
        break;
      case "--bare":
        bare = true;
        break;
      case "--json":
        json = true;
        break;
      default:
        fail(`알 수 없는 옵션입니다: ${token}`);
    }
  }

  if (!taskId) {
    fail("--task-id 값이 필요합니다.");
  }
  if (!KINDS.has(kind)) {
    fail("--kind 값이 잘못되었습니다. reviewer | evaluator | qa 중 하나여야 합니다.");
  }

  return { command: commandToken, taskId, kind, bare, file, json };
}

async function main(): Promise<number> {
  const args = parseOptions(process.argv.slice(2));
  const root = repoRoot();
  const dir = await reportDir(root);

  if (args.command === "path") {
    printPath(canonicalPath(root, args.taskId, args.kind, dir), args.taskId, args.kind, args.bare);
    return 0;
  }

  const filePath = args.file ? resolve(process.cwd(), args.file) : canonicalPath(root, args.taskId, args.kind, dir);
  const { metadata, body } = await parseReport(filePath);
  const errors = validateReport(metadata, body, args.taskId, args.kind, filePath);
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }
    return 1;
  }

  printValidation(filePath, metadata, args.kind, args.json);
  return 0;
}

await main().then((code) => process.exit(code)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
