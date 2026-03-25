#!/bin/bash
# Crucible Hook: Post-Edit Lint
# Write/Edit 도구 사용 후 자동으로 해당 파일의 린트를 실행합니다.
# 실패 시 에러 메시지를 출력하여 Claude가 즉시 수정하도록 유도합니다.

set -euo pipefail

# 도구 입력에서 파일 경로 추출
TOOL_INPUT="${1:-}"
FILE_PATH=""

# JSON 입력에서 file_path 추출 시도
if command -v jq &>/dev/null && [ -n "$TOOL_INPUT" ]; then
    FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null || true)
fi

# 파일 경로가 없으면 조용히 종료
if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
    exit 0
fi

# 프로젝트 루트 결정
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# 파일 확장자에 따른 린터 선택
EXT="${FILE_PATH##*.}"

# `.claude` 내부 운영 파일은 가벼운 문법 검사만 수행
if [[ "$FILE_PATH" == *".claude/hooks/"*.sh ]]; then
    bash -n "$FILE_PATH" 2>&1 || {
        echo "FORGE GATE: bash syntax check failed for $FILE_PATH"
        exit 1
    }
    exit 0
fi

if [[ "$FILE_PATH" == *".claude/protocols/"*.yaml ]] || [[ "$FILE_PATH" == *".claude/protocols/"*.yml ]]; then
    if command -v ruby &>/dev/null; then
        ruby -e 'require "yaml"; YAML.load_file(ARGV[0])' "$FILE_PATH" 2>&1 || {
            echo "FORGE GATE: YAML parse failed for $FILE_PATH"
            exit 1
        }
    fi
    exit 0
fi

if [[ "$FILE_PATH" == *".claude/settings.json" ]]; then
    if command -v jq &>/dev/null; then
        jq empty "$FILE_PATH" >/dev/null 2>&1 || {
            echo "FORGE GATE: JSON parse failed for $FILE_PATH"
            exit 1
        }
    fi
    exit 0
fi

# 기타 `.claude` 문서는 별도 린트 없이 통과
if [[ "$FILE_PATH" == *".claude/"* ]]; then
    exit 0
fi

case "$EXT" in
    py)
        if command -v ruff &>/dev/null; then
            ruff check "$FILE_PATH" 2>&1 || {
                echo "FORGE GATE: ruff lint failed for $FILE_PATH"
                echo "Fix the lint errors above before proceeding."
                exit 1
            }
        fi
        ;;
    ts|tsx|js|jsx)
        if command -v eslint &>/dev/null; then
            eslint "$FILE_PATH" 2>&1 || {
                echo "FORGE GATE: eslint failed for $FILE_PATH"
                echo "Fix the lint errors above before proceeding."
                exit 1
            }
        fi
        ;;
    go)
        if command -v golangci-lint &>/dev/null; then
            golangci-lint run "$FILE_PATH" 2>&1 || {
                echo "FORGE GATE: golangci-lint failed for $FILE_PATH"
                echo "Fix the lint errors above before proceeding."
                exit 1
            }
        fi
        ;;
    rs)
        if command -v cargo &>/dev/null; then
            # Rust는 파일 단위 린트가 어려우므로 전체 clippy 실행
            cargo clippy --quiet 2>&1 || {
                echo "FORGE GATE: cargo clippy failed"
                echo "Fix the lint errors above before proceeding."
                exit 1
            }
        fi
        ;;
    *)
        # 알려지지 않은 확장자는 스킵
        exit 0
        ;;
esac
