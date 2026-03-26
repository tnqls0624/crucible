#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_ROLE_DUTIES = ["maker", "evaluator", "checker", "escalation"] as const;

type JsonRecord = Record<string, unknown>;

function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
}

function fail(message: string): never {
  throw new Error(message);
}

function ensurePathPrefix(pathText: string, allowedPrefixes: string[], label: string, errors: string[]): void {
  const valid = allowedPrefixes.some((prefix) => pathText === prefix.replace(/\/$/, "") || pathText.startsWith(prefix));
  if (!valid) {
    errors.push(`${label}: \`${pathText}\` 경로가 허용된 prefix ${JSON.stringify(allowedPrefixes)} 중 하나가 아닙니다.`);
  }
}

function normalizeRepoPath(root: string, pathText: string): string {
  return resolve(root, pathText);
}

function parseOptions(argv: string[]): { manifest: string; json: boolean } {
  let manifest = ".claude/agent-manifest.yaml";
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case "--manifest":
        manifest = argv[index + 1] ?? "";
        index += 1;
        break;
      case "--json":
        json = true;
        break;
      default:
        fail(`알 수 없는 옵션입니다: ${token}`);
    }
  }

  if (!manifest) {
    fail("--manifest 값이 필요합니다.");
  }

  return { manifest, json };
}

async function loadYaml(path: string): Promise<JsonRecord> {
  const data = Bun.YAML.parse(await Bun.file(path).text());
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    fail("manifest 최상위는 mapping이어야 합니다.");
  }
  return data as JsonRecord;
}

function validateManifest(data: JsonRecord, manifestPath: string, root: string): string[] {
  const errors: string[] = [];

  if (!(data.version === "0.1" || data.version === 0.1)) {
    errors.push("`version`은 `0.1`이어야 합니다.");
  }

  if (data.name !== "crucible") {
    errors.push("`name`은 `crucible`이어야 합니다.");
  }

  if (data.canonical_root !== ".claude") {
    errors.push("`canonical_root`는 `.claude`여야 합니다.");
  }

  if (data.metadata_only !== true) {
    errors.push("`metadata_only`는 `true`여야 합니다.");
  }

  if (!data.supports || typeof data.supports !== "object" || Array.isArray(data.supports)) {
    errors.push("`supports`는 mapping이어야 합니다.");
  } else {
    const supports = data.supports as JsonRecord;
    const canonicalHosts = supports.canonical_hosts;
    const generatedHosts = supports.generated_hosts;
    if (!Array.isArray(canonicalHosts) || !canonicalHosts.includes("claude")) {
      errors.push("`supports.canonical_hosts`에는 `claude`가 포함되어야 합니다.");
    }
    if (!Array.isArray(generatedHosts) || !generatedHosts.includes("codex")) {
      errors.push("`supports.generated_hosts`에는 `codex`가 포함되어야 합니다.");
    }
  }

  const generatedTargets = data.generated_targets;
  if (!Array.isArray(generatedTargets) || generatedTargets.length === 0) {
    errors.push("`generated_targets`는 비어 있지 않은 배열이어야 합니다.");
  } else {
    generatedTargets.forEach((target, index) => {
      const label = `generated_targets[${index}]`;
      if (!target || typeof target !== "object" || Array.isArray(target)) {
        errors.push(`${label}는 mapping이어야 합니다.`);
        return;
      }
      const record = target as JsonRecord;
      if (record.host !== "codex") {
        errors.push(`${label}.host는 \`codex\`여야 합니다.`);
      }
      if (typeof record.path !== "string") {
        errors.push(`${label}.path는 문자열이어야 합니다.`);
      } else {
        ensurePathPrefix(record.path, [".agents/", ".agents"], `${label}.path`, errors);
      }
      if (typeof record.source !== "string") {
        errors.push(`${label}.source는 문자열이어야 합니다.`);
      } else if (record.source !== ".claude/" && record.source !== ".claude") {
        errors.push(`${label}.source는 \`.claude/\`여야 합니다.`);
      }
    });
  }

  const roles = data.roles;
  const roleIds = new Set<string>();
  if (!Array.isArray(roles) || roles.length === 0) {
    errors.push("`roles`는 비어 있지 않은 배열이어야 합니다.");
  } else {
    roles.forEach((role, index) => {
      const label = `roles[${index}]`;
      if (!role || typeof role !== "object" || Array.isArray(role)) {
        errors.push(`${label}는 mapping이어야 합니다.`);
        return;
      }
      const record = role as JsonRecord;
      if (typeof record.id !== "string" || record.id.trim().length === 0) {
        errors.push(`${label}.id는 비어 있지 않은 문자열이어야 합니다.`);
      } else if (roleIds.has(record.id)) {
        errors.push(`중복 role id가 있습니다: \`${record.id}\``);
      } else {
        roleIds.add(record.id);
      }

      if (typeof record.ref !== "string") {
        errors.push(`${label}.ref는 문자열이어야 합니다.`);
      } else {
        ensurePathPrefix(record.ref, [".claude/agents/"], `${label}.ref`, errors);
        const refPath = normalizeRepoPath(root, record.ref);
        if (!refPath.endsWith(".md")) {
          errors.push(`${label}.ref는 Markdown 파일이어야 합니다: \`${record.ref}\``);
        }
        if (!existsSync(refPath)) {
          errors.push(`${label}.ref 파일이 존재하지 않습니다: \`${record.ref}\``);
        }
      }
    });
  }

  if (!data.duties || typeof data.duties !== "object" || Array.isArray(data.duties)) {
    errors.push("`duties`는 mapping이어야 합니다.");
  } else {
    const duties = data.duties as JsonRecord;
    for (const duty of REQUIRED_ROLE_DUTIES) {
      if (!(duty in duties)) {
        errors.push(`\`duties.${duty}\`가 없습니다.`);
        continue;
      }
      const value = duties[duty];
      if (typeof value !== "string" || !roleIds.has(value)) {
        errors.push(`\`duties.${duty}\`는 정의된 role id 중 하나여야 합니다.`);
      }
    }
  }

  const runtimeMemory = data.runtime_memory;
  if (!runtimeMemory || typeof runtimeMemory !== "object" || Array.isArray(runtimeMemory)) {
    errors.push("`runtime_memory`는 비어 있지 않은 mapping이어야 합니다.");
  } else {
    const record = runtimeMemory as JsonRecord;
    for (const requiredKey of ["specs", "decisions", "session_log"]) {
      if (!(requiredKey in record)) {
        errors.push(`\`runtime_memory.${requiredKey}\`가 없습니다.`);
      }
    }

    for (const [key, value] of Object.entries(record)) {
      const label = `runtime_memory.${key}`;
      if (typeof value !== "string") {
        errors.push(`${label}는 문자열이어야 합니다.`);
        continue;
      }
      ensurePathPrefix(value, [".claude/memory/", ".claude/runtime/"], label, errors);
      if (!existsSync(normalizeRepoPath(root, value))) {
        errors.push(`${label} 경로가 존재하지 않습니다: \`${value}\``);
      }
    }
  }

  const generatedArtifacts = data.generated_artifacts;
  if (!generatedArtifacts || typeof generatedArtifacts !== "object" || Array.isArray(generatedArtifacts)) {
    errors.push("`generated_artifacts`는 비어 있지 않은 mapping이어야 합니다.");
  } else {
    for (const [key, value] of Object.entries(generatedArtifacts as JsonRecord)) {
      const label = `generated_artifacts.${key}`;
      if (typeof value !== "string") {
        errors.push(`${label}는 문자열이어야 합니다.`);
        continue;
      }
      ensurePathPrefix(value, [".agents/", ".agents"], label, errors);
    }
  }

  if (!manifestPath.endsWith("/agent-manifest.yaml") && !manifestPath.endsWith("\\agent-manifest.yaml")) {
    errors.push("manifest 파일명은 `agent-manifest.yaml`이어야 합니다.");
  }

  return errors;
}

function printSuccess(manifestPath: string, data: JsonRecord, asJson: boolean): void {
  const payload = {
    valid: true,
    manifest_path: manifestPath,
    role_count: Array.isArray(data.roles) ? data.roles.length : 0,
    generated_target_count: Array.isArray(data.generated_targets) ? data.generated_targets.length : 0,
    runtime_memory_keys:
      data.runtime_memory && typeof data.runtime_memory === "object" && !Array.isArray(data.runtime_memory)
        ? Object.keys(data.runtime_memory as JsonRecord).sort()
        : [],
  };

  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log("VALID=true");
  console.log(`MANIFEST_PATH=${payload.manifest_path}`);
  console.log(`ROLE_COUNT=${payload.role_count}`);
  console.log(`GENERATED_TARGET_COUNT=${payload.generated_target_count}`);
  console.log(`RUNTIME_MEMORY_KEYS=${payload.runtime_memory_keys.join(",")}`);
}

async function main(): Promise<number> {
  const options = parseOptions(process.argv.slice(2));
  const root = repoRoot();
  const manifestPath = resolve(root, options.manifest);

  if (!existsSync(manifestPath)) {
    console.error(`manifest 파일이 없습니다: ${manifestPath}`);
    return 1;
  }

  const data = await loadYaml(manifestPath);
  const errors = validateManifest(data, manifestPath, root);
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }
    return 1;
  }

  printSuccess(manifestPath, data, options.json);
  return 0;
}

await main().then((code) => process.exit(code)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
