#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { resolve } from "node:path";

type TelemetryEvent = {
  event?: string;
  tool?: string;
  skill?: string;
  result?: string;
  duration_ms?: number;
  phase?: string;
  project?: string;
  timestamp?: string;
};

type Snapshot = {
  has_data: boolean;
  total_events: number;
  last_24h: number;
  avg_duration_ms: number;
  slowest_tool: null | { name: string; avg_duration_ms: number; count: number };
  recent_failures: number;
};

function fail(message: string): never {
  throw new Error(message);
}

function parseOptions(argv: string[]): { command: "report" | "snapshot" | "gate-hint" | "bottleneck"; file: string } {
  const [commandToken, ...rest] = argv;
  if (!commandToken || !["report", "snapshot", "gate-hint", "bottleneck"].includes(commandToken)) {
    fail("지원하지 않는 명령입니다. report | snapshot | gate-hint | bottleneck 중 하나를 사용하세요.");
  }

  let file = "";
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    switch (token) {
      case "--file":
        file = rest[index + 1] ?? "";
        index += 1;
        break;
      default:
        fail(`알 수 없는 옵션입니다: ${token}`);
    }
  }

  if (!file) {
    fail("--file 값이 필요합니다.");
  }

  return { command: commandToken as "report" | "snapshot" | "gate-hint" | "bottleneck", file: resolve(process.cwd(), file) };
}

async function readEvents(filePath: string): Promise<TelemetryEvent[]> {
  if (!existsSync(filePath)) {
    return [];
  }
  const events: TelemetryEvent[] = [];
  for (const line of (await Bun.file(filePath).text()).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      events.push(JSON.parse(trimmed) as TelemetryEvent);
    } catch {
      // 손상된 라인은 무시합니다.
    }
  }
  return events;
}

function eventName(event: TelemetryEvent): string {
  return event.tool || event.skill || "unknown";
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.floor(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildSnapshot(events: TelemetryEvent[]): Snapshot {
  if (events.length === 0) {
    return {
      has_data: false,
      total_events: 0,
      last_24h: 0,
      avg_duration_ms: 0,
      slowest_tool: null,
      recent_failures: 0,
    };
  }

  const now = Date.now();
  let last24h = 0;
  let recentFailures = 0;
  const durations: number[] = [];
  const byTool = new Map<string, number[]>();

  for (const event of events) {
    const duration = typeof event.duration_ms === "number" ? event.duration_ms : 0;
    const name = eventName(event);
    durations.push(duration);
    byTool.set(name, [...(byTool.get(name) ?? []), duration]);

    const result = String(event.result ?? "");
    if (["FAIL", "ERROR", "failed", "error"].includes(result)) {
      recentFailures += 1;
    }

    if (typeof event.timestamp === "string") {
      const parsed = Date.parse(event.timestamp);
      if (Number.isFinite(parsed) && now - parsed <= 86_400_000) {
        last24h += 1;
      }
    }
  }

  let slowestTool: Snapshot["slowest_tool"] = null;
  for (const [name, values] of byTool.entries()) {
    const avg = average(values);
    if (!slowestTool || avg > slowestTool.avg_duration_ms) {
      slowestTool = { name, avg_duration_ms: avg, count: values.length };
    }
  }

  return {
    has_data: true,
    total_events: events.length,
    last_24h: last24h,
    avg_duration_ms: average(durations),
    slowest_tool: slowestTool,
    recent_failures: recentFailures,
  };
}

function printReport(events: TelemetryEvent[]): void {
  if (events.length === 0) {
    console.log("No telemetry data found.");
    return;
  }

  console.log("=== Crucible Telemetry Report ===");
  console.log("");
  console.log(`Total executions: ${events.length}`);
  console.log("");
  console.log("--- By Tool/Skill ---");

  const stats = new Map<string, { count: number; totalMs: number; pass: number; fail: number }>();
  for (const event of events) {
    const name = eventName(event);
    const current = stats.get(name) ?? { count: 0, totalMs: 0, pass: 0, fail: 0 };
    current.count += 1;
    current.totalMs += typeof event.duration_ms === "number" ? event.duration_ms : 0;
    if (event.result === "PASS") {
      current.pass += 1;
    } else if (event.result === "FAIL") {
      current.fail += 1;
    }
    stats.set(name, current);
  }

  console.log(`${"Tool/Skill".padEnd(25)} ${"Count".padStart(6)} ${"Avg(ms)".padStart(10)} ${"Pass".padStart(6)} ${"Fail".padStart(6)}`);
  console.log("-".repeat(60));
  for (const [name, data] of [...stats.entries()].sort((left, right) => right[1].count - left[1].count)) {
    const avgMs = data.count > 0 ? Math.floor(data.totalMs / data.count) : 0;
    console.log(
      `${name.padEnd(25)} ${String(data.count).padStart(6)} ${String(avgMs).padStart(10)} ${String(data.pass).padStart(6)} ${String(data.fail).padStart(6)}`,
    );
  }

  console.log("");
  console.log("--- Recent Events (last 10) ---");
  for (const event of events.slice(-10)) {
    const name = eventName(event);
    const timestamp = event.timestamp ?? "unknown";
    const result = String(event.result ?? "unknown");
    const duration = typeof event.duration_ms === "number" ? event.duration_ms : 0;
    console.log(`  ${timestamp} ${name.padEnd(20)} ${result.padEnd(10)} ${duration}ms`);
  }
}

function printGateHint(events: TelemetryEvent[]): void {
  const snapshot = buildSnapshot(events);
  if (!snapshot.has_data) {
    console.log("Telemetry: no data");
    return;
  }

  const slowest = snapshot.slowest_tool ?? { name: "unknown", avg_duration_ms: 0, count: 0 };
  console.log(
    `Telemetry: total=${snapshot.total_events}, last_24h=${snapshot.last_24h}, avg=${snapshot.avg_duration_ms}ms, slowest=${slowest.name} (${slowest.avg_duration_ms}ms avg, ${slowest.count} runs), recent_failures=${snapshot.recent_failures}`,
  );
}

function printBottleneck(events: TelemetryEvent[]): void {
  if (events.length === 0) {
    console.log("No telemetry data.");
    return;
  }

  console.log("=== Bottleneck Analysis ===");
  console.log("");
  console.log("Slowest Tools / Skills (avg execution time):");

  const byTool = new Map<string, number[]>();
  const failCount = new Map<string, number>();
  const phaseCount = new Map<string, number>();

  for (const event of events) {
    const name = eventName(event);
    const duration = typeof event.duration_ms === "number" ? event.duration_ms : 0;
    byTool.set(name, [...(byTool.get(name) ?? []), duration]);
    if (event.result === "FAIL") {
      failCount.set(name, (failCount.get(name) ?? 0) + 1);
    }
    const phase = String(event.phase ?? "unknown");
    phaseCount.set(phase, (phaseCount.get(phase) ?? 0) + 1);
  }

  for (const [name, durations] of [...byTool.entries()].sort((left, right) => average(right[1]) - average(left[1]))) {
    const avgMs = average(durations);
    const maxMs = durations.length > 0 ? Math.max(...durations) : 0;
    console.log(`  ${name.padEnd(25)} avg=${avgMs}ms  max=${maxMs}ms  count=${durations.length}`);
  }

  console.log("");
  console.log("Most Failed Tools / Skills:");
  if (failCount.size === 0) {
    console.log("  No failures recorded!");
  } else {
    for (const [name, count] of [...failCount.entries()].sort((left, right) => right[1] - left[1])) {
      console.log(`  ${name.padEnd(25)} ${count} failures`);
    }
  }

  console.log("");
  console.log("Phase Distribution:");
  for (const [phase, count] of [...phaseCount.entries()].sort((left, right) => right[1] - left[1])) {
    console.log(`  ${phase.padEnd(15)} ${count} executions`);
  }
}

async function main(): Promise<number> {
  const options = parseOptions(process.argv.slice(2));
  const events = await readEvents(options.file);

  if (options.command === "report") {
    printReport(events);
    return 0;
  }

  if (options.command === "snapshot") {
    console.log(JSON.stringify(buildSnapshot(events)));
    return 0;
  }

  if (options.command === "gate-hint") {
    printGateHint(events);
    return 0;
  }

  if (options.command === "bottleneck") {
    printBottleneck(events);
    return 0;
  }

  fail(`지원하지 않는 명령입니다: ${options.command}`);
}

await main().then((code) => process.exit(code)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
