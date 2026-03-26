#!/bin/bash
# Crucible Telemetry Tracker
# 스킬 실행 통계를 로컬 JSONL 파일에 기록합니다.
#
# 외부 전송 없이 로컬 파일만 사용합니다.
# 수집 데이터: 스킬명, 실행 시간, Phase, 결과 (코드/프롬프트/사용자 데이터 절대 미수집)
#
# Usage:
#   source tracker.sh
#   crucible_track_start "crucible-gate"
#   ... (스킬 실행) ...
#   crucible_track_end "crucible-gate" "PASS"

TELEMETRY_DIR_RAW="${CRUCIBLE_TELEMETRY_DIR:-${HOME}/.crucible/telemetry}"
TELEMETRY_DIR="${TELEMETRY_DIR_RAW/#\~/${HOME}}"
TELEMETRY_FILE="${TELEMETRY_DIR}/events.jsonl"
TELEMETRY_STATE_DIR="${TELEMETRY_DIR}/state"
TRACKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TELEMETRY_CLI="${TRACKER_DIR}/telemetry_cli.ts"
export CRUCIBLE_TELEMETRY_FILE="${TELEMETRY_FILE}"

# 텔레메트리 디렉토리 생성
mkdir -p "${TELEMETRY_DIR}"
mkdir -p "${TELEMETRY_STATE_DIR}"

crucible_track_safe_name() {
    local raw_name="${1:-unknown}"
    echo "${raw_name}" | tr ' /:' '___'
}

crucible_now_ms() {
    local candidate
    candidate=$(date +%s%3N 2>/dev/null || true)
    if [[ "${candidate}" =~ ^[0-9]+$ ]]; then
        echo "${candidate}"
        return 0
    fi

    if command -v bun &>/dev/null; then
        bun -e 'console.log(Date.now())'
        return 0
    fi

    printf '%s000\n' "$(date +%s)"
}

# 시작 시간 기록
crucible_track_start() {
    local skill_name="$1"
    export CRUCIBLE_TRACK_SKILL="${skill_name}"
    export CRUCIBLE_TRACK_START
    CRUCIBLE_TRACK_START=$(crucible_now_ms)
}

# 종료 시간 기록 + JSONL에 이벤트 추가
crucible_track_end() {
    local skill_name="${1:-$CRUCIBLE_TRACK_SKILL}"
    local result="${2:-unknown}"  # PASS, FAIL, SKIP, ERROR
    local end_time
    end_time=$(crucible_now_ms)
    local start_time="${CRUCIBLE_TRACK_START:-$end_time}"
    local duration_ms=$((end_time - start_time))
    local phase="${CRUCIBLE_PHASE:-unknown}"
    local project="${CRUCIBLE_PROJECT_NAME:-unknown}"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # JSONL 이벤트 기록
    cat >> "${TELEMETRY_FILE}" << EOF
{"event":"skill_execution","skill":"${skill_name}","result":"${result}","duration_ms":${duration_ms},"phase":"${phase}","project":"${project}","timestamp":"${timestamp}"}
EOF

    # 환경변수 정리
    unset CRUCIBLE_TRACK_SKILL
    unset CRUCIBLE_TRACK_START
}

crucible_track_tool_start() {
    local tool_name="${1:-unknown}"
    local safe_name
    safe_name=$(crucible_track_safe_name "${tool_name}")
    local start_file="${TELEMETRY_STATE_DIR}/${safe_name}.start"
    local start_time
    start_time=$(crucible_now_ms)
    printf '%s\n' "${start_time}" > "${start_file}"
}

crucible_track_tool_end() {
    local tool_name="${1:-unknown}"
    local result="${2:-completed}"
    local safe_name
    safe_name=$(crucible_track_safe_name "${tool_name}")
    local start_file="${TELEMETRY_STATE_DIR}/${safe_name}.start"
    local end_time
    end_time=$(crucible_now_ms)
    local start_time="${end_time}"

    if [ -f "${start_file}" ]; then
        start_time=$(cat "${start_file}" 2>/dev/null || echo "${end_time}")
        rm -f "${start_file}"
    fi

    local duration_ms=$((end_time - start_time))
    local phase="${CRUCIBLE_PHASE:-unknown}"
    local project="${CRUCIBLE_PROJECT_NAME:-unknown}"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    cat >> "${TELEMETRY_FILE}" << EOF
{"event":"tool_execution","tool":"${tool_name}","result":"${result}","duration_ms":${duration_ms},"phase":"${phase}","project":"${project}","timestamp":"${timestamp}"}
EOF
}

# 보고서 생성 (crucible-status에서 호출)
crucible_telemetry_report() {
    bun "${TELEMETRY_CLI}" report --file "${TELEMETRY_FILE}"
}

crucible_telemetry_snapshot_json() {
    bun "${TELEMETRY_CLI}" snapshot --file "${TELEMETRY_FILE}"
}

crucible_telemetry_gate_hint() {
    bun "${TELEMETRY_CLI}" gate-hint --file "${TELEMETRY_FILE}"
}

# 병목 분석
crucible_telemetry_bottleneck() {
    bun "${TELEMETRY_CLI}" bottleneck --file "${TELEMETRY_FILE}"
}
