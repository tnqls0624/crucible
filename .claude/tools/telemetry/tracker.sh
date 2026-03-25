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

TELEMETRY_DIR="${HOME}/.crucible/telemetry"
TELEMETRY_FILE="${TELEMETRY_DIR}/events.jsonl"

# 텔레메트리 디렉토리 생성
mkdir -p "${TELEMETRY_DIR}"

# 시작 시간 기록
crucible_track_start() {
    local skill_name="$1"
    export CRUCIBLE_TRACK_SKILL="${skill_name}"
    export CRUCIBLE_TRACK_START=$(date +%s%3N 2>/dev/null || python3 -c "import time; print(int(time.time()*1000))")
}

# 종료 시간 기록 + JSONL에 이벤트 추가
crucible_track_end() {
    local skill_name="${1:-$CRUCIBLE_TRACK_SKILL}"
    local result="${2:-unknown}"  # PASS, FAIL, SKIP, ERROR
    local end_time=$(date +%s%3N 2>/dev/null || python3 -c "import time; print(int(time.time()*1000))")
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

# 보고서 생성 (crucible-status에서 호출)
crucible_telemetry_report() {
    if [ ! -f "${TELEMETRY_FILE}" ]; then
        echo "No telemetry data found."
        return 0
    fi

    echo "=== Crucible Telemetry Report ==="
    echo ""

    # 총 이벤트 수
    local total=$(wc -l < "${TELEMETRY_FILE}" | tr -d ' ')
    echo "Total executions: ${total}"
    echo ""

    # 스킬별 실행 횟수 + 평균 시간
    echo "--- By Skill ---"
    if command -v python3 &> /dev/null; then
        python3 << 'PYEOF'
import json, sys
from collections import defaultdict

stats = defaultdict(lambda: {"count": 0, "total_ms": 0, "pass": 0, "fail": 0})

try:
    with open(sys.argv[1] if len(sys.argv) > 1 else f"{__import__('os').environ['HOME']}/.crucible/telemetry/events.jsonl") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            ev = json.loads(line)
            s = ev.get("skill", "unknown")
            stats[s]["count"] += 1
            stats[s]["total_ms"] += ev.get("duration_ms", 0)
            if ev.get("result") == "PASS":
                stats[s]["pass"] += 1
            elif ev.get("result") == "FAIL":
                stats[s]["fail"] += 1
except FileNotFoundError:
    print("No telemetry file found.")
    sys.exit(0)

print(f"{'Skill':<25} {'Count':>6} {'Avg(ms)':>10} {'Pass':>6} {'Fail':>6}")
print("-" * 60)
for skill, data in sorted(stats.items(), key=lambda x: -x[1]["count"]):
    avg = data["total_ms"] // data["count"] if data["count"] else 0
    print(f"{skill:<25} {data['count']:>6} {avg:>10} {data['pass']:>6} {data['fail']:>6}")
PYEOF
    else
        echo "(python3 required for detailed report)"
        echo "Events: $(wc -l < "${TELEMETRY_FILE}")"
    fi

    echo ""
    echo "--- Recent Events (last 10) ---"
    tail -10 "${TELEMETRY_FILE}" | while read line; do
        skill=$(echo "$line" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{d[\"timestamp\"]} {d[\"skill\"]:<20} {d[\"result\"]:<6} {d[\"duration_ms\"]}ms')" 2>/dev/null || echo "$line")
        echo "  $skill"
    done
}

# 병목 분석
crucible_telemetry_bottleneck() {
    if [ ! -f "${TELEMETRY_FILE}" ]; then
        echo "No telemetry data."
        return 0
    fi

    echo "=== Bottleneck Analysis ==="
    python3 << 'PYEOF'
import json, sys, os

events = []
try:
    with open(f"{os.environ['HOME']}/.crucible/telemetry/events.jsonl") as f:
        for line in f:
            if line.strip():
                events.append(json.loads(line.strip()))
except FileNotFoundError:
    print("No telemetry file.")
    sys.exit(0)

if not events:
    print("No events recorded.")
    sys.exit(0)

# Slowest skills
print("\n🐌 Slowest Skills (avg execution time):")
from collections import defaultdict
times = defaultdict(list)
for ev in events:
    times[ev["skill"]].append(ev.get("duration_ms", 0))

for skill, durations in sorted(times.items(), key=lambda x: -sum(x[1])/len(x[1])):
    avg = sum(durations) // len(durations)
    mx = max(durations)
    print(f"  {skill:<25} avg={avg}ms  max={mx}ms  count={len(durations)}")

# Most failed
print("\n❌ Most Failed Skills:")
fails = defaultdict(int)
for ev in events:
    if ev.get("result") == "FAIL":
        fails[ev["skill"]] += 1
if fails:
    for skill, count in sorted(fails.items(), key=lambda x: -x[1]):
        print(f"  {skill:<25} {count} failures")
else:
    print("  No failures recorded!")

# Phase distribution
print("\n📊 Phase Distribution:")
phases = defaultdict(int)
for ev in events:
    phases[ev.get("phase", "unknown")] += 1
for phase, count in sorted(phases.items(), key=lambda x: -x[1]):
    print(f"  {phase:<15} {count} executions")
PYEOF
}
