#!/usr/bin/env python3
"""Grade crucible-spec outputs against assertions."""
import json
import re
import sys
from pathlib import Path


def grade_spec(spec_path: str, metadata_path: str) -> dict:
    spec = Path(spec_path).read_text(encoding="utf-8") if Path(spec_path).exists() else ""
    metadata = json.loads(Path(metadata_path).read_text(encoding="utf-8"))

    results = []
    for assertion in metadata["assertions"]:
        name = assertion["name"]
        text = assertion["text"]
        passed = False
        evidence = ""

        if assertion.get("type") == "regex":
            pattern = assertion["pattern"]
            matches = re.findall(pattern, spec)
            passed = len(matches) > 0
            evidence = f"Found {len(matches)} matches: {matches[:3]}" if passed else f"No match for pattern: {pattern}"

        elif assertion.get("type") == "heading_exists":
            heading = assertion["heading"]
            # Check for markdown headings containing the keyword (case-insensitive)
            pattern = rf"^#{{1,4}}\s+.*{re.escape(heading)}.*$"
            matches = re.findall(pattern, spec, re.MULTILINE | re.IGNORECASE)
            passed = len(matches) > 0
            evidence = f"Found heading: {matches[0]}" if passed else f"No heading containing '{heading}'"

        elif assertion.get("type") == "content_check":
            # Special case for notification types
            if "알림 타입" in text or "notification" in text.lower():
                keywords = ["주문", "메시지", "공지"]
                found = [k for k in keywords if k in spec]
                passed = len(found) >= 3
                evidence = f"Found {len(found)}/3 notification types: {found}"

        elif assertion.get("type") == "composite":
            # gate-spec passable: check all required sections
            required = ["Problem", "Journey", "Feature", "Constraint", "Acceptance", "Data Model"]
            found = []
            missing = []
            for req in required:
                if re.search(rf"^#{{1,4}}\s+.*{req}.*$", spec, re.MULTILINE | re.IGNORECASE):
                    found.append(req)
                else:
                    missing.append(req)
            passed = len(missing) == 0
            evidence = f"Found {len(found)}/{len(required)} sections. Missing: {missing}" if missing else f"All {len(required)} required sections present"

        results.append({"text": text, "passed": passed, "evidence": evidence})

    return {
        "eval_id": metadata["eval_id"],
        "eval_name": metadata["eval_name"],
        "expectations": results,
        "pass_rate": sum(1 for r in results if r["passed"]) / len(results) if results else 0,
    }


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: grade_spec.py <spec_file> <metadata_file>")
        sys.exit(1)
    result = grade_spec(sys.argv[1], sys.argv[2])
    print(json.dumps(result, indent=2, ensure_ascii=False))
