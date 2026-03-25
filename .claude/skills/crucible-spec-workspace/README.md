# crucible-spec-workspace

이 디렉토리는 `crucible-spec` 스킬 자체를 검증할 때 사용하는 보조 workspace입니다.

## 포함 범위

- `evals/evals.json`: 스킬 평가용 입력 시나리오
- `grade_spec.py`: 평가 결과 채점 스크립트

## 제외 범위

아래 항목은 generated artifact이므로 장기 보관 대상이 아닙니다.

- `iteration-*`
- `benchmark.json`
- `__pycache__/`

즉, 이 디렉토리는 "프로젝트 기능 구현물"이 아니라 "스킬 검증 자산"입니다.
