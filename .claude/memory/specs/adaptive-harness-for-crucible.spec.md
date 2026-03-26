# Feature Specification: Crucible Adaptive Harness

- **Feature ID**: F002
- **Created**: 2026-03-26
- **Author**: Codex
- **Status**: draft

---

## Problem Statement

현재 Crucible은 `spec → plan → build → gate → ship` 단계 discipline과 repo-local source of truth 구조가 강점이다. 하지만 병렬 worktree 실행이 문서 수준 전략에 머물고 있고, build 단계의 검증 루프가 `engineer → reviewer` 중심이라서 태스크 계약 부재, UI self-verification 부재, 포트 충돌, 평가 오버헤드 고정이라는 문제가 남아 있다.

최근 벤치마킹한 자료들은 공통적으로 같은 방향을 보여준다.

- 긴 작업에서는 planner와 evaluator가 load-bearing 역할을 한다.
- 생산성 병목은 모델 자체보다 preview, rebuild, worktree isolation 같은 인프라에서 자주 발생한다.
- 에이전트 속도가 올라갈수록 인간은 아키텍처와 품질 게이트를 더 의식적으로 쥐어야 한다.
- 모든 태스크에 같은 수준의 harness를 적용하면 비용이 빠르게 커지므로 적응형 라우팅이 필요하다.

Crucible이 이 교훈을 흡수하지 않으면, 문서화는 잘 되어 있어도 실제 구현 단계에서 재작업과 회귀 위험이 누적될 수 있다.

## User Journey

1. maintainer가 새로운 framework 개선 스펙을 작성한다.
2. architect가 태스크별 `Task Contract`와 검증 방법을 포함한 ADR을 작성한다.
3. build 단계에서 engineer는 태스크 계약에 따라 구현하고, evaluator는 task risk에 맞는 수준으로 브라우저 또는 CLI 검증을 수행한다.
4. reviewer는 evaluator 결과와 diff를 함께 보고 스펙 드리프트와 품질 문제를 판정한다.
5. maintainer는 여러 worktree를 동시에 실행하더라도 포트 충돌 없이 preview와 검증 결과를 확인한다.
6. 결과적으로 Crucible은 더 적은 수동 확인으로 더 높은 병렬 처리량과 품질 신뢰를 확보한다.

### Alternative Flows

- trivial 태스크: evaluator를 생략하고 `engineer → reviewer`만 수행한다.
- backend-only 태스크: 브라우저 검증 대신 CLI/API 검증을 수행한다.
- architecture/API 변경 태스크: 자동화 검증이 통과해도 인간 승인 없이는 build를 완료하지 않는다.

## Feature Requirements

### F002.1 — Plan 단계에 Task Contract를 도입한다

- **Description**: 각 태스크에 목표, 범위 파일, 비목표, 검증 방법, 위험도, done definition을 명시하는 `Task Contract`를 추가한다.
- **Priority**: must-have
- **Acceptance Criteria**:
  - [ ] plan 산출물의 모든 태스크가 `Files`, `Acceptance Criteria`, `Verification`, `Non-goals`, `Risk Level`을 포함한다.
  - [ ] gate-plan이 Task Contract 누락 태스크를 실패로 판정할 수 있다.

### F002.2 — Build 단계에 adaptive evaluator 라우팅을 추가한다

- **Description**: 태스크 복잡도와 위험도에 따라 `engineer only`, `engineer → reviewer`, `engineer → evaluator → reviewer` 경로를 선택한다.
- **Priority**: must-have
- **Acceptance Criteria**:
  - [ ] build 문서에 라우팅 매트릭스가 정의되어 있다.
  - [ ] 웹/UI 태스크는 기본적으로 self-preview 또는 browser verification 경로를 가진다.
  - [ ] evaluator 결과가 reviewer handoff에 포함된다.

### F002.3 — Worktree runtime isolation을 표준화한다

- **Description**: worktree마다 고유 포트 범위, 환경 변수 오버라이드, preview URL registry, 정리 규칙을 정의한다.
- **Priority**: must-have
- **Acceptance Criteria**:
  - [ ] worktree 전략 문서가 포트 충돌 방지 규칙을 포함한다.
  - [ ] preview URL과 runtime metadata를 태스크별로 기록하는 방법이 정의된다.
  - [ ] 완료된 worktree의 정리 규칙이 문서화된다.

### F002.4 — QA와 Gate를 계약 기반 검증으로 연결한다

- **Description**: QA와 gate가 단순 테스트 실행을 넘어 Task Contract와 스펙 수용 기준을 근거로 PASS/FAIL을 판정하도록 정렬한다.
- **Priority**: should-have
- **Acceptance Criteria**:
  - [ ] crucible-qa가 User Journey와 Task Contract를 함께 참조한다.
  - [ ] crucible-gate가 spec compliance 외에 contract compliance도 점검한다.

### F002.5 — Portable agent manifest를 선택 기능으로 추가한다

- **Description**: gitagent에서 벤치마킹한 manifest, duty separation, runtime memory 개념을 optional protocol로 도입한다.
- **Priority**: nice-to-have
- **Acceptance Criteria**:
  - [ ] 선택형 `agent manifest` 구조와 목적이 문서화된다.
  - [ ] 기존 `.claude` source of truth를 깨지 않고 공존 방안이 설명된다.

## Technical Constraints

- **Performance**: trivial 태스크에는 evaluator를 강제하지 않아야 하며, 검증 오버헤드가 태스크 가치보다 커지지 않아야 한다.
- **Security**: worktree 간 환경 변수와 세션 상태가 서로 누수되지 않아야 한다.
- **Compatibility**: 현재 Crucible phase 모델과 `.claude` source of truth 규칙을 유지해야 한다.
- **Dependencies**: 기존 Bash hooks, Markdown 문서, optional Bun browser tool 범위 안에서 우선 설계한다.

## Data Model

```text
Entity: TaskContract
  - id: string
  - objective: string
  - files_in_scope: string[]
  - non_goals: string[]
  - verification_plan: string[]
  - risk_level: enum(trivial, standard, high_risk)
  - done_definition: string[]

Entity: EvaluationProfile
  - task_id: string
  - mode: enum(skip, reviewer_only, evaluator_plus_reviewer)
  - signals: string[]
  - artifacts: string[]
  -> references: TaskContract

Entity: WorktreeRuntime
  - task_id: string
  - worktree_path: string
  - port_range: string
  - preview_url: string
  - cleanup_status: string
  -> references: TaskContract

Entity: AgentManifest (optional)
  - name: string
  - duties: string[]
  - skills: string[]
  - runtime_memory: string[]
```

## Acceptance Criteria (전체)

이 피처가 완료되었다고 판단하기 위한 최종 기준:

- [ ] plan 문서가 Task Contract를 기본 산출물로 포함한다.
- [ ] build 문서가 risk-based evaluator routing을 설명한다.
- [ ] worktree 문서가 runtime isolation 규칙을 포함한다.
- [ ] qa/gate 문서가 contract compliance를 참조한다.
- [ ] optional manifest가 기존 구조와 충돌 없이 설명된다.
- [ ] 모든 기존 테스트 통과
- [ ] gate-build 전체 PASS

## Out of Scope

- Bun browser tool 자체를 이번 사이클에 전면 재구현하는 것
- gitagent 전체 표준을 Crucible의 canonical source로 치환하는 것
- 모든 태스크에 evaluator를 강제하는 것
