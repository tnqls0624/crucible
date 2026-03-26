#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HEADER = `# Worktree Runtime Log

build 단계의 병렬 worktree 실행 상태를 기록하는 런타임 로그입니다.

## 사용 규칙

- live worktree를 만들면 새 행을 추가합니다.
- 포트 범위를 재할당하면 같은 행을 업데이트합니다.
- evaluator가 실제로 확인한 preview URL을 기록합니다.
- 태스크가 끝나면 \`Status\`를 \`CLEANED\`로 바꾸고 \`Cleanup\`을 \`done\`으로 기록합니다.

## Active / Historical Entries

| Task ID | Branch | Worktree | Port Range | Preview URL | Status | Cleanup | Notes |
|---------|--------|----------|------------|-------------|--------|---------|-------|
`;

type JsonRecord = Record<string, unknown>;

type Row = {
  task_id: string;
  branch: string;
  worktree: string;
  port_range: string;
  preview_url: string;
  status: string;
  cleanup: string;
  notes: string;
};

type Command = "init" | "allocate" | "update" | "release" | "show" | "list";

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

async function settingsEnv(root: string): Promise<JsonRecord> {
  const settings = await loadSettings(root);
  if (!settings.env || typeof settings.env !== "object") {
    fail("settings.json의 env 섹션이 없습니다.");
  }
  const merged = { ...(settings.env as JsonRecord) };
  for (const key of Object.keys(merged)) {
    const override = process.env[key];
    if (typeof override === "string" && override.trim().length > 0) {
      merged[key] = override;
    }
  }
  return merged;
}

async function resolveLogPath(root: string, override?: string): Promise<string> {
  if (override) {
    return resolve(process.cwd(), override);
  }
  const env = await settingsEnv(root);
  const relative = env.CRUCIBLE_WORKTREE_RUNTIME_LOG;
  if (typeof relative !== "string" || !relative.trim()) {
    fail("CRUCIBLE_WORKTREE_RUNTIME_LOG 설정이 없습니다.");
  }
  return resolve(root, relative);
}

async function ensureLogFile(logPath: string): Promise<void> {
  await mkdir(dirname(logPath), { recursive: true });
  if (!existsSync(logPath)) {
    await Bun.write(logPath, HEADER);
  }
}

async function parseRows(logPath: string): Promise<Row[]> {
  await ensureLogFile(logPath);
  const rows: Row[] = [];
  const text = await Bun.file(logPath).text();
  for (const line of text.split(/\r?\n/)) {
    const stripped = line.trim();
    if (!stripped.startsWith("|")) {
      continue;
    }
    if (stripped.includes("Task ID") || stripped.includes("---")) {
      continue;
    }
    const parts = stripped
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((part) => part.trim());
    if (parts.length !== 8) {
      continue;
    }
    rows.push({
      task_id: parts[0] ?? "",
      branch: parts[1] ?? "",
      worktree: parts[2] ?? "",
      port_range: parts[3] ?? "",
      preview_url: parts[4] ?? "",
      status: parts[5] ?? "",
      cleanup: parts[6] ?? "",
      notes: parts[7] ?? "",
    });
  }
  return rows;
}

function parsePortStart(portRange: string): number {
  if (portRange === "N/A") {
    return Number.MAX_SAFE_INTEGER;
  }
  const [startText] = portRange.split("-", 1);
  const parsed = Number.parseInt(startText?.trim() ?? "", 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function rowSortKey(row: Row): [number, string] {
  return [parsePortStart(row.port_range), row.task_id];
}

function isLive(row: Row): boolean {
  return row.status !== "CLEANED" && row.cleanup !== "done";
}

function findRow(rows: Row[], taskId: string): Row | undefined {
  return rows.find((row) => row.task_id === taskId);
}

function replaceRow(rows: Row[], updated: Row): Row[] {
  const next = rows.filter((row) => row.task_id !== updated.task_id);
  next.push(updated);
  return next;
}

function renderRows(rows: Row[]): string {
  const lines = [HEADER.trimEnd()];
  for (const row of [...rows].sort((left, right) => {
    const [leftPort, leftTask] = rowSortKey(left);
    const [rightPort, rightTask] = rowSortKey(right);
    if (leftPort !== rightPort) {
      return leftPort - rightPort;
    }
    return leftTask.localeCompare(rightTask);
  })) {
    lines.push(
      `| ${row.task_id} | ${row.branch} | ${row.worktree} | ${row.port_range} | ${row.preview_url} | ${row.status} | ${row.cleanup} | ${row.notes} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function writeRows(logPath: string, rows: Row[]): Promise<void> {
  await Bun.write(logPath, renderRows(rows));
}

function usedSlots(rows: Row[], base: number, blockSize: number): Set<number> {
  const slots = new Set<number>();
  for (const row of rows) {
    if (!isLive(row) || row.port_range === "N/A") {
      continue;
    }
    const start = parsePortStart(row.port_range);
    if (!Number.isFinite(start) || start < base) {
      continue;
    }
    slots.add(Math.floor((start - base) / blockSize));
  }
  return slots;
}

function portRangeForSlot(base: number, blockSize: number, slotIndex: number): [number, number] {
  const start = base + slotIndex * blockSize;
  return [start, start + blockSize - 1];
}

function normalizePreviewHost(host: string): string {
  const trimmed = host.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed === "auto" || trimmed.includes("<") || trimmed.includes("preview-host")) {
    return "http://127.0.0.1";
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

function previewUrlFor(host: string, portStart: number): string {
  return `${normalizePreviewHost(host)}:${portStart}`;
}

function printRow(row: Row, asJson = false): void {
  if (asJson) {
    console.log(JSON.stringify(row, null, 2));
    return;
  }

  console.log(`TASK_ID=${row.task_id}`);
  console.log(`BRANCH=${row.branch}`);
  console.log(`WORKTREE=${row.worktree}`);
  console.log(`PORT_RANGE=${row.port_range}`);
  console.log(`PREVIEW_URL=${row.preview_url}`);
  console.log(`STATUS=${row.status}`);
  console.log(`CLEANUP=${row.cleanup}`);
  console.log(`NOTES=${row.notes}`);
}

function parseOptions(argv: string[]): {
  command: Command;
  logPath?: string;
  taskId?: string;
  branch?: string;
  worktree?: string;
  status?: string;
  cleanup?: string;
  notes?: string;
  previewUrl?: string;
  portRange?: string;
  activeOnly: boolean;
  json: boolean;
} {
  const [commandToken, ...rest] = argv;
  if (!commandToken || !["init", "allocate", "update", "release", "show", "list"].includes(commandToken)) {
    fail("지원하지 않는 명령입니다. init | allocate | update | release | show | list 중 하나를 사용하세요.");
  }

  const parsed = {
    command: commandToken as Command,
    logPath: undefined as string | undefined,
    taskId: undefined as string | undefined,
    branch: undefined as string | undefined,
    worktree: undefined as string | undefined,
    status: undefined as string | undefined,
    cleanup: undefined as string | undefined,
    notes: undefined as string | undefined,
    previewUrl: undefined as string | undefined,
    portRange: undefined as string | undefined,
    activeOnly: false,
    json: false,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    switch (token) {
      case "--log-path":
        parsed.logPath = rest[index + 1] ?? "";
        index += 1;
        break;
      case "--task-id":
        parsed.taskId = rest[index + 1] ?? "";
        index += 1;
        break;
      case "--branch":
        parsed.branch = rest[index + 1] ?? "";
        index += 1;
        break;
      case "--worktree":
        parsed.worktree = rest[index + 1] ?? "";
        index += 1;
        break;
      case "--status":
        parsed.status = rest[index + 1] ?? "";
        index += 1;
        break;
      case "--cleanup":
        parsed.cleanup = rest[index + 1] ?? "";
        index += 1;
        break;
      case "--notes":
        parsed.notes = rest[index + 1] ?? "";
        index += 1;
        break;
      case "--preview-url":
        parsed.previewUrl = rest[index + 1] ?? "";
        index += 1;
        break;
      case "--port-range":
        parsed.portRange = rest[index + 1] ?? "";
        index += 1;
        break;
      case "--active-only":
        parsed.activeOnly = true;
        break;
      case "--json":
        parsed.json = true;
        break;
      default:
        fail(`알 수 없는 옵션입니다: ${token}`);
    }
  }

  return parsed;
}

async function main(): Promise<number> {
  const options = parseOptions(process.argv.slice(2));
  const root = repoRoot();
  const env = await settingsEnv(root);
  const logPath = await resolveLogPath(root, options.logPath);
  await ensureLogFile(logPath);
  const rows = await parseRows(logPath);

  if (options.command === "init") {
    console.log(`LOG_PATH=${logPath}`);
    return 0;
  }

  if (options.command === "allocate") {
    if (!options.taskId || !options.branch || !options.worktree) {
      fail("allocate에는 --task-id, --branch, --worktree가 필요합니다.");
    }

    const existing = findRow(rows, options.taskId);
    if (existing && isLive(existing)) {
      printRow(existing);
      return 0;
    }

    const base = Number.parseInt(String(env.CRUCIBLE_WORKTREE_PORT_BASE ?? ""), 10);
    const blockSize = Number.parseInt(String(env.CRUCIBLE_WORKTREE_PORT_BLOCK_SIZE ?? ""), 10);
    const host = String(env.CRUCIBLE_WORKTREE_PREVIEW_HOST ?? "");
    if (!Number.isFinite(base) || !Number.isFinite(blockSize) || !host) {
      fail("worktree 포트 설정이 올바르지 않습니다.");
    }

    const occupied = usedSlots(rows, base, blockSize);
    let slotIndex = 0;
    while (occupied.has(slotIndex)) {
      slotIndex += 1;
    }

    const [portStart, portEnd] = portRangeForSlot(base, blockSize, slotIndex);
    const allocated: Row = {
      task_id: options.taskId,
      branch: options.branch,
      worktree: options.worktree,
      port_range: `${portStart}-${portEnd}`,
      preview_url: options.previewUrl || previewUrlFor(host, portStart),
      status: options.status || "ALLOCATED",
      cleanup: options.cleanup || "pending",
      notes: options.notes || "",
    };

    await writeRows(logPath, replaceRow(rows, allocated));
    printRow(allocated);
    return 0;
  }

  if (options.command === "update") {
    if (!options.taskId) {
      fail("update에는 --task-id가 필요합니다.");
    }
    const existing = findRow(rows, options.taskId);
    if (!existing) {
      fail(`Task ID를 찾을 수 없습니다: ${options.taskId}`);
    }

    const updated: Row = {
      task_id: existing.task_id,
      branch: options.branch || existing.branch,
      worktree: options.worktree || existing.worktree,
      port_range: options.portRange || existing.port_range,
      preview_url: options.previewUrl || existing.preview_url,
      status: options.status || existing.status,
      cleanup: options.cleanup || existing.cleanup,
      notes: options.notes ?? existing.notes,
    };

    await writeRows(logPath, replaceRow(rows, updated));
    printRow(updated);
    return 0;
  }

  if (options.command === "release") {
    if (!options.taskId) {
      fail("release에는 --task-id가 필요합니다.");
    }
    const existing = findRow(rows, options.taskId);
    if (!existing) {
      fail(`Task ID를 찾을 수 없습니다: ${options.taskId}`);
    }

    const updated: Row = {
      ...existing,
      status: options.status || "CLEANED",
      cleanup: options.cleanup || "done",
      notes: options.notes ?? existing.notes,
    };

    await writeRows(logPath, replaceRow(rows, updated));
    printRow(updated);
    return 0;
  }

  if (options.command === "show") {
    if (!options.taskId) {
      fail("show에는 --task-id가 필요합니다.");
    }
    const existing = findRow(rows, options.taskId);
    if (!existing) {
      fail(`Task ID를 찾을 수 없습니다: ${options.taskId}`);
    }
    printRow(existing, options.json);
    return 0;
  }

  if (options.command === "list") {
    const filtered = options.activeOnly ? rows.filter((row) => isLive(row)) : rows;
    if (options.json) {
      console.log(
        JSON.stringify(
          [...filtered].sort((left, right) => {
            const [leftPort, leftTask] = rowSortKey(left);
            const [rightPort, rightTask] = rowSortKey(right);
            if (leftPort !== rightPort) {
              return leftPort - rightPort;
            }
            return leftTask.localeCompare(rightTask);
          }),
          null,
          2,
        ),
      );
      return 0;
    }
    console.log(renderRows(filtered));
    return 0;
  }

  fail(`지원하지 않는 명령입니다: ${options.command}`);
}

await main().then((code) => process.exit(code)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
