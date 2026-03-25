# crucible-gate-workspace

이 디렉토리는 `crucible-gate` 스킬의 품질 게이트 흐름을 평가할 때 사용하는 보조 workspace입니다.

## 포함 범위

- `evals/evals.json`: 게이트 실행 시나리오

## 제외 범위

아래 항목은 generated artifact이므로 필요할 때만 생성하고 기본 저장소에는 남기지 않습니다.

- `iteration-*`
- `benchmark.json`

현재 저장소에서는 문서 기준선이 source of truth이므로, 이 workspace도 최소 평가 정의만 유지합니다.
