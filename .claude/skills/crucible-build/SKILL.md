---
name: crucible-build
description: |
  계획된 태스크를 engineer/reviewer/qa(evaluator) 루프로 구현합니다. ADR의 태스크 리스트를 순차/병렬(worktree 격리)로 실행하고, 태스크 위험도에 따라 adaptive evaluation, 코드 리뷰, PDCA 재시도를 관리합니다. Crucible의 실제 코드 생성이 이루어지는 핵심 단계입니다.

  ALWAYS use this skill when:
  - 사용자가 `/crucible-build` 명령을 사용할 때
  - "구현 시작", "코딩해줘", "코딩 시작", "implement", "build" 언급 시
  - "이제 만들어줘", "개발 시작", "코드 작성 들어가자" 언급 시
  - "engineer에게 넘겨", "태스크 실행", "빌드해줘" 언급 시
  - crucible-plan이 완료되어 실제 코드 작성이 필요한 시점
  - ADR과 태스크 리스트가 준비되어 순차적 구현을 시작할 때
  - 병렬 워크트리로 여러 태스크를 동시 실행하려 할 때

  Example triggers: "플랜 다 됐으니까 구현 시작하자", "코딩해줘. ADR에 있는 태스크 리스트대로", "이제 만들어줘. 스펙이랑 설계 다 끝났으니까"
---

# /crucible-build — 구현 오케스트레이션

태스크를 하나씩 engineer에게 위임하고, 태스크 위험도에 따라 qa(evaluator)와 reviewer가 검증하는 루프를 반복합니다. 이 분리가 중요한 이유는 — 같은 에이전트가 작성과 검토를 동시에 하면 자기 실수를 놓치기 쉽고, 별도 에이전트가 fresh context에서 runtime evidence와 코드 리뷰를 나눠 맡으면 스펙 드리프트, UI 회귀, 보안 취약점을 더 잘 잡아낼 수 있기 때문입니다.

## Prerequisites

- 현재 Phase가 `build`
- `.claude/memory/decisions/`에 ADR 존재 (Tasks 섹션 포함)
- gate-plan 통과 완료
- 사용자가 실제 구현 시작을 명시적으로 승인함

> 이 스킬은 실제 구현 태스크가 확정된 뒤 실행합니다. 프레임워크 문서나 규칙만 바꾸는 작업이면 `plan` 단계에서 관련 문서를 먼저 정리합니다.

## Workflow

### Step 1: 태스크 리스트 로드 및 등록

ADR의 Tasks 섹션에서 태스크를 읽고 TodoWrite로 등록합니다. 의존성 그래프를 분석하여 실행 순서를 결정합니다 — 의존성이 없는 태스크는 병렬 실행 후보입니다.

각 태스크의 canonical identifier인 `Task ID`를 먼저 확정합니다. 이후 engineer, evaluator, reviewer, QA, gate 보고서는 모두 이 `Task ID`를 그대로 사용합니다.

### Step 2: 태스크별 실행 루프

각 태스크는 ADR의 `Task Contract`에 적힌 `Risk Level`과 `Verification`을 기준으로 아래 경로 중 하나를 선택합니다.

| Risk Level | 기본 경로 | 적용 예시 |
|-----------|----------|-----------|
| `trivial` | `engineer → reviewer` | 문서 수정, 국소 리팩터링, 명확한 단일 파일 수정 |
| `standard` | `engineer → reviewer` | 일반 기능 구현, 테스트 추가, API 연결 |
| `high-risk` | `engineer → qa(evaluator) → reviewer` | UI 핵심 플로우, 아키텍처/API 계약 변경, 동시성/데이터 무결성 영향 |

`Verification`에 preview, browser, API flow, runtime state 검증이 포함되어 있고 실제로 확인 가능한 entry point(URL, HTTP endpoint, command, log)가 준비되어 있으면 `standard`여도 evaluator 경로를 선택할 수 있습니다.

각 태스크에 대해:

```
[engineer 호출] → [자가 검증(lint/type/test)] → [adaptive route]
                                                │
                                                ├─ reviewer only
                                                │      │
                                                │      ├─ APPROVE → 태스크 완료
                                                │      └─ REQUEST_CHANGES → engineer 재호출
                                                │
                                                └─ qa(evaluator) → reviewer
                                                                  │
                                                                  ├─ APPROVE → 태스크 완료
                                                                  └─ REQUEST_CHANGES → engineer 재호출
                                                                                      (최대 2회 재시도)
                                                                                      │
                                                                                 실패 → 사용자 에스컬레이션
```

### Step 3: Worktree slot 할당 + runtime log 등록

`isolation: "worktree"`를 사용하는 태스크는 engineer handoff 전에 반드시 runtime slot을 할당합니다.

절차:
1. `bun .claude/tools/worktree/runtime_registry.ts allocate --task-id "$TASK_ID" --branch "$BRANCH" --worktree "$WORKTREE"`를 실행합니다.
2. 스크립트는 `.claude/settings.json`의 `CRUCIBLE_WORKTREE_PORT_BASE`, `CRUCIBLE_WORKTREE_PORT_BLOCK_SIZE`, `CRUCIBLE_WORKTREE_RUNTIME_LOG`를 읽어 free slot을 계산합니다.
3. 결과로 나온 `Port Range`, `Preview URL`, `Status=ALLOCATED`, `Cleanup=pending` 값을 handoff와 runtime log에 사용합니다.
4. 이미 active entry가 있으면 같은 row를 재사용하고, 포트 충돌이 있으면 다음 free slot으로 자동 이동합니다.
5. 이 등록이 끝나기 전에는 engineer/evaluator/reviewer handoff를 시작하지 않습니다.

`CRUCIBLE_WORKTREE_PREVIEW_HOST`가 미설정이거나 `auto`면 `Preview URL`은 로컬 loopback 주소로 자동 계산됩니다. 원격 preview 환경이면 shell env로만 override 합니다.

main에서 직접 실행하는 태스크는 `Port Range`와 `Preview URL`을 `N/A`로 두고 runtime log 등록을 생략할 수 있습니다.

### Step 4: Engineer 에이전트 호출

Agent 도구로 engineer를 호출할 때 Context Contract를 명확히 전달합니다. 에이전트가 무엇을 해야 하는지, 어떤 파일을 참조해야 하는지, 어디까지가 범위인지를 모호하지 않게 제시해야 합니다.

```markdown
## Task Handoff: Engineer
- **Task ID**: {ADR002-T2 형태의 canonical identifier}
- **Objective**: {태스크 설명}
- **Spec**: .claude/memory/specs/{feature}.spec.md 읽을 것
- **ADR**: .claude/memory/decisions/{nnn}-{name}.md 읽을 것
- **Files to modify**: {구체적 파일 경로 목록}
- **Port Range**: {4100-4119 형태의 할당 범위 또는 N/A}
- **Preview URL**: {<preview-url> 또는 N/A}
- **Verification Plan**: {Task Contract의 Verification 전문}
- **Non-goals**: {Task Contract의 Non-goals 전문}
- **Risk Level**: trivial | standard | high-risk
- **Acceptance Criteria**: {수용 기준 전문}
- **Done Definition**: {handoff 완료 기준 전문}
- **Constraints**: 태스크 범위 외 변경 금지, 기존 테스트 깨뜨리지 않을 것
```

handoff의 `Port Range`와 `Preview URL`은 runtime log에 기록된 값과 일치해야 합니다.

### Step 5: Evaluator 경로 (선택)

`Risk Level`이 `high-risk`이거나 `Verification`에 runtime 검증이 포함되고 확인 가능한 entry point가 있으면 qa 에이전트를 evaluator로 호출합니다. evaluator의 역할은 코드를 수정하는 것이 아니라, web-app은 preview/browser로, backend-api와 cli-tool은 HTTP endpoint/command/log로 실제 동작을 확인하고 재현 가능한 findings를 만드는 것입니다.

```markdown
## Task Handoff: Evaluator (QA)
- **Task ID**: {ADR002-T2 형태의 canonical identifier}
- **Objective**: {태스크}의 runtime verification
- **Spec**: {스펙 파일 경로}
- **ADR Task Contract**: {Verification / Non-goals / Acceptance Criteria}
- **Port Range**: {4100-4119 형태의 할당 범위}
- **Preview or Entry Point**: {URL, command, 실행 방법}
- **Changed Files**: {변경된 파일 목록}
- **Report Path**: {bun .claude/tools/reports/report_registry.ts path --task-id ADR002-T2 --kind evaluator --bare}
- **Expected Evidence**: screenshot, failing step, API response, console/log excerpt 중 필요한 것
```

evaluator 출력은 canonical report path에 저장해야 하며, `PASS | FAIL | SKIP`와 재현 가능한 evidence를 포함해야 합니다. 저장 후 `bun .claude/tools/reports/report_registry.ts validate --task-id "$TASK_ID" --kind evaluator`로 schema 검증까지 통과해야 reviewer에게 전달할 수 있습니다.

### Step 6: Reviewer 에이전트 호출

engineer 완료 후 reviewer를 별도 에이전트로 호출합니다. evaluator를 거친 경우 해당 findings를 반드시 포함합니다.

```markdown
## Task Handoff: Reviewer
- **Task ID**: {ADR002-T2 형태의 canonical identifier}
- **Objective**: {태스크}의 구현 코드 리뷰
- **Spec**: {스펙 파일 경로} — spec compliance 확인
- **ADR Task Contract**: {Files / Verification / Non-goals / Risk Level / Done Definition}
- **Changed Files**: {변경된 파일 목록}
- **Port Range**: {4100-4119 형태의 할당 범위 또는 N/A}
- **Preview URL**: {<preview-url> 또는 N/A}
- **Evaluator Findings**: {PASS | FAIL | SKIP + 주요 evidence}
- **Report Path**: {bun .claude/tools/reports/report_registry.ts path --task-id ADR002-T2 --kind reviewer --bare}
- **Review Focus**: spec compliance, security (OWASP), code quality, test coverage
```

Reviewer report도 canonical path에 저장하고 `bun .claude/tools/reports/report_registry.ts validate --task-id "$TASK_ID" --kind reviewer` 검증을 통과해야 합니다. `REQUEST_CHANGES`를 반환하면 해당 피드백과 evaluator findings를 engineer에게 전달하여 수정합니다.

### Step 7: Worktree 전략 (선택)

독립적 태스크가 2개 이상이면 병렬 실행을 고려합니다. 각 Agent 호출에 `isolation: "worktree"`를 지정하면 별도 브랜치에서 격리 실행됩니다. 자세한 전략은 `.claude/skills/crucible-build/references/worktree-strategy.md`를 참고하세요.

의존성이 있는 태스크는 반드시 순차 실행합니다.

### Step 8: Phase 전환

모든 태스크 완료 시:
1. `CLAUDE.md`와 `settings.json`의 Phase를 `gate`로 업데이트
2. `/crucible-gate` 실행을 안내

## Output Format

```markdown
## Crucible Build Report

| Task | Route | Evaluator | Reviewer | Retries |
|------|-------|-----------|----------|---------|
| single schema core | reviewer-only | SKIP | APPROVED | 0 |
| dialect validator | evaluator+reviewer | PASS | APPROVED | 1 |
| codex emitter | reviewer-only | SKIP | APPROVED | 0 |

### 다음 단계
`/crucible-gate` 로 품질 게이트를 실행하세요.
```

## Related Files

- **ADR**: `.claude/memory/decisions/` — 태스크 리스트 소스
- **Agents**: `.claude/agents/engineer.md`, `.claude/agents/qa.md`, `.claude/agents/reviewer.md`
- **Worktree**: `.claude/skills/crucible-build/references/worktree-strategy.md` — 병렬 실행 전략
