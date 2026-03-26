# Plan Phase Gate

> plan → build 전환을 위한 통과 조건

## Exit Criteria

| # | Check | Method | Pass Condition |
|---|-------|--------|----------------|
| 1 | ADR 존재 | Glob: `*.md` in `.claude/memory/decisions/` | >= 1 파일 |
| 2 | ADR 필수 섹션 | Grep: `## Context`, `## Decision`, `## Consequences` | 모두 존재 |
| 3 | 태스크 리스트 | Grep: `## Tasks` 또는 `## 태스크` in 스펙/ADR | 존재 |
| 4 | Task Contract ID | 각 태스크에 `Task ID:` | 모든 태스크 |
| 5 | 태스크 수용 기준 | 각 태스크에 `Acceptance Criteria:` 또는 `수용 기준:` | 모든 태스크 |
| 6 | Task Contract 검증 계획 | 각 태스크에 `Verification:` | 모든 태스크 |
| 7 | Task Contract 비범위 명시 | 각 태스크에 `Non-goals:` | 모든 태스크 |
| 8 | Task Contract 위험도 | 각 태스크에 `Risk Level:` | 모든 태스크 |
| 9 | Task Contract 완료 기준 | 각 태스크에 `Done Definition:` | 모든 태스크 |
| 10 | 태스크 크기 | 각 태스크 설명 | 컨텍스트 윈도우 50% 이내 추정 |
| 11 | 관련 파일 명시 | 각 태스크에 `Files:` 또는 `파일:` | 모든 태스크 |
| 12 | 스펙 참조 | ADR에 스펙 파일 경로 참조 | 존재 |
| 13 | Evidence Gate 준비 | `.claude/memory/templates/evidence-session-template.md` 존재 | build 전 사용 가능 |
| 14 | 구현 승인 여부 | 사용자 확인 | 구현 시작 명시 승인 또는 `plan 유지` 결정 |

## Failure Actions

- ADR 누락 → architect 에이전트 재호출
- Task ID 누락 → architect가 canonical task identifier를 추가
- 태스크 수용 기준 누락 → 태스크별 보완 요청
- Task Contract 필드 누락 → architect가 `Verification`, `Non-goals`, `Risk Level`, `Done Definition` 보완
- 태스크가 너무 큰 경우 → 분할 권장 (GSD 원칙: 50% context window)
- evidence gate 템플릿 누락 → 먼저 템플릿 보완
- 사용자가 실제 구현 시작을 보류함 → build 전환 대신 `plan 유지`

## Pass Action

- 사용자가 실제 구현 시작을 승인한 경우에만 `.claude/CLAUDE.md`의 Phase를 `build`로 업데이트
- 사용자가 실제 구현 시작을 승인한 경우에만 `.claude/settings.json`의 `CRUCIBLE_PHASE`를 `build`로 업데이트
- 구현 보류 상태면 phase는 `plan` 유지
- 태스크 리스트를 TodoWrite로 등록
