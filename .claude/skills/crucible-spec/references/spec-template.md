# Feature Specification: {Feature Name}

- **Feature ID**: F{nnn}
- **Created**: {date}
- **Author**: {user / agent}
- **Status**: draft | review | approved

---

## Problem Statement

{이 피처가 해결하려는 문제를 명확하게 기술합니다. 현재 상황의 고통점과 이 피처가 가져올 변화를 설명합니다.}

## User Journey

{핵심 사용자 플로우를 단계별로 기술합니다}

1. 사용자가 {action}
2. 시스템이 {response}
3. 사용자가 {action}
4. 결과: {outcome}

### Alternative Flows

- {예외 상황 1}: {처리 방법}
- {예외 상황 2}: {처리 방법}

## Feature Requirements

### F{nnn}.1 — {Sub-feature Name}

- **Description**: {상세 설명}
- **Priority**: must-have | should-have | nice-to-have
- **Acceptance Criteria**:
  - [ ] {구체적이고 검증 가능한 기준 1}
  - [ ] {구체적이고 검증 가능한 기준 2}

### F{nnn}.2 — {Sub-feature Name}

- **Description**: {상세 설명}
- **Priority**: must-have | should-have | nice-to-have
- **Acceptance Criteria**:
  - [ ] {기준 1}
  - [ ] {기준 2}

## Technical Constraints

- **Performance**: {응답 시간, 처리량 등 성능 요구사항}
- **Security**: {인증, 권한, 데이터 보호 요구사항}
- **Compatibility**: {호환성 요구사항}
- **Dependencies**: {외부 의존성}

## Data Model

```
{핵심 엔티티와 관계를 간략하게 표현}

Entity: {name}
  - field1: type (constraint)
  - field2: type (constraint)
  → references: {other entity}
```

## API Contract (해당 시)

```
{주요 API 엔드포인트와 요청/응답 형식}

POST /api/{resource}
  Request:  { field1: type, field2: type }
  Response: { id: string, ...fields }
  Errors:   { 400: "validation error", 404: "not found" }
```

## Acceptance Criteria (전체)

이 피처가 완료되었다고 판단하기 위한 최종 기준:

- [ ] {E2E 수준의 검증 가능한 기준 1}
- [ ] {E2E 수준의 검증 가능한 기준 2}
- [ ] {E2E 수준의 검증 가능한 기준 3}
- [ ] 모든 기존 테스트 통과
- [ ] gate-build 전체 PASS

## Out of Scope

- {이 피처에서 명시적으로 제외하는 것 1}
- {이 피처에서 명시적으로 제외하는 것 2}
