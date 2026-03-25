# Evidence Session Template

이 템플릿은 구현 전에 실제 사용 세션을 기록해, 우리가 풀려는 문제가 진짜인지 확인하기 위한 장치입니다.

특히 아래 상황에서 유용합니다.

- AI 코딩 워크플로우에서 재작업이 너무 많다고 느낄 때
- 요청 범위가 자꾸 넓어져 결과가 흔들릴 때
- 계약 파손, 품질 드리프트, 검증 누락을 실제 사례로 확인하고 싶을 때

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

## Intended Constraints

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
- **Token / Cost Impact**:
- **Final Result Satisfaction**: low | medium | high

## Pain Classification

- 문제 유형: 계약 파손 | 맥락 부족 | 범위 과다 | 검증 부재 | 기타
- 가장 큰 손실: 시간 | 비용 | 집중력 | 신뢰도

## Workflow Relevance

- 어떤 workflow rule이나 guardrail이 있었으면 재작업이 줄었을까:
- 어떤 spec / ADR / check가 있었다면 더 빨리 끝났을까:
- 문서나 규칙에 어떤 변경이 필요해 보이는가:

## Decision

- keep | modify | reject
- 다음 액션:
