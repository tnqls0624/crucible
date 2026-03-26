# ADR-{nnn}: {Decision Title}

- **Status**: proposed | accepted | deprecated | superseded
- **Date**: {date}
- **Feature**: F{nnn} — {feature name}
- **Spec**: `.claude/memory/specs/{feature}.spec.md`

## Context

{이 결정이 필요한 배경. 어떤 문제를 해결하려 하는가? 어떤 제약이 있는가?}

## Decision

{채택한 접근 방식을 명확하게 기술합니다.}

**핵심 선택**:
- {선택 1}: {이유}
- {선택 2}: {이유}

## Alternatives Considered

### Option A: {대안 이름}
- **장점**: {장점}
- **단점**: {단점}
- **탈락 사유**: {이유}

### Option B: {대안 이름}
- **장점**: {장점}
- **단점**: {단점}
- **탈락 사유**: {이유}

## Consequences

### Positive
- {긍정적 결과 1}
- {긍정적 결과 2}

### Negative
- {부정적 결과 1 — 수용 가능한 트레이드오프}
- {부정적 결과 2}

### Risks
- {리스크 1}: {완화 방안}

## Tasks

{이 ADR을 기반으로 분해된 구현 태스크 목록}

각 태스크는 build 단계에서 그대로 handoff 가능한 `Task Contract` 여야 합니다.

### Task 1: {태스크 이름}

- **Task ID**: ADR{nnn}-T1
- **Description**: {구현할 내용}
- **Files**: {생성/수정할 파일 경로}
- **Verification**:
  - {정적 검증 또는 런타임 검증 1}
  - {정적 검증 또는 런타임 검증 2}
- **Non-goals**:
  - {이번 태스크에서 하지 않을 것 1}
  - {이번 태스크에서 하지 않을 것 2}
- **Risk Level**: trivial | standard | high-risk
- **Dependencies**: 없음
- **Acceptance Criteria**:
  - [ ] {기준 1}
  - [ ] {기준 2}
- **Done Definition**:
  - [ ] {handoff 완료 기준 1}
  - [ ] {handoff 완료 기준 2}
- **Estimated Complexity**: small | medium | large

### Task 2: {태스크 이름}

- **Task ID**: ADR{nnn}-T2
- **Description**: {구현할 내용}
- **Files**: {파일 경로}
- **Verification**:
  - {정적 검증 또는 런타임 검증 1}
  - {정적 검증 또는 런타임 검증 2}
- **Non-goals**:
  - {이번 태스크에서 하지 않을 것 1}
  - {이번 태스크에서 하지 않을 것 2}
- **Risk Level**: trivial | standard | high-risk
- **Dependencies**: Task 1
- **Acceptance Criteria**:
  - [ ] {기준 1}
  - [ ] {기준 2}
- **Done Definition**:
  - [ ] {handoff 완료 기준 1}
  - [ ] {handoff 완료 기준 2}
- **Estimated Complexity**: small | medium | large
