# Build Quality Gate (Zero-Tolerance)

> gate → ship 전환을 위한 통과 조건
> 이 게이트는 build 단계 구현물이 준비된 뒤 gate 단계에서 실행하는 이중 구조입니다: Gate A (Validation) + Gate B (Testing)
> 현재 프로젝트가 `documentation-first` 상태라면 이 게이트는 아직 실행 대상이 아닙니다.

## Gate A: Validation (빠름, 결정론적)

Gate A가 실패하면 Gate B는 실행하지 않습니다.

| # | Check | Command | Pass Condition |
|---|-------|---------|----------------|
| A1 | Type Check | `pyright` / `tsc --noEmit` / `go vet` | 0 errors |
| A2 | Linter | `ruff check` / `eslint` / `golangci-lint run` | 0 warnings, 0 errors |
| A3 | Format Check | `ruff format --check` / `prettier --check` | 변경 없음 |

## Gate B: Testing (느림, 포괄적)

| # | Check | Command | Pass Condition |
|---|-------|---------|----------------|
| B1 | Unit Tests | `pytest` / `vitest` / `go test ./...` | All pass |
| B2 | Test Coverage | coverage report | >= 프로젝트 threshold |
| B3 | Spec Compliance | 구현 코드 vs spec 비교 | 모든 Feature ID 구현 |
| B4 | No TODO/FIXME | Grep: `TODO\|FIXME` in 신규/변경 파일 | 0 매치 |
| B5 | Security Audit | security-auditor 에이전트 | CRITICAL 0건 |
| B6 | Browser QA | crucible-qa (web-app 타입만) | 핵심 시나리오 PASS |
| B7 | Performance | 벤치마크 baseline 대비 비교 | regression 없음 |

## PDCA Retry Loop

실패 시 자동 재시도 프로세스:

1. **Check**: 게이트 실행, 실패 항목 식별
2. **Act**: 에러 로그를 engineer 에이전트에 전달
3. **재시도**: engineer가 수정 후 게이트 재실행
4. **제한**: 최대 2회 재시도. 2회 실패 시 사용자 에스컬레이션

```
[Gate 실행] → PASS → 다음 단계
     │
     └─ FAIL → [Engineer 수정] → [Gate 재실행] → PASS → 다음 단계
                                       │
                                       └─ FAIL → [Engineer 수정 #2] → [Gate 재실행] → PASS
                                                                            │
                                                                            └─ FAIL → 사용자 에스컬레이션
```

## Failure Actions

- A1 타입 에러 → 에러 위치와 메시지를 engineer에게 전달
- A2 린트 경고 → 자동 수정 시도 (`ruff check --fix` / `eslint --fix`)
- B1 테스트 실패 → 실패 테스트명과 로그를 engineer에게 전달
- B3 스펙 미준수 → 미구현 Feature ID 목록 제시
- B5 보안 취약점 → CRITICAL 이슈를 engineer에게 전달, OWASP 참조 포함
- B6 QA 실패 → 실패 시나리오 스크린샷과 기대/실제 결과를 engineer에게 전달
- B7 성능 퇴행 → baseline 대비 느려진 항목과 측정값을 engineer에게 전달

## Pass Action

- `.claude/CLAUDE.md`의 Phase를 `ship`으로 업데이트
- `.claude/settings.json`의 `CRUCIBLE_PHASE`를 `ship`으로 업데이트
- 게이트 통과 보고서 생성 (날짜, 결과 테이블)
