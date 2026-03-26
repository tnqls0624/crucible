#!/usr/bin/env bun

import { existsSync } from "node:fs";

type Assertion = {
  name: string;
  text: string;
  type?: string;
  pattern?: string;
  heading?: string;
};

type Metadata = {
  eval_id: string;
  eval_name: string;
  assertions: Assertion[];
};

function fail(message: string): never {
  throw new Error(message);
}

async function gradeSpec(specPath: string, metadataPath: string): Promise<Record<string, unknown>> {
  const spec = existsSync(specPath) ? await Bun.file(specPath).text() : "";
  const metadata = JSON.parse(await Bun.file(metadataPath).text()) as Metadata;

  const results = metadata.assertions.map((assertion) => {
    let passed = false;
    let evidence = "";

    if (assertion.type === "regex" && assertion.pattern) {
      const matches = spec.match(new RegExp(assertion.pattern, "g")) ?? [];
      passed = matches.length > 0;
      evidence = passed
        ? `Found ${matches.length} matches: ${matches.slice(0, 3).join(", ")}`
        : `No match for pattern: ${assertion.pattern}`;
    } else if (assertion.type === "heading_exists" && assertion.heading) {
      const pattern = new RegExp(`^#{1,4}\\s+.*${assertion.heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*$`, "gim");
      const matches = spec.match(pattern) ?? [];
      passed = matches.length > 0;
      evidence = passed ? `Found heading: ${matches[0]}` : `No heading containing '${assertion.heading}'`;
    } else if (assertion.type === "content_check") {
      if (assertion.text.includes("알림 타입") || assertion.text.toLowerCase().includes("notification")) {
        const keywords = ["주문", "메시지", "공지"];
        const found = keywords.filter((keyword) => spec.includes(keyword));
        passed = found.length >= 3;
        evidence = `Found ${found.length}/3 notification types: ${found.join(", ")}`;
      }
    } else if (assertion.type === "composite") {
      const required = ["Problem", "Journey", "Feature", "Constraint", "Acceptance", "Data Model"];
      const found = required.filter((section) => new RegExp(`^#{1,4}\\s+.*${section}.*$`, "gim").test(spec));
      const missing = required.filter((section) => !found.includes(section));
      passed = missing.length === 0;
      evidence =
        missing.length === 0
          ? `All ${required.length} required sections present`
          : `Found ${found.length}/${required.length} sections. Missing: ${missing.join(", ")}`;
    }

    return {
      text: assertion.text,
      passed,
      evidence,
    };
  });

  const passCount = results.filter((result) => result.passed).length;
  return {
    eval_id: metadata.eval_id,
    eval_name: metadata.eval_name,
    expectations: results,
    pass_rate: results.length > 0 ? passCount / results.length : 0,
  };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error("Usage: grade_spec.ts <spec_file> <metadata_file>");
    return 1;
  }

  const [specPath, metadataPath] = args;
  if (!specPath || !metadataPath) {
    fail("spec_path와 metadata_path가 필요합니다.");
  }

  console.log(JSON.stringify(await gradeSpec(specPath, metadataPath), null, 2));
  return 0;
}

await main().then((code) => process.exit(code)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
