# ADR-002: Crucible Adaptive Harness 도입

- **Status**: proposed
- **Date**: 2026-03-26
- **Feature**: F002 — Crucible Adaptive Harness
- **Spec**: `.claude/memory/specs/adaptive-harness-for-crucible.spec.md`

## Context

Crucible는 phase discipline, gate 문화, repo-local source of truth라는 장점을 이미 갖고 있다. 다만 실제 구현 단계로 내려가면 다음 한계가 보인다.

1. 태스크 handoff가 충분히 구조화되어 있지 않아 agent가 범위를 넓게 해석할 여지가 있다.
2. reviewer는 존재하지만 task risk에 맞게 조절되는 evaluator 계층이 없다.
3. worktree 병렬 전략은 정의되어 있으나 runtime isolation 규칙이 부족하다.
4. QA와 gate가 spec 중심으로는 정렬되어 있지만 task contract 기반 검증은 없다.
5. 장기적으로는 host 간 이식성과 감사 추적을 강화할 portable agent metadata 계층이 필요하다.

이번 결정은 2026-03-16부터 2026-03-25 사이에 공개된 여러 자료를 벤치마킹한 결과를 반영한다.

- Anthropic의 long-running harness 글은 planner와 evaluator가 실제로 load-bearing이며, 모델이 좋아질수록 harness는 더 단순하고 적응적으로 바뀌어야 함을 보여준다.
- Neil Kakkar의 글은 생산성 병목이 모델보다 preview, rebuild, worktree isolation 같은 실행 인프라에 있다는 점을 보여준다.
- Mario Zechner와 James Stanier의 글은 agent 속도가 높을수록 아키텍처와 품질 게이트를 더 의도적으로 인간이 쥐어야 한다고 경고한다.
- gstack은 역할화된 workflow와 QA/ship 운영체제의 강점을 보여준다.
- gitagent는 portable manifest, duty separation, auditability 관점의 장기 방향성을 제시한다.

## Decision

Crucible의 기존 phase 모델은 유지하면서, build 중심의 harness를 `adaptive`하게 강화한다.

**핵심 선택**:
- **Task Contract 도입**: plan 산출물에 태스크별 목표, 범위, 비목표, 검증 방법, 위험도를 명시한다.
- **Adaptive Evaluator Routing**: 모든 태스크에 evaluator를 강제하지 않고, 위험도와 task 유형에 따라 reviewer-only 또는 evaluator-plus-reviewer 경로를 선택한다.
- **Runtime Isolation 강화**: worktree 전략을 port range, env override, preview registry, cleanup까지 확장한다.
- **Contract-Aware QA/Gate**: QA와 gate가 spec뿐 아니라 task contract도 근거로 검증한다.
- **Optional Portable Manifest**: gitagent에서 벤치마킹한 개념은 선택 기능으로만 도입하고, `.claude` canonical source를 유지한다.

## Alternatives Considered

### Option A: 현재 Crucible 구조를 유지하고 reviewer + gate만 강화
- **장점**: 가장 단순하고 현재 문서 구조를 거의 건드리지 않는다.
- **단점**: 병렬 worktree, self-verification, task scoping 문제를 충분히 해결하지 못한다.
- **탈락 사유**: 속도와 품질 사이의 병목이 build 단계에서 계속 남는다.

### Option B: gstack 스타일의 역할 기반 운영체제로 대체
- **장점**: 역할 분리, QA, ship, review의 운영 완성도가 높다.
- **단점**: Crucible의 간결한 phase discipline이 흐려지고 시스템 복잡도가 크게 증가한다.
- **탈락 사유**: 전면 치환은 과대 범위이며, 현재 repo-local `.claude` 철학과도 충돌 가능성이 있다.

### Option C: gitagent manifest를 먼저 도입해 표준화부터 해결
- **장점**: 장기적 휴대성, 감시 가능성, segregation of duties 설계에 유리하다.
- **단점**: 단기적으로 build throughput과 verification loop를 개선하는 효과는 제한적이다.
- **탈락 사유**: 현재 병목은 표준화보다 evaluation loop와 runtime isolation에 더 가깝다.

## Consequences

### Positive
- plan 산출물이 더 구조화되어 agent handoff 품질이 올라간다.
- build 단계에서 task risk에 따라 더 싼 경로와 더 강한 검증 경로를 선택할 수 있다.
- 병렬 worktree 운영이 안정화되어 preview와 검증 throughput이 올라간다.
- QA와 gate가 task contract를 근거로 더 일관된 PASS/FAIL을 낼 수 있다.
- 장기적으로 portable manifest를 붙일 확장 포인트가 생긴다.

### Negative
- 문서와 프로토콜 수가 늘어나 초기 이해 비용이 커진다.
- evaluator를 잘못 설계하면 trivial 태스크에서도 불필요한 오버헤드가 생긴다.
- worktree isolation 규칙을 실제 setup과 hooks까지 연결하려면 후속 구현이 필요하다.

### Risks
- **과설계 위험**: 모든 태스크에 evaluator를 붙여 속도만 느려질 수 있다.
  - **완화 방안**: risk matrix를 명시하고 trivial 태스크는 기본적으로 skip한다.
- **문서-현실 drift**: contract와 실제 실행 규칙이 어긋날 수 있다.
  - **완화 방안**: gate-plan과 gate-build에서 contract 항목 존재 여부를 체크한다.
- **host 간 불일치**: Claude/Codex에서 동작 방식 차이가 날 수 있다.
  - **완화 방안**: optional manifest는 protocol 수준에서만 도입하고 host-specific rule은 별도 문서로 둔다.

## Tasks

### Task 1: Plan 산출물에 Task Contract 추가

- **Task ID**: ADR002-T1
- **Description**: `crucible-plan`과 ADR 템플릿에 task contract 필드를 추가하고 gate-plan 기준을 보강한다.
- **Files**: `.claude/skills/crucible-plan/SKILL.md`, `.claude/skills/crucible-plan/references/adr-template.md`, `.claude/gates/gate-plan.md`
- **Dependencies**: 없음
- **Acceptance Criteria**:
  - [ ] 각 태스크에 `Verification`, `Non-goals`, `Risk Level` 필드가 추가된다.
  - [ ] gate-plan이 task contract 누락 태스크를 실패로 판정할 수 있다.
- **Estimated Complexity**: small

### Task 2: Build에 adaptive evaluator loop 도입

- **Task ID**: ADR002-T2
- **Description**: `crucible-build`에 risk-based routing과 evaluator handoff 규칙을 추가한다.
- **Files**: `.claude/skills/crucible-build/SKILL.md`, `.claude/agents/reviewer.md`, `.claude/agents/qa.md`
- **Dependencies**: Task 1
- **Acceptance Criteria**:
  - [ ] build 문서에 `engineer only`, `engineer → reviewer`, `engineer → evaluator → reviewer` 라우팅 매트릭스가 포함된다.
  - [ ] evaluator 산출물이 reviewer 입력으로 연결된다.
- **Estimated Complexity**: medium

### Task 3: Worktree runtime isolation 표준화

- **Task ID**: ADR002-T3
- **Description**: worktree 전략 문서를 runtime isolation 규칙까지 확장하고 필요한 hook/설정 연결 지점을 정의한다.
- **Files**: `.claude/skills/crucible-build/references/worktree-strategy.md`, `.claude/hooks/check-phase-permission.sh`, `.claude/settings.json`
- **Dependencies**: Task 2
- **Acceptance Criteria**:
  - [ ] worktree별 포트 범위와 preview URL 기록 규칙이 문서화된다.
  - [ ] cleanup 규칙과 충돌 처리 방침이 명시된다.
- **Estimated Complexity**: medium

### Task 4: QA/Gate를 contract-aware 검증으로 정렬

- **Task ID**: ADR002-T4
- **Description**: `crucible-qa`와 `crucible-gate` 문서에 task contract 기반 검증 항목을 추가한다.
- **Files**: `.claude/skills/crucible-qa/SKILL.md`, `.claude/skills/crucible-gate/SKILL.md`, `.claude/gates/gate-build.md`
- **Dependencies**: Task 1, Task 2
- **Acceptance Criteria**:
  - [ ] QA 시나리오가 User Journey와 Task Contract를 함께 참조한다.
  - [ ] gate-build에 contract compliance 항목이 추가된다.
- **Estimated Complexity**: medium

### Task 5: Optional portable manifest 설계

- **Task ID**: ADR002-T5
- **Description**: gitagent 벤치마킹을 바탕으로 optional manifest, duties, runtime memory 개념을 protocol 초안으로 문서화한다.
- **Files**: `.claude/protocols/`, `.claude/CLAUDE.md`
- **Dependencies**: Task 1
- **Acceptance Criteria**:
  - [ ] `.claude` canonical source를 유지하는 전제 아래 optional manifest 구조가 설명된다.
  - [ ] host-specific 생성물과 portable metadata의 경계가 문서화된다.
- **Estimated Complexity**: medium

## Patch Plan

이번 ADR을 구현으로 옮길 때는 아래 순서를 권장한다.

### Patch 1: Plan 계약 강화

- `adr-template.md`에 `Verification`, `Non-goals`, `Risk Level`, `Done Definition` 필드를 추가한다.
- `crucible-plan/SKILL.md`에 Task Contract 개념과 예시 handoff를 추가한다.
- `gate-plan.md`에 contract completeness 체크를 넣는다.

### Patch 2: Adaptive build loop 추가

- `crucible-build/SKILL.md`에 risk matrix를 추가한다.
- reviewer handoff 포맷에 evaluator findings 입력을 추가한다.
- web task와 backend task의 검증 경로를 분기한다.

### Patch 3: Worktree runtime isolation 문서화

- `worktree-strategy.md`에 `task_id → port_range → preview_url` 매핑 규칙을 추가한다.
- `settings.json` 또는 별도 runtime 문서에 포트 할당 범위를 기록하는 방안을 정의한다.
- cleanup, stale preview, 충돌 시 복구 절차를 문서화한다.

### Patch 4: QA/Gate 계약 연동

- `crucible-qa/SKILL.md`에 task contract를 입력으로 받는 시나리오 생성 단계를 추가한다.
- `crucible-gate/SKILL.md`와 `gate-build.md`에 contract compliance 체크를 넣는다.

### Patch 5: Optional manifest 초안

- `.claude/protocols/agent-manifest.md` 또는 YAML 스키마 초안을 추가한다.
- `.claude/CLAUDE.md`에 manifest가 선택 계층이며 canonical source를 대체하지 않는다는 원칙을 적는다.
