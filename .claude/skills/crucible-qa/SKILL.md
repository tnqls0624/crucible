---
name: crucible-qa
description: |
  브라우저 기반 QA 테스팅을 기본으로 수행하고, build 단계에서는 runtime evaluator로도 동작합니다. UI 인터랙션 검증, 시각적 회귀 테스트, E2E 플로우 테스트를 실행하며, 필요할 때는 API/log/command 기반 runtime verification도 수행합니다. Claude Preview MCP 또는 Playwright MCP를 활용하여 실제 브라우저에서 사용자 시나리오를 재현하고, 스펙의 User Journey와 ADR의 Task Contract를 함께 대조 검증합니다. crucible-gate의 Gate B와 연계하여 UI 또는 runtime 레벨 품질을 보장합니다.

  ALWAYS use this skill when:
  - 사용자가 `/crucible-qa` 명령을 사용할 때
  - "브라우저 테스트", "E2E 테스트", "UI 테스트" 언급 시
  - "화면 확인", "스크린샷", "시각적 확인", "visual test" 언급 시
  - "사용자 시나리오 테스트", "user journey 검증" 언급 시
  - "QA 실행", "QA 돌려", "품질 보증" 언급 시
  - web-app 프로젝트에서 구현 완료 후 UI 검증이 필요할 때
  - build 단계에서 API/runtime evidence가 필요한 evaluator 경로일 때
  - crucible-gate 실행 전 브라우저 레벨 확인이 필요할 때

  Example triggers: "로그인 페이지 만들었는데 브라우저에서 테스트해줘", "회원가입 플로우를 E2E로 검증해줘. 스펙대로 동작하는지 확인해"
---

# /crucible-qa — 브라우저/런타임 QA

AI가 실제 브라우저 또는 런타임 entry point를 통해 사용자 시나리오를 재현하고, 스펙의 User Journey와 ADR의 Task Contract를 함께 대조합니다. 정적 테스트(pytest/vitest)가 잡지 못하는 UI 레벨 버그, API drift, runtime contract drift를 발견합니다.

## Prerequisites

- 현재 Phase가 `build` 또는 `gate`
- 직접 `/crucible-qa`를 실행하는 기본 경로는 `web-app`
- build 단계 evaluator 모드에서는 `web-app`, `backend-api`, `cli-tool` 모두 가능
- 검증 가능한 runtime entry point가 준비되어 있어야 함 (`Preview URL`, HTTP endpoint, command, log 중 하나)

## Browser Tool: crucible-browse

Crucible은 **Persistent Headless Chromium Daemon**을 내장합니다.
MCP 대신 Bash를 통해 직접 브라우저를 제어하므로 토큰 오버헤드가 0이고, 후속 명령 레이턴시가 ~30ms입니다.

### 바이너리 위치
```
.claude/tools/browser/bin/crucible-browse   # install 후 생성되는 바이너리
.claude/tools/browser/src/                  # 소스 코드
```

> 공개 저장소에는 `bin/`과 `node_modules/`를 커밋하지 않습니다. 브라우저 도구가 필요하면 repo root에서 `./setup --host claude --with-browser` 또는 `./setup --host codex --with-browser`를 실행해 생성합니다.

### 사용법 (Bash 도구로 실행)
```bash
$B=".claude/tools/browser/bin/crucible-browse"
APP_BASE_URL="<app-base-url>"

# 네비게이션
$B goto --url "$APP_BASE_URL"
$B back
$B reload

# 스냅샷 (ARIA 트리 + @ref 할당)
$B snapshot

# 인터랙션 (@ref 사용)
$B click @e3
$B fill @e5 --value "user@test.com"
$B press --key Enter

# 스크린샷
$B screenshot --dir ./qa-screenshots

# 상태 확인
$B health
$B shutdown
```

### 아키텍처
```
Bash($B command) → CLI(thin client) → HTTP local loopback → Bun.serve() → Playwright → Chromium
                                       ~30ms latency     persistent daemon
```

- **첫 호출**: ~400ms (데몬 스폰 + Chromium 실행)
- **후속 호출**: ~30ms (HTTP POST만)
- **유휴 종료**: 30분 무활동 시 자동 종료
- **Ref 시스템**: `@e1`, `@e2` — ARIA 트리 기반, CSS 셀렉터 불필요
- **Staleness 감지**: 없어진 요소 클릭 시 에러 + "snapshot 재실행" 안내

### Fallback (바이너리 미설치 시)

| 도구 | 우선순위 | 장점 |
|------|---------|------|
| crucible-browse 바이너리 | 1순위 | 최소 레이턴시, 영속 상태 |
| Claude Preview MCP | 2순위 | 네이티브 통합 |
| Playwright MCP | 3순위 | 프로그래밍적 제어 |
| Bash + curl | 4순위 (fallback) | API 레벨 테스트만 |

## Workflow

### Step 1: 테스트 시나리오 추출

스펙의 User Journey와 ADR의 `Task Contract`를 테스트 시나리오로 변환합니다:

```markdown
# Spec + Task Contract → QA Scenario

## User Journey (from spec)
"사용자가 이메일/비밀번호로 회원가입 → 이메일 확인 → 로그인 → 대시보드 접근"

## Verification (from ADR Task Contract)
- 회원가입 성공 후 확인 메시지 표시
- 로그인 성공 시 대시보드 리다이렉트
- 잘못된 입력은 명시적 에러 반환

## QA Scenarios
1. 회원가입 폼 정상 입력 → 성공 메시지
2. 중복 이메일로 회원가입 → 에러 메시지
3. 비밀번호 규칙 미충족 → 유효성 에러
4. 로그인 성공 → 대시보드 리다이렉트
5. 잘못된 비밀번호 → 에러 메시지
```

Task Contract의 `Non-goals`에 포함된 항목은 QA 범위에서 기본 제외합니다. 다만 브라우저에서 우연히 발견된 중대한 회귀는 별도 observation으로 기록합니다. QA report와 gate 보고서는 반드시 같은 `Task ID`를 사용해야 합니다.

### Step 2: Entry Point 준비

```bash
# 프로젝트 스택에 따라 자동 선택
# Python: uvicorn main:app --reload
# Node: npm run dev
# Go: go run .
```

모드별 준비 기준:
- Browser 모드: 개발 서버 또는 preview URL이 준비되어 있어야 함
- Runtime evaluator 모드: health check 가능한 HTTP endpoint, 재현 가능한 CLI command, 또는 로그 수집 경로가 준비되어 있어야 함

서버나 프로세스가 준비될 때까지 대기합니다 (health check endpoint, 포트 확인, command exit code 확인 등).

### Step 3: 시나리오 실행

Browser 모드에서는 `crucible-browse` 바이너리를 사용하여 각 시나리오를 순차 실행합니다:

```bash
$B=".claude/tools/browser/bin/crucible-browse"
APP_BASE_URL="<app-base-url>"

# 1. Navigate → 페이지 로드 확인
$B goto --url "${APP_BASE_URL}/signup"

# 2. Snapshot → ARIA 트리 + @ref 할당
$B snapshot
# 출력: @e1 [textbox] "이메일", @e2 [textbox] "비밀번호", @e3 [button] "가입"

# 3. Interact → 폼 입력, 버튼 클릭
$B fill @e1 --value "test@example.com"
$B fill @e2 --value "SecureP@ss123"
$B click @e3

# 4. Verify → 스냅샷으로 결과 확인
$B snapshot
# 성공 메시지가 ARIA 트리에 나타나는지 확인

# 5. Screenshot → 시각적 증거 저장
$B screenshot --dir ./qa-screenshots
```

Runtime evaluator 모드에서는 entry point에 맞는 채널을 선택합니다:

```bash
# backend-api 예시
API_BASE_URL="<api-base-url>"
curl -i "${API_BASE_URL}/health"
curl -i -X POST "${API_BASE_URL}/api/items" -H 'content-type: application/json' -d '{"name":"demo"}'

# cli-tool 예시
./bin/app sync --dry-run
tail -n 100 ./logs/dev.log
```

각 시나리오 결과를 기록합니다:
- PASS: 기대 동작과 일치
- FAIL: 기대와 불일치 (스크린샷 + 에러 상세)
- SKIP: 전제 조건 미충족

각 결과는 가능하면 아래 둘 중 하나와 연결되어야 합니다.
- 스펙의 User Journey / Feature Requirement
- ADR Task Contract의 Verification / Acceptance Criteria

### Step 4: 시각적 회귀 검사

이전 실행의 스크린샷과 현재 스크린샷을 비교합니다 (있을 경우):
- 레이아웃 변경 감지
- 의도치 않은 UI 변경 플래그
- 반응형 뷰포트 테스트 (모바일 375px, 태블릿 768px, 데스크톱 1280px)

### Step 5: 접근성 검사

브라우저 접근성 트리를 분석하여 기본 접근성 문제를 탐지합니다:
- 이미지 alt 텍스트 누락
- 폼 라벨 연결 누락
- 키보드 탐색 가능 여부
- 색상 대비 (WCAG AA 기준)

### Step 6: 보고서 생성

직접 `/crucible-qa`를 호출한 경우 canonical report path는 아래 명령으로 계산합니다.

```bash
bun .claude/tools/reports/report_registry.ts path \
  --task-id ADR002-T4 \
  --kind qa \
  --bare
```

## Output Format

```markdown
+++
schema_version = 1
report_type = "qa"
task_id = "ADR002-T4"
generated_at = "2026-03-26T12:20:00Z"
verdict = "FAIL"
execution_channel = "Chromium (headless)"
scenarios = ["회원가입 정상", "중복 이메일", "비밀번호 규칙", "로그인 성공", "잘못된 비밀번호"]
contract_items = ["Verification step 1", "Verification step 2"]
+++

## Crucible QA Report

**Date**: 2026-03-26
**Feature**: {feature name} ({feature ID})
**Task ID**: {ADR002-T4 형태의 canonical identifier}
**Execution Channel**: Chromium (headless) | HTTP | CLI | Logs
**Viewport**: 1280x720 또는 N/A
**Task Name**: {task name}

### Test Results
| # | Scenario | Result | Duration |
|---|----------|--------|----------|
| 1 | 회원가입 정상 | PASS | 2.3s |
| 2 | 중복 이메일 | PASS | 1.8s |
| 3 | 비밀번호 규칙 | FAIL | 1.5s |
| 4 | 로그인 성공 | PASS | 2.1s |
| 5 | 잘못된 비밀번호 | PASS | 1.7s |

### Summary
- **Total**: 5 scenarios
- **Passed**: 4
- **Failed**: 1
- **Pass Rate**: 80%

### Failed Scenarios Detail
#### Scenario 3: 주요 입력 검증 실패
- **Expected**: 잘못된 입력에 대해 명시적 에러 메시지 표시
- **Actual**: 에러 메시지 없이 다음 단계로 진행됨
- **Screenshot**: [첨부]
- **Spec Reference**: 해당 스펙의 Acceptance Criteria 참조
- **Contract Reference**: Verification 또는 Done Definition 항목 참조

### Contract Coverage
| Contract Item | Status | Notes |
|---------------|--------|-------|
| Verification step 1 | PASS/FAIL/SKIP | {비고} |
| Verification step 2 | PASS/FAIL/SKIP | {비고} |

### Accessibility Issues
| Severity | Issue | Element | Fix |
|----------|-------|---------|-----|
| WARN | Missing alt text | img.logo | alt 속성 추가 |
| ERROR | No form label | input#email | label 요소 연결 |

### Visual Regression
- 변경 감지: 없음 (첫 실행)

### Recommendations
1. 실패 시 스펙의 User Journey와 실제 DOM 차이를 먼저 기록
2. 실패 시 Task Contract의 Verification 또는 Non-goals 위반 여부를 함께 기록
3. 접근성/시각 회귀 이슈는 gate-build 전 정리 권장
```

저장 후 `bun .claude/tools/reports/report_registry.ts validate --task-id "$TASK_ID" --kind qa`를 실행해 schema를 검증합니다.

> 참고: 직접 `/crucible-qa`를 호출하는 기본 경로는 web-app입니다. 다만 build 단계에서 qa 에이전트를 evaluator로 쓰는 경우에는 backend-api나 cli-tool도 runtime entry point가 있으면 지원합니다.

## Integration with crucible-gate

crucible-qa는 crucible-gate와 독립적으로 실행할 수 있지만,
gate-build의 Gate B에서 QA 결과를 참조할 수도 있습니다:

- **독립 실행**: `/crucible-qa`로 직접 호출
- **Gate 연계**: gate-build 실행 시 web-app이면 자동으로 QA 포함
- **Contract 연계**: gate-build의 Contract Compliance 체크는 동일한 `Task ID`를 가진 QA/evaluator report의 Contract Coverage를 근거로 사용할 수 있음

## Related Files

- **QA Agent**: `.claude/agents/qa.md` — 테스트 설계 전략
- **Gate**: `.claude/gates/gate-build.md` — 품질 게이트 정의
- **Spec Template**: `.claude/skills/crucible-spec/references/spec-template.md` — User Journey 섹션
