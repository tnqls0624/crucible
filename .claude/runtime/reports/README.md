# Task Report Policy

이 디렉토리는 build/gate 단계에서 생성되는 canonical task report를 저장하는 위치입니다.

공개 저장소에서는 아래 원칙을 따릅니다.

- 실제 report `*.md` 파일은 git에 커밋하지 않습니다.
- reviewer, evaluator, QA 보고서는 이 디렉토리의 canonical path를 사용합니다.
- report는 사람이 읽는 Markdown 본문과 기계가 읽는 TOML frontmatter를 함께 가져야 합니다.
- gate는 이 디렉토리의 report를 기준으로 Contract Compliance를 판정합니다.

파일명 규칙:

- `{Task ID}.reviewer.md`
- `{Task ID}.evaluator.md`
- `{Task ID}.qa.md`
