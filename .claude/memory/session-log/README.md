# Session Log Policy

이 디렉토리는 로컬 작업 세션 요약을 저장하는 위치입니다.

공개 저장소에서는 아래 원칙을 따릅니다.

- 실제 세션 로그 `*.md` 파일은 git에 커밋하지 않습니다.
- 개인 작업 흔적과 로컬 절대 경로를 외부에 노출하지 않기 위함입니다.
- 공개 저장소에는 이 README만 남기고, 실제 로그는 각 사용자의 로컬 환경에서 생성합니다.
- live worktree registry처럼 수시로 바뀌는 runtime state는 `.claude/runtime/` 아래에서 별도로 관리합니다.

예시 파일명:

- `2026-03-26-0045-summary.md`
- `2026-03-26-1030-summary.md`
