# Crucible development

## Quick Commands

```bash
./setup --host claude
./setup --host codex
./setup --host codex --with-browser
./install.sh claude
./install.sh codex
```

## What This Repo Is

Crucible는 프로젝트 코드 작업을 구조화된 phase와 specialist skill로 굴리기 위한 agentic workflow 프레임워크입니다.

일반 사용자 모드에서는 `.claude`를 거의 수정하지 않고 `/crucible-*` 명령으로 프로젝트 코드를 작업합니다.
Maintainer 모드에서는 `.claude/skills/`, `.claude/gates/`, `.claude/protocols/`를 수정해 프레임워크 자체를 개선합니다.

## Default Workflow

새 기능은 보통 이 순서로 진행합니다.

1. `/crucible-status`
2. `/crucible-spec`
3. `/crucible-plan`
4. `/crucible-build`
5. `/crucible-gate`
6. `/crucible-ship`

fresh clone 기본 phase는 `spec`입니다.

## Project Structure

```text
crucible/
├── .claude/        # framework source of truth
├── .agents/        # generated Codex artifacts (setup 후 생성, 커밋하지 않음)
├── AGENTS.md       # Codex/agent 운영 문서
├── CLAUDE.md       # Claude Code 운영 문서
├── setup           # public setup entrypoint
└── install.sh      # low-level compatibility entrypoint
```

## Important Conventions

- `.claude/`를 수정했다면 Codex 반영을 위해 `./setup --host codex`를 다시 실행합니다.
- `.agents/`는 generated output이므로 직접 수정하지 않습니다.
- browser QA가 필요할 때만 `--with-browser`를 사용합니다.
- `.claude/memory/specs/`와 `.claude/memory/decisions/`는 starter 기준으로 비워 두고, 실제 프로젝트 문맥으로 채워 사용합니다.

## Internal Reference

세부 framework 기준선은 [.claude/CLAUDE.md](/Users/soobeen/Desktop/Project/worktree/.claude/CLAUDE.md)에 있습니다.
