# Spec Phase Gate

> spec → plan 전환을 위한 통과 조건

## Exit Criteria

| # | Check | Method | Pass Condition |
|---|-------|--------|----------------|
| 1 | 스펙 파일 존재 | Glob: `*.spec.md` in `.claude/memory/specs/` | >= 1 파일 |
| 2 | Problem Statement | Grep: `## Problem Statement` | 존재 + 비어있지 않음 |
| 3 | User Journey | Grep: `## User Journey` 또는 `## 사용자 여정` | 존재 |
| 4 | Feature IDs | Grep: `F\d{3}` 패턴 | >= 1 매치 |
| 5 | Tech Constraints | Grep: `## Technical Constraints` 또는 `## 기술 제약` | 존재 |
| 6 | Acceptance Criteria | Grep: `## Acceptance Criteria` 또는 `## 수용 기준` | 존재 |
| 7 | Data Model | Grep: `## Data Model` 또는 `## 데이터 모델` | 존재 |

## Failure Actions

- 누락된 섹션 → 구체적 가이드와 함께 spec 단계로 복귀
- 불완전한 Feature ID → 사용자에게 누락 항목 안내
- 빈 섹션 → 최소 내용 작성 요청

## Pass Action

- `.claude/CLAUDE.md`의 Phase를 `plan`으로 업데이트
- `.claude/settings.json`의 `CRUCIBLE_PHASE`를 `plan`으로 업데이트
- `.claude/memory/specs/` 와 `.claude/memory/decisions/` 에 새 피처 기준선을 정렬
