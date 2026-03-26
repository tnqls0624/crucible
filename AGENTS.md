# Crucible — AI Engineering Workflow

Crucible는 `Claude Code`와 `Codex`에서 동일한 개발 흐름을 강제하는 repo-local agentic workflow입니다.
핵심은 blank prompt 대신 아래 파이프라인을 사용하는 것입니다.

**spec → plan → build → gate → ship**

## Available Skills

| Skill | What it does |
|-------|--------------|
| `/crucible-status` | 현재 phase, 활성 스펙, ADR, git 상태를 보여줍니다. |
| `/crucible-spec` | 기능 요청을 스펙으로 구조화합니다. |
| `/crucible-plan` | 스펙을 ADR과 구현 태스크로 분해합니다. |
| `/crucible-build` | engineer/reviewer 루프로 구현을 진행합니다. |
| `/crucible-gate` | 타입, 린트, 테스트, 스펙 준수를 검증합니다. |
| `/crucible-qa` | 브라우저 기반 QA를 수행합니다. |
| `/crucible-ship` | 릴리스/배포 흐름을 마무리합니다. |
| `/crucible-init` | 새 프로젝트에 Crucible 구조를 잡습니다. |

## Setup

```bash
./setup --host claude
./setup --host codex
./setup --host codex --with-browser
```

`install.sh`는 저수준 호환 엔트리포인트이고, 공개용 기본 진입점은 `./setup`입니다.

## Key Conventions

- `.claude/`는 framework source of truth입니다.
- `.agents/`는 generated output입니다. 직접 수정하지 않습니다.
- 일반 사용자는 `.claude`를 고치기보다 프로젝트 코드 작업에 `/crucible-*` 명령을 사용합니다.
- framework 자체를 바꿀 때만 `.claude/skills/`, `.claude/gates/`, `.claude/protocols/`를 수정합니다.
- fresh install 기본 phase는 `spec`입니다.

## Working Style

새 작업은 보통 이렇게 진행합니다.

1. `/crucible-status`
2. `/crucible-spec`
3. `/crucible-plan`
4. `/crucible-build`
5. `/crucible-gate`
6. `/crucible-ship`

브라우저 QA가 필요한 web-app일 때만 `/crucible-qa`를 사용합니다.

## Reference Files

- [.claude/CLAUDE.md](./.claude/CLAUDE.md)
- [CLAUDE.md](./CLAUDE.md)
- [.claude/protocols/constrained-claude-dialect.md](./.claude/protocols/constrained-claude-dialect.md)
- [.claude/protocols/codex-target-semantics.md](./.claude/protocols/codex-target-semantics.md)
