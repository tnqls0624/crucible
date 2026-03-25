---
name: crucible-gate
description: |
  이중 품질 게이트를 실행합니다. Gate A(타입체크+린트+포맷)와 Gate B(테스트+커버리지+스펙준수)를 순차 실행하여 PASS/FAIL 보고서를 생성합니다. 실패 시 PDCA 루프로 자동 수정(최대 2회)을 시도합니다. Zero-tolerance 정책: 린트 경고 0개, 타입 에러 0개, 테스트 100% 통과.

  ALWAYS use this skill when:
  - 사용자가 `/crucible-gate` 명령을 사용할 때
  - "테스트 돌려", "테스트 실행", "품질 확인", "검증해줘" 언급 시
  - "게이트 실행", "게이트 체크", "quality gate", "gate check" 언급 시
  - "린트 체크", "타입 체크", "lint", "type check" 언급 시
  - "배포 전 확인", "릴리스 전 검증", "코드 품질" 언급 시
  - 구현이 완료되어 전체 검증이 필요한 시점
  - pyright, ruff, pytest 등을 일괄 실행하여 zero-tolerance 확인이 필요할 때

  Example triggers: "구현 다 됐어. 테스트 돌리고 린트 체크해서 품질 확인해줘", "품질 게이트 실행해줘. 타입 체크, 린터, 테스트 전부 통과해야 돼"
---

# /crucible-gate — 품질 게이트 실행

구현된 코드가 프로덕션에 나가기 전에 기계적으로 검증합니다. 사람의 판단에 의존하지 않고 린터, 타입 체커, 테스트 러너가 결정론적으로 PASS/FAIL을 판정합니다. 이 자동화된 게이트가 있어야 AI가 생성한 코드의 품질을 신뢰할 수 있습니다.

## Prerequisites

- 현재 Phase가 `gate` (또는 `build`에서 모든 태스크 완료)
- 구현 코드 존재

## Workflow

### Step 1: 프로젝트 스택 확인

`.claude/CLAUDE.md`와 관련 스펙 문서에서 기술 스택을 읽어 적절한 검증 커맨드를 선택합니다:

| Stack | Type Check | Linter | Test |
|-------|-----------|--------|------|
| Python | `pyright` | `ruff check` | `pytest` |
| TypeScript | `tsc --noEmit` | `eslint .` | `vitest run` |
| Go | `go vet ./...` | `golangci-lint run` | `go test ./...` |

### Step 2: Gate A — Validation (결정론적, 빠름)

정적 분석을 먼저 실행합니다. Gate A가 실패하면 Gate B는 스킵합니다 — 타입 에러가 있는 코드의 테스트를 돌리는 것은 시간 낭비이기 때문입니다.

1. **Type Check**: 0 errors
2. **Linter**: 0 warnings, 0 errors
3. **Format**: 포맷 일관성 확인

린트 경고는 자동 수정을 먼저 시도합니다 (`ruff check --fix` / `eslint --fix`).

### Step 3: Gate B — Testing (포괄적, 느림)

Gate A 통과 후에만 실행:

1. **Unit Tests**: 전체 테스트 스위트 실행, 100% 통과
2. **Coverage**: 프로젝트 threshold 확인 (미설정 시 스킵)
3. **Spec Compliance**: `.claude/memory/specs/`의 Feature ID별 수용 기준과 구현 대조
4. **Clean Code**: 신규/변경 파일에서 `TODO`, `FIXME` 패턴 검색 → 0 매치

### Step 4: PDCA Retry Loop

실패 시 자동으로 수정을 시도합니다. 무한 루프를 방지하기 위해 재시도는 최대 2회로 제한합니다.

```
[Gate 실행] → ALL PASS → Step 5
     │
     └─ FAIL → 자동 수정 가능? → Yes → lint --fix → Gate 재실행
                    │
                    No → engineer 에이전트 호출 (retry 1)
                              → Gate 재실행 → PASS? → Yes → Step 5
                                    │
                                    No → engineer 호출 (retry 2)
                                              → Gate 재실행 → PASS? → Yes → Step 5
                                                    │
                                                    No → 사용자 에스컬레이션
```

에스컬레이션 시에는 구체적 실패 항목, 에러 메시지, 시도한 수정 내역을 함께 보고합니다.

### Step 5: 보고서 생성 + Phase 전환

모든 게이트 통과 시:
1. 구조화된 보고서 출력
2. `CLAUDE.md`와 `settings.json`의 Phase를 `ship`으로 업데이트

## Output Format

```markdown
## Crucible Gate Report

**Date**: 2026-03-21
**Feature**: {feature name} ({feature ID})
**Verdict**: PASS

### Gate A: Validation
| Check | Result | Details |
|-------|--------|---------|
| Type Check | PASS | 0 errors |
| Linter | PASS | 0 warnings |
| Format | PASS | - |

### Gate B: Testing
| Check | Result | Details |
|-------|--------|---------|
| Tests | PASS | 12/12 passed |
| Coverage | PASS | 84% (threshold: 80%) |
| Spec Compliance | PASS | F001.1-F001.5 checked |
| Clean Code | PASS | 0 TODO/FIXME |

### 다음 단계
`/crucible-ship` 으로 릴리스를 진행하세요.
```

> 구현 코드와 테스트 대상이 준비된 뒤에만 이 스킬을 실행합니다.

## Related Files

- **Gate Definition**: `.claude/gates/gate-build.md` — 상세 통과 조건과 커맨드
- **Detailed Reference**: `.claude/skills/crucible-gate/references/gate-definitions.md` — 이중 게이트 아키텍처 상세 설명
- **Engineer Agent**: `.claude/agents/engineer.md` — PDCA 수정 시 호출
