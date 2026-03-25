---
name: crucible-build
description: |
  계획된 태스크를 engineer/reviewer 에이전트 루프로 구현합니다. ADR의 태스크 리스트를 순차/병렬(worktree 격리)로 실행하고, 코드 리뷰와 PDCA 재시도를 자동 관리합니다. Crucible의 실제 코드 생성이 이루어지는 핵심 단계입니다.

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

태스크를 하나씩 engineer에게 위임하고, reviewer가 검증하는 루프를 반복합니다. 이 분리가 중요한 이유는 — 같은 에이전트가 작성과 검토를 동시에 하면 자기 실수를 놓치기 쉽고, 별도 에이전트가 fresh context에서 리뷰하면 스펙 드리프트나 보안 취약점을 더 잘 잡아냅니다.

## Prerequisites

- 현재 Phase가 `build`
- `.claude/memory/decisions/`에 ADR 존재 (Tasks 섹션 포함)
- gate-plan 통과 완료
- 사용자가 실제 구현 시작을 명시적으로 승인함

> 문서 기준선 고도화만 진행 중인 경우에는 이 스킬을 실행하지 않습니다. 그 상태에서는 `plan`을 유지한 채 `.claude/**/*.md`를 먼저 정리합니다.

## Workflow

### Step 1: 태스크 리스트 로드 및 등록

ADR의 Tasks 섹션에서 태스크를 읽고 TodoWrite로 등록합니다. 의존성 그래프를 분석하여 실행 순서를 결정합니다 — 의존성이 없는 태스크는 병렬 실행 후보입니다.

### Step 2: 태스크별 실행 루프

각 태스크에 대해:

```
[engineer 호출] → [자가 검증(lint/type)] → [reviewer 호출]
                                                │
                                          APPROVE → 태스크 완료
                                                │
                                          REQUEST_CHANGES → engineer 재호출
                                                              (최대 2회 재시도)
                                                              │
                                                         실패 → 사용자 에스컬레이션
```

### Step 3: Engineer 에이전트 호출

Agent 도구로 engineer를 호출할 때 Context Contract를 명확히 전달합니다. 에이전트가 무엇을 해야 하는지, 어떤 파일을 참조해야 하는지, 어디까지가 범위인지를 모호하지 않게 제시해야 합니다.

```markdown
## Task Handoff: Engineer
- **Objective**: {태스크 설명}
- **Spec**: .claude/memory/specs/{feature}.spec.md 읽을 것
- **ADR**: .claude/memory/decisions/{nnn}-{name}.md 읽을 것
- **Files to modify**: {구체적 파일 경로 목록}
- **Acceptance Criteria**: {수용 기준 전문}
- **Constraints**: 태스크 범위 외 변경 금지, 기존 테스트 깨뜨리지 않을 것
```

### Step 4: Reviewer 에이전트 호출

engineer 완료 후 reviewer를 별도 에이전트로 호출합니다:

```markdown
## Task Handoff: Reviewer
- **Objective**: {태스크}의 구현 코드 리뷰
- **Spec**: {스펙 파일 경로} — spec compliance 확인
- **Changed Files**: {변경된 파일 목록}
- **Review Focus**: spec compliance, security (OWASP), code quality, test coverage
```

Reviewer가 `REQUEST_CHANGES`를 반환하면 해당 피드백을 engineer에게 전달하여 수정합니다.

### Step 5: Worktree 전략 (선택)

독립적 태스크가 2개 이상이면 병렬 실행을 고려합니다. 각 Agent 호출에 `isolation: "worktree"`를 지정하면 별도 브랜치에서 격리 실행됩니다. 자세한 전략은 `.claude/skills/crucible-build/references/worktree-strategy.md`를 참고하세요.

의존성이 있는 태스크는 반드시 순차 실행합니다.

### Step 6: Phase 전환

모든 태스크 완료 시:
1. `CLAUDE.md`와 `settings.json`의 Phase를 `gate`로 업데이트
2. `/crucible-gate` 실행을 안내

## Output Format

```markdown
## Crucible Build Report

| Task | Status | Reviewer | Retries |
|------|--------|----------|---------|
| single schema core | DONE | APPROVED | 0 |
| dialect validator | DONE | APPROVED | 1 |
| codex emitter | DONE | APPROVED | 0 |

### 다음 단계
`/crucible-gate` 로 품질 게이트를 실행하세요.
```

## Related Files

- **ADR**: `.claude/memory/decisions/` — 태스크 리스트 소스
- **Agents**: `.claude/agents/engineer.md`, `.claude/agents/reviewer.md`
- **Worktree**: `.claude/skills/crucible-build/references/worktree-strategy.md` — 병렬 실행 전략
