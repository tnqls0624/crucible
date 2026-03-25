# Ship Phase Gate

> 릴리스/배포 전 최종 통과 조건

## Exit Criteria

| # | Check | Method | Pass Condition |
|---|-------|--------|----------------|
| 1 | gate-build 통과 | 최신 gate-build 보고서 확인 | PASS |
| 2 | CHANGELOG 업데이트 | Grep: 현재 버전 또는 날짜 | 존재 |
| 3 | README 동기화 | Read: 주요 변경사항 반영 여부 | 반영됨 |
| 4 | Breaking Changes 명시 | Grep: `BREAKING` in CHANGELOG | 있으면 명시, 없으면 PASS |
| 5 | 버전 태그 | 시맨틱 버전 준수 | `v{major}.{minor}.{patch}` |
| 6 | ADR 최종 상태 | 모든 관련 ADR status | `accepted` |
| 7 | Security Audit | security-auditor 보고서 | CRITICAL 0건 |
| 8 | Canary Check | 배포 후 헬스/스모크 | OK (로컬은 SKIP) |

## Failure Actions

- CHANGELOG 누락 → tech-writer 에이전트로 자동 생성
- README 미동기화 → tech-writer 에이전트로 업데이트
- 버전 형식 오류 → 올바른 시맨틱 버전 제안

## Pass Action

- Git tag 생성 (사용자 확인 후)
- PR 생성 또는 main 머지 (사용자 확인 후)
- `.claude/CLAUDE.md`의 Phase를 `spec`으로 리셋 (다음 피처 사이클 준비)
- `.claude/CLAUDE.md` 와 관련 스펙/ADR 문서의 shipped 상태를 정리
