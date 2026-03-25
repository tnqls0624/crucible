# Gate Definitions Reference

## 이중 게이트 아키텍처

Crucible은 **Dual Quality Gate** 패턴을 채택합니다:

- **Gate A (Validation)**: 빠르고 결정론적인 정적 분석
- **Gate B (Testing)**: 느리지만 포괄적인 동적 검증

이 분리는 빠른 피드백(Gate A)과 깊은 검증(Gate B)의 균형을 맞춥니다.
Gate A가 실패하면 Gate B 실행을 스킵하여 불필요한 테스트 시간을 절약합니다.

## Gate A 상세

### Type Check
- **목적**: 정적 타입 안전성 보장
- **Zero-Tolerance**: 1개의 에러도 허용하지 않음
- **자동 수정**: 불가 (코드 로직 변경 필요)

### Linter
- **목적**: 코드 스타일, 잠재적 버그, 보안 취약점 탐지
- **Zero-Tolerance**: 경고 포함 0개
- **자동 수정**: 가능한 항목은 `--fix` 옵션으로 자동 수정 시도

### Format
- **목적**: 코드 포맷 일관성
- **자동 수정**: `--fix` / `--write`로 자동 포맷팅 후 재검증

## Gate B 상세

### Tests
- **범위**: 프로젝트의 전체 테스트 스위트
- **기준**: 100% 통과 (실패 테스트 0개)
- **기존 테스트 보호**: 새 구현이 기존 테스트를 깨뜨리면 즉시 FAIL

### Coverage
- **프로젝트별 설정**: `.claude/CLAUDE.md`와 현재 스펙의 기술 스택에서 threshold 확인
- **기본값**: threshold 미설정 시 이 검사는 SKIP
- **측정 대상**: 새로 추가/수정된 파일만

### Spec Compliance
- **방법**: 스펙의 각 Feature ID 수용 기준을 코드/테스트와 대조
- **자동화 한계**: 수동 판단이 필요한 기준은 reviewer 에이전트에게 위임

### Clean Code
- **검색 대상**: 신규/변경 파일에서 `TODO`, `FIXME`, `HACK`, `XXX` 패턴
- **예외**: 주석으로 이유가 명시된 경우 사용자에게 판단 위임

## PDCA Retry Protocol

```
Plan:  게이트 정의에 따른 검증 계획
Do:    검증 실행
Check: 결과 분석, 실패 원인 분류
Act:   자동 수정 또는 engineer 재호출

재시도 제한: 2회
에스컬레이션: 3회째 실패 시 사용자에게 결정 위임
```
