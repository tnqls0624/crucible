# Runtime State Policy

이 디렉토리는 세션 중 계속 변하는 로컬 런타임 상태를 저장하는 위치입니다.

공개 저장소에서는 아래 원칙을 따릅니다.

- 실제 runtime state `*.md` 파일은 git에 커밋하지 않습니다.
- 병렬 worktree registry, preview URL, 포트 할당 상태처럼 수시로 바뀌는 값만 둡니다.
- canonical source는 계속 `.claude/` 문서이지만, live registry는 이 디렉토리에서 관리합니다.

예시 파일명:

- `worktree-runtime.md`
- `reports/ADR002-T2.reviewer.md`
- `reports/ADR002-T2.evaluator.md`
