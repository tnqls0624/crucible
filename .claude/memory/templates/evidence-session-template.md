# Evidence Session Template

`10-session evidence gate`는 구현 전에 실제 사용 세션을 기록해, 우리가 풀려는 문제가 진짜로 `재질의 루프`와 `계약 파손`인지 확인하기 위한 장치입니다.

아래 템플릿을 세션당 1개씩 복사해서 사용합니다.

---

## Session Metadata

- **Date**:
- **Repository / Project**:
- **Runtime**: Claude Code | Codex | 기타
- **Task Type**:
- **Task Complexity**: low | medium | high

## Original Request

사용자가 처음 던진 자연어 요청을 그대로 적습니다.

## Expected Contract

- 지켜야 하는 인터페이스 / API 계약:
- 건드리면 안 되는 경로:
- 유지해야 하는 기존 동작:

## First Output Failure

- 첫 결과가 왜 별로였는지:
- 무시된 계약:
- 새로 생긴 부작용:

## Requery Log

| Attempt | 왜 다시 질의했는지 | 무엇을 수정 요청했는지 | 결과 |
|---------|--------------------|------------------------|------|
| 1 |  |  |  |
| 2 |  |  |  |
| 3 |  |  |  |

## Outcome

- **Requery Count**:
- **Total Minutes Lost**:
- **Token Waste Estimate**:
- **Final Result Satisfaction**: low | medium | high

## Pain Classification

- 문제 유형: 계약 파손 | 맥락 부족 | 범위 과다 | 검증 부재 | 기타
- 가장 큰 손실: 시간 | 비용 | 집중력 | 신뢰도

## Pack Direction Relevance

- 이 세션이 `Claude-first canonical pack` 방향을 강화했는가:
- 어떤 policy/contract가 있었다면 재질의가 줄었을까:
- 어떤 문서 규칙을 추가하거나 수정해야 하는가:

## Decision

- keep | modify | reject
- 다음 액션:
