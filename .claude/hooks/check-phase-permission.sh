#!/bin/bash
# Crucible Hook: Phase Permission Check
# 현재 파이프라인 단계에서 허용되지 않는 파일 수정을 차단합니다.
# 예: spec 단계에서 src/ 수정 불가, build 단계에서 spec 수정 불가

set -euo pipefail

TOOL_INPUT="${1:-}"
FILE_PATH=""

# JSON 입력에서 file_path 추출 시도
if command -v jq &>/dev/null && [ -n "$TOOL_INPUT" ]; then
    FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null || true)
fi

# 파일 경로가 없으면 통과
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# 현재 Phase 확인
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SETTINGS_FILE="$PROJECT_DIR/.claude/settings.json"

CURRENT_PHASE=""
if [ -f "$SETTINGS_FILE" ] && command -v jq &>/dev/null; then
    CURRENT_PHASE=$(jq -r '.env.CRUCIBLE_PHASE // empty' "$SETTINGS_FILE" 2>/dev/null || true)
fi

# Phase가 설정되지 않았으면 통과 (Crucible 미초기화 상태)
if [ -z "$CURRENT_PHASE" ]; then
    exit 0
fi

# spec/plan 단계에서는 `.claude`가 source of truth이므로 내부 문서/설정 수정 허용
if [[ "$FILE_PATH" == *".claude/"* ]]; then
    case "$CURRENT_PHASE" in
        spec|plan)
            exit 0
            ;;
    esac
fi

# Phase별 제한 규칙
case "$CURRENT_PHASE" in
    spec)
        # spec 단계: 소스 코드 수정 불가
        if [[ "$FILE_PATH" == *"src/"* ]] || \
           [[ "$FILE_PATH" == *"lib/"* ]] || \
           [[ "$FILE_PATH" == *"app/"* ]]; then
            echo "FORGE PHASE GUARD: 현재 'spec' 단계입니다."
            echo "소스 코드 수정은 'build' 단계에서만 허용됩니다."
            echo "'/crucible-spec' → '/crucible-plan' → '/crucible-build' 순서를 따라주세요."
            echo ""
            echo "이 제한을 무시하려면 사용자에게 명시적 오버라이드를 요청하세요."
            exit 1
        fi
        ;;
    plan)
        # plan 단계: 소스 코드 수정 불가
        if [[ "$FILE_PATH" == *"src/"* ]] || \
           [[ "$FILE_PATH" == *"lib/"* ]] || \
           [[ "$FILE_PATH" == *"app/"* ]]; then
            echo "FORGE PHASE GUARD: 현재 'plan' 단계입니다."
            echo "소스 코드 수정은 'build' 단계에서만 허용됩니다."
            echo "'/crucible-plan'을 완료하고 '/crucible-build'로 진행하세요."
            exit 1
        fi
        ;;
    build)
        # build 단계: source-of-truth 문서 변경 불가 (스펙/프로토콜 변경은 CTO를 통해서만)
        if [[ "$FILE_PATH" == *".claude/memory/specs/"* ]]; then
            echo "FORGE PHASE GUARD: 현재 'build' 단계입니다."
            echo "스펙 수정이 필요하면 CTO 에이전트를 통해 에스컬레이션하세요."
            exit 1
        fi
        if [[ "$FILE_PATH" == *".claude/gates/"* ]] || \
           [[ "$FILE_PATH" == *".claude/protocols/"* ]] || \
           [[ "$FILE_PATH" == *".claude/hooks/"* ]] || \
           [[ "$FILE_PATH" == *".claude/agents/"* ]] || \
           [[ "$FILE_PATH" == *".claude/skills/"* ]]; then
            echo "FORGE PHASE GUARD: 현재 'build' 단계에서는 source-of-truth 운영 문서를 수정할 수 없습니다."
            echo "운영 규칙 변경이 필요하면 CTO를 통해 plan 단계로 되돌린 뒤 조정하세요."
            exit 1
        fi
        ;;
    gate)
        # gate 단계: 소스 코드 수정은 PDCA 루프를 통해서만
        # (이 훅은 기본 허용하되, crucible-gate 스킬이 재시도 횟수를 관리)
        ;;
    ship)
        # ship 단계: 소스 코드 수정 불가 (릴리스/문서 정리만 허용)
        if [[ "$FILE_PATH" == *"src/"* ]] || \
           [[ "$FILE_PATH" == *"lib/"* ]] || \
           [[ "$FILE_PATH" == *"app/"* ]]; then
            echo "FORGE PHASE GUARD: 현재 'ship' 단계입니다."
            echo "소스 코드 수정이 필요하면 'build' 단계로 돌아가세요."
            exit 1
        fi
        ;;
esac

exit 0
